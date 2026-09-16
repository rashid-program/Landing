'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const test = require('node:test');

const APP_PORT = 3012;
const STORAGE_PORT = 3011;
const APP_ORIGIN = `http://127.0.0.1:${APP_PORT}`;
const receivedRecords = [];

let storageServer;
let appProcess;

async function waitForApp(timeoutMs = 8_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${APP_ORIGIN}/api/health`);
      if (response.ok) return response.json();
    } catch {
      // The child process is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 80));
  }

  throw new Error('Timed out waiting for sandbox server');
}

async function postLead(body, origin = APP_ORIGIN) {
  const response = await fetch(`${APP_ORIGIN}/api/leads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
      'User-Agent': 'MathX privacy pipeline test',
    },
    body: JSON.stringify(body),
  });

  return {
    response,
    data: await response.json(),
  };
}

test.before(async () => {
  storageServer = http.createServer((request, response) => {
    if (request.method !== 'POST' || request.url !== '/leads') {
      response.writeHead(404).end();
      return;
    }

    let rawBody = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      rawBody += chunk;
    });
    request.on('end', () => {
      receivedRecords.push({
        authorization: request.headers.authorization,
        body: JSON.parse(rawBody),
      });

      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ persisted: true }));
    });
  });

  await new Promise((resolve, reject) => {
    storageServer.once('error', reject);
    storageServer.listen(STORAGE_PORT, '127.0.0.1', resolve);
  });

  appProcess = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      NODE_ENV: 'development',
      HOST: '127.0.0.1',
      PORT: String(APP_PORT),
      PUBLIC_ORIGIN: APP_ORIGIN,
      PRIMARY_LEAD_WEBHOOK_URL: `http://127.0.0.1:${STORAGE_PORT}/leads`,
      PRIMARY_LEAD_WEBHOOK_TOKEN: 'test-token',
      PRIMARY_DATA_REGION: 'RU',
      PRIMARY_STORAGE_CONFIRMED: 'true',
      DATA_OPERATOR_ID: 'test-operator',
      CONSENT_VERSION: 'test-consent-v1',
      TELEGRAM_BOT_TOKEN: '',
      TELEGRAM_CHAT_ID: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let startupErrors = '';
  appProcess.stderr.on('data', (chunk) => {
    startupErrors += chunk.toString();
  });

  appProcess.once('exit', (code) => {
    if (code && code !== 0) {
      throw new Error(`Sandbox server exited with ${code}: ${startupErrors}`);
    }
  });

  const health = await waitForApp();
  assert.equal(health.leadCollectionReady, true);
});

test.after(async () => {
  if (appProcess && !appProcess.killed) {
    appProcess.kill();
  }

  if (storageServer) {
    await new Promise((resolve) => storageServer.close(resolve));
  }
});

test('rejects an invalid lead and stores nothing', async () => {
  const { response, data } = await postLead({
    applicantType: '',
    name: 'A',
    phone: '12',
    consent: false,
  });

  assert.equal(response.status, 422);
  assert.equal(data.ok, false);
  assert.ok(data.errors.applicantType);
  assert.ok(data.errors.name);
  assert.ok(data.errors.phone);
  assert.ok(data.errors.consent);
  assert.equal(receivedRecords.length, 0);
});

test('rejects a cross-origin form request', async () => {
  const { response } = await postLead(
    {
      applicantType: 'parent',
      name: 'Test',
      phone: '+7 999 123-45-67',
      consent: true,
    },
    'https://evil.example',
  );

  assert.equal(response.status, 403);
  assert.equal(receivedRecords.length, 0);
});

test('rejects the honeypot and stores nothing', async () => {
  const { response, data } = await postLead({
    applicantType: 'parent',
    name: 'Test',
    phone: '+7 999 123-45-67',
    website: 'spam.example',
    consent: true,
  });

  assert.equal(response.status, 422);
  assert.ok(data.errors.form);
  assert.equal(receivedRecords.length, 0);
});

test('reports success only after the primary Russian storage confirms persistence', async () => {
  const { response, data } = await postLead({
    applicantType: 'parent',
    name: 'Тест',
    phone: '+7 999 123-45-67',
    grade: '9',
    goal: 'oge',
    contactMethod: 'telegram',
    website: '',
    consent: true,
  });

  assert.equal(response.status, 201);
  assert.equal(data.ok, true);
  assert.match(data.requestId, /^[0-9a-f-]{36}$/);
  assert.equal(receivedRecords.length, 1);

  const stored = receivedRecords[0];
  assert.equal(stored.authorization, 'Bearer test-token');
  assert.equal(stored.body.operatorId, 'test-operator');
  assert.deepEqual(stored.body.lead, {
    applicantType: 'parent',
    name: 'Тест',
    phone: '+7 999 123-45-67',
    grade: '9',
    goal: 'oge',
    contactMethod: 'telegram',
  });
  assert.equal(stored.body.consentEvidence.accepted, true);
  assert.equal(stored.body.consentEvidence.documentVersion, 'test-consent-v1');
  assert.equal(stored.body.consentEvidence.requestId, data.requestId);
  assert.equal(stored.body.consentEvidence.userAgent, 'MathX privacy pipeline test');
  assert.ok(stored.body.consentEvidence.acceptedAt);
  assert.ok(stored.body.consentEvidence.ip);
});

test('does not expose source or former admin files', async () => {
  const privatePaths = ['/server/server.js', '/admin.js', '/admin-data.json', '/source-assets/rashid-original.jpg'];

  for (const privatePath of privatePaths) {
    const response = await fetch(`${APP_ORIGIN}${privatePath}`);
    assert.equal(response.status, 404, privatePath);
  }
});
