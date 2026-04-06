# CLAUDE.md — Frontend Website Rules
speak with me only in russian language
## Always Do First
- **Invoke the `frontend-design` skill** before writing any frontend code, every session, no exceptions.
- cheak CONTEX.md for understand what project is this
- НИКОГДА не выходи за пределы папки этого проекта.
- НИКОГДА не трогай файлы вне текущей директории.
- НИКОГДА не удаляй файлы без явного подтверждения.
## Reference Images
- If a reference image is provided: match layout, spacing, typography, and color exactly. Swap in placeholder content (images via `https://placehold.co/`, generic copy). Do not improve or add to the design.
- If no reference image: design from scratch with high craft (see guardrails below).
- Screenshot your output, compare against reference, fix mismatches, re-screenshot. Do at least 2 comparison rounds. Stop only when no visible differences remain or user says so.

## Local Server
- **Always serve on localhost** — never screenshot a `file:///` URL.
- Start the dev server: `cd server && npm start` (serves project on `http://localhost:3000`)
- Сервер автоматически раздаёт фронтенд (index.html, variant.html) и API
- Если сервер уже запущен, не запускайте новый.

## Screenshot Workflow
- Chrome установлен в `C:\Users\Rashid\.cache\puppeteer\chrome\` (автоматически через npm)
- **Всегда скриншотируйте localhost:** `node screenshot.mjs http://localhost:3000`
- Скриншоты сохраняются в `./temporary screenshots/screenshot-N.png` (нумеруются автоматически)
- Пример: `node screenshot.mjs http://localhost:3000 home` → `screenshot-N-home.png`
- После скриншота читайте PNG с инструментом Read — я вижу изображение напрямую
- При сравнении будьте точны: "heading 32px, но в дизайне ~24px", "gap 16px, должен быть 24px"
- Проверяйте: отступы, размеры шрифтов, цвета (hex), выравнивание, border-radius, тени, размеры изображений

## Output Defaults
- Placeholder images: `https://placehold.co/WIDTHxHEIGHT`
- Mobile-first responsive


- **Interactive states:** Every clickable element needs hover, focus-visible, and active states. No exceptions.

### Путь Puppeteer Chrome
```
C:\Users\Rashid\.cache\puppeteer\chrome\win64-146.0.7680.153\chrome-win64\chrome.exe
```

## Hard Rules
- Do not add sections, features, or content not in the reference
- Do not "improve" a reference design — match it
- Do not stop after one screenshot pass
- Do not use `transition-all`
- Do not use default Tailwind blue/indigo as primary color


