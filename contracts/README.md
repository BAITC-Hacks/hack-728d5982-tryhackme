# Контракты интеграций

| Граница | Источник схемы | Реализация |
| --- | --- | --- |
| Backend ↔ ekt.kz | [Pydantic](../backend/app/schemas/ekt_catalog.py) → [OpenAPI](ekt-catalog.openapi.json) | [Наблюдаемый API чтения](ekt-catalog-api.md); Basic Auth только на сервере. |
| index.html ↔ наш API | Pydantic-модели [app.landing](../backend/app/landing.py) → [OpenAPI](landing.openapi.json) | Живой чат, каталог, условия, защищённая сессия и корзина. Отдельной копии TypeScript-типов нет: frontend написан на JavaScript в одном файле. |
| Корзина ↔ хранилище | `CartAdapter`, `ServerCart`, `Session` в `app.landing` | Память одного процесса. Корзина нашего приложения — согласованная граница текущего прототипа; магазин подключается будущим адаптером. |

## Сессия и операции

`GET /api/session` устанавливает HttpOnly/SameSite cookie и возвращает CSRF, состояние корзины и признаки настройки интеграций. Все POST требуют cookie и `X-CSRF-Token`; при наличии Origin он должен совпадать с origin сервера. Сессия действует до часа бездействия и теряется при перезапуске процесса.

- `POST /api/chat`: `{text, attachments:[{name,data}]}`. Structured Outputs извлекает намерение, сервер проверяет факты и возвращает `ChatReply` с карточками, объяснениями аналогов, условиями либо предложением. Файлы не могут дать согласие.
- `GET /api/catalog?page=…`, `GET /api/catalog/detail?id=…`: чтение партнёра, проверка Pydantic. `GET /api/terms`: опубликованные условия.
- `POST /api/cart/prepare`: `{items:[{product_id,quantity}], action:"add"|"remove"}`. Проверяет данные и формирует предложение, корзину не изменяет.
- `POST /api/cart/confirm`: `{proposal_id, confirmation:"Да, добавить"|"Да, удалить"}`. Срок 180 секунд, связь с сессией/версией, повторное чтение всех добавляемых карточек. Изменение применяется целиком после проверок.
- `POST /api/cart/cancel`: отмена предложения. `GET /api/cart`: актуальное состояние; `url:"/cart"` открывает его через тот же HTML.

Ошибки: 401 — сессия истекла, 403 — CSRF/Origin, 409 — недействующее согласие/изменившиеся данные/остаток, 413 — размер, 422 — ввод/структура файла, 502/503 — внешний сервис либо конфигурация. Ошибки не содержат секретов или сырого ответа провайдера.

Проверка из `backend/` (оба генератора запускаются в CI):

```bash
uv run python generate_ekt_catalog_openapi.py --check
uv run python generate_landing_openapi.py --check
```

OpenAPI проверяет форму, а `npm run test:landing:live` в `frontend/` проверяет реальные пользовательские результаты. Полный сценарий и ограничения — в [README](../README.md).
