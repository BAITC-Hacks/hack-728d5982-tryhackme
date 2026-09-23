# Frontend HackAlem — Next.js 16

Рабочий лендинг на **React, Tailwind CSS 4 и shadcn/ui**. Тёмная тема, тонкие анимированные RGB-линии, адаптивные карточки и одно окно чата. Анимация отключается при `prefers-reduced-motion`.

## Запуск

Из корня проекта, в двух терминалах:

```bash
make dev           # FastAPI, порт 8765
make dev-frontend  # Next.js, порт 3000
```

Откройте <http://localhost:3000/>. `npm ci` и `uv sync --directory backend` нужны при первом запуске. Доступы OpenAI/каталога остаются в серверном `.env`. `ASSISTANT_API_URL` из `frontend/.env.local` задаёт внутренний адрес FastAPI (по умолчанию `http://127.0.0.1:8765`); старый `ASSISTANT_URL` больше не используется.

Для воспроизводимости в этой среде dev/build используют поддерживаемый Next.js сборщик Webpack; зависимости не добавлялись.

Продакшен локально: `npm run build && npm start` из `frontend/`, FastAPI запускается отдельно. Развёртывать frontend следует из репозитория целиком: сборка читает корневой `index.html`. Готовым `.next` и `public/assistant` исходник при запуске не нужен. Существующий Docker-образ запускает FastAPI и исходный HTML; Next.js в него не добавлен.

## Простой перенос с сохранением поведения

- `src/app/page.tsx` — новый React-лендинг; `globals.css` — Tailwind и оформление, `ui/button.tsx` — используемый shadcn Button.
- `scripts/sync-assistant.mjs` при `predev`/`prebuild` извлекает из **одного исходного `index.html`** разметку чата, начальную выборку, CSS и JS. CSS ограничен `.assistant-widget`; `widget-theme.css` задаёт тему чата. Генерируемые файлы не коммитятся.
- `AssistantWidget` в корневом layout сохраняет изолированный DOM чата. Код запускается один раз после гидратации; кнопки активируются после готовности. Прямой `/cart`, обновление, файлы, менеджер и согласие используют прежний механизм. iframe и переход на другой origin не нужны.
- Это постепенный перенос: **лендинг на React, интерактивный чат пока на проверенном DOM/JS**. Менять поведение чата нужно в `index.html`, затем перезапустить frontend/пересобрать. Полное переписывание сообщений в React в этот этап не входит.
- `/api/[...path]` проксирует GET/POST в FastAPI. Проверяет Origin браузера до передачи, сохраняет cookie/CSRF, отключает кеширование; при HTTPS добавляет Secure cookie. Правила каталога и корзины остаются в backend.
- `/cart` использует ту же страницу и layout; `/index.html` — совместимый адрес этого лендинга. Без backend доступен явно обозначенный автономный деморежим.

## Проверки

```bash
npm run build
npm run lint
npm run type-check
npm run test:next        # реальные Next.js страницы, API-фикстуры / демо
npm run test:next:live   # настоящий Next.js → FastAPI → OpenAI / ekt.kz
```

Playwright использует production-сборку и desktop/mobile. Живые вызовы расходуют API-бюджет. Наборы `test:landing` и `test:landing:live` сохранены для исходного HTML. Сценарии ассистента переиспользуются в обоих интерфейсах; отдельно проверяется прокси, отсутствие iframe, ошибки JS и уменьшение движения.

Основание интеграции: [маршруты Next.js](https://nextjs.org/docs/app/api-reference/file-conventions/route), [shadcn в Next.js](https://ui.shadcn.com/docs/installation/next). Контракт API генерируется из Pydantic: [landing.openapi.json](../contracts/landing.openapi.json).
