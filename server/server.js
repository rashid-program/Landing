const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, '..', 'admin-data.json');
const ADMIN_PASSWORD = 'mathx2026';

app.use(express.static(path.join(__dirname, '..')));
app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Получить все тексты
app.get('/api/texts', (req, res) => {
  if (!fs.existsSync(DATA_FILE)) {
    return res.json({});
  }
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  res.json(data);
});

// Сохранить тексты (требует пароль)
app.post('/api/texts', (req, res) => {
  const { password, texts } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: 'Неверный пароль' });
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(texts, null, 2), 'utf-8');
  res.json({ ok: true });
});

// Проверить пароль
app.post('/api/auth', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ ok: true });
  } else {
    res.status(403).json({ error: 'Неверный пароль' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
