# Frontend HackAlem

Здесь оставлена минимальная основа **Next.js 16 + React + Tailwind CSS 4 + shadcn/ui** по запросу заказчика. Полный интерфейс работает в корневом [index.html](../index.html), обслуживается `app.landing` и покрывает UC-01…05. При запуске основы Next.js видна короткая входная страница с кнопкой перехода к этому ассистенту.

## Запуск

```bash
npm ci
npm run dev
```

Адрес основы: <http://localhost:3000/>. `ASSISTANT_URL` в `.env.local` задаёт доступный браузеру URL работающего ассистента; по умолчанию <http://127.0.0.1:8765/>. Запустите его отдельно командой `make dev` из корня. Next.js пока не проксирует API и не хранит корзину.

## Что оставлено

- `src/app/layout.tsx`, `page.tsx`, `globals.css`: App Router, входная страница, минимальные цвета Tailwind/shadcn.
- `src/components/ui/button.tsx` и `src/lib/utils.ts`: один используемый компонент shadcn и объединение классов.
- `components.json`: конфигурация добавления компонентов shadcn по мере переноса UI.
- TypeScript, ESLint, Prettier, npm lockfile и Playwright для текущего лендинга.

Новые компоненты и зависимости добавляйте под конкретный UC. Перенос чата в React должен сохранить единое окно, серверную проверку данных и отдельное согласие на корзину; контракт — [landing.openapi.json](../contracts/landing.openapi.json).

## Проверки

```bash
npm run lint
npm run build
npm run type-check
npm run test:landing
npm run test:landing:live
```

Последняя команда использует настоящие ekt.kz/OpenAI и `.env` backend. Подробности — [docs/testing.md](../docs/testing.md).

Основа подготовлена по официальным инструкциям [Next.js 16](https://nextjs.org/docs/app/guides/upgrading/version-16) и [shadcn для Next.js](https://ui.shadcn.com/docs/installation/next). Здесь используется поддерживаемый вариант Button с Radix Slot; остальные компоненты пока не нужны.
