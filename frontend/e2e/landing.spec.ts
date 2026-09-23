import { test, expect, type Page } from "@playwright/test";

async function open(page: Page) {
  await page.goto("/index.html");
  await page.getByRole("button", { name: "Открыть чат", exact: true }).click();
}
async function ask(page: Page, text: string) {
  await page.getByRole("textbox", { name: "Сообщение" }).fill(text);
  await page.getByRole("button", { name: "Отправить", exact: true }).click();
}

test("UC-01: facts from the supplied catalog stay inside one chat", async ({ page }) => {
  await open(page);
  await ask(page, "Есть ли 027228 в наличии?");
  const chat = page.getByRole("dialog");
  await expect(chat).toContainText("200300285_");
  await expect(chat).toContainText("23 шт.");
  await expect(chat).toContainText("400В");
  await expect(chat).toContainText("250 А");
  await expect(chat).toContainText("расхождение");
  await expect(chat).toContainText("Сертификат не указан");
  await page.getByRole("button", { name: "Свернуть чат" }).click();
  await page.getByRole("button", { name: "Открыть чат", exact: true }).click();
  await expect(chat).toContainText("200300285_");
  expect(await page.locator('[role="dialog"]').count()).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("UC-04/05: explicit consent, quantity, current cart link and reload", async ({ page }) => {
  await open(page);
  await ask(page, "Добавь 3 шт 027228");
  await expect(page.locator("[data-pending]")).toContainText("3 шт.");
  await expect(page.locator("#cartCount")).toHaveText("0");
  await ask(page, "ок");
  await expect(page.locator("#cartCount")).toHaveText("0");
  await page.getByRole("button", { name: "Да, добавить", exact: true }).click();
  await expect(page.locator("#cartCount")).toHaveText("3");
  await page.getByRole("link", { name: "Открыть корзину →" }).last().click();
  await expect(page.locator("#cartSummary")).toContainText("3 шт.");
  await page.reload();
  await expect(page.locator("#cartSummary")).toContainText("3 шт.");
});

test("UC-04: overflow, negative quantity, cancel, stale consent do not mutate cart", async ({
  page,
}) => {
  await open(page);
  await ask(page, "Добавь 24 шт 027228");
  await expect(page.getByRole("dialog")).toContainText("доступно 23");
  await expect(page.locator("[data-pending]")).toHaveCount(0);
  await ask(page, "Добавь -2 шт 027228");
  await expect(page.getByRole("dialog")).toContainText("положительное целое");
  await ask(page, "Добавь 2 шт 027228");
  await page.getByRole("button", { name: "Отмена", exact: true }).click();
  await ask(page, "да, добавь");
  await expect(page.locator("#cartCount")).toHaveText("0");
  await ask(page, "Характеристики 027228");
  await page.getByRole("button", { name: "В корзину", exact: true }).last().click();
  await expect(page.locator("[data-pending]")).toContainText("1 шт.");
  await page.getByRole("spinbutton", { name: "Количество 200300285_" }).fill("4");
  await expect(page.locator("[data-pending]")).toHaveCount(0);
  await ask(page, "да, добавь");
  await expect(page.locator("#cartCount")).toHaveText("0");
});

test("UC-01/02/03: unknown facts are not invented", async ({ page }) => {
  await open(page);
  await ask(page, "Артикул UNKNOWN-99999");
  await expect(page.getByRole("dialog")).toContainText("Не нашёл");
  await ask(page, "Какие условия оплаты и доставки, минимальная партия?");
  await expect(page.getByRole("dialog")).toContainText("не подтверждены");
  await ask(page, "Аналог 027228");
  await expect(page.getByRole("dialog")).toContainText("наличие и совместимость");
});

test("attachments can be removed and text input never becomes HTML", async ({ page }) => {
  await open(page);
  await page
    .locator("#fileInput")
    .setInputFiles({ name: "spec.txt", mimeType: "text/plain", buffer: Buffer.from("027228") });
  await expect(page.locator("#attachments")).toContainText("spec.txt");
  await page.getByRole("button", { name: "Удалить spec.txt" }).click();
  await expect(page.locator("#attachments")).toBeEmpty();
  await ask(page, "<img src=x onerror=alert(1)>");
  await expect(page.locator(".message.user")).toContainText("<img src=x onerror=alert(1)>");
  expect(await page.locator(".message.user img").count()).toBe(0);
});

test("landing file entry opens one chat, preserves a draft and waits for submission", async ({
  page,
}) => {
  await page.goto("/index.html");
  const picker = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Прикрепить спецификацию ↗", exact: true }).click();
  await (
    await picker
  ).setFiles({ name: "spec.txt", mimeType: "text/plain", buffer: Buffer.from("027228") });
  await expect(page.locator("#attachments")).toContainText("spec.txt");
  await expect(page.getByRole("textbox", { name: "Сообщение" })).toHaveValue(
    "Покажи наличие и характеристики всех позиций из файла.",
  );
  await expect(page.locator(".message.user")).toHaveCount(0);
  await expect(page.locator("#cartCount")).toHaveText("0");
  await page.getByRole("textbox", { name: "Сообщение" }).fill("Мой вопрос о товаре");
  await page.getByRole("button", { name: "Свернуть чат" }).click();
  const secondPicker = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Прикрепить спецификацию ↗", exact: true }).click();
  await (await secondPicker).setFiles([]);
  await expect(page.getByRole("textbox", { name: "Сообщение" })).toHaveValue("Мой вопрос о товаре");
  await expect(page.getByRole("dialog")).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Свернуть чат" }).click();
  await page
    .locator("#start")
    .screenshot({ path: test.info().outputPath("landing-entry-points.png") });
});

// Controlled API responses isolate navigation/formatting from network and LLM latency.
async function mockServer(page: Page) {
  await page.route("**/cart", async (route) => {
    if (new URL(route.request().url()).pathname !== "/cart") return route.fallback();
    await route.fulfill({ response: await page.request.get("/index.html") });
  });
  const cart = {
    items: [
      {
        product_id: 1,
        article: "TEST-001",
        name: "Тестовая позиция",
        quantity: 2,
        price: 100,
        line_total: 200,
      },
    ],
    count: 2,
    total: 200,
    url: "/cart",
    mode: "server",
  };
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/session") {
      await route.fulfill({ json: { csrf: "test-only", ai: true, live: true, cart } });
    } else if (path === "/api/cart") {
      await route.fulfill({ json: cart });
    } else if (path === "/api/chat") {
      const text = route.request().postDataJSON().text;
      await new Promise((resolve) => setTimeout(resolve, 200));
      await route.fulfill({
        json: text.includes("корзин")
          ? { text: "Ваша корзина", cart }
          : {
              text: "**Этого дублирующего текста быть не должно**",
              terms: {
                payment:
                  "Физическим лицам:\n- Картой онлайн\n- Наличными\nЮридическим лицам:\n- Перечислением на счёт\n<img src=x onerror=alert(1)>",
                delivery: Array.from(
                  { length: 10 },
                  (_, i) =>
                    `${i + 1}. Условие доставки ${i + 1}: уточните адрес и время получения.`,
                ).join("\n"),
                minimum: "Общая минимальная партия не опубликована.",
                source: "https://ekt.kz/checkout-delivery/",
                fetched_at: "2026-09-23T00:00:00Z",
              },
            },
      });
    } else await route.fulfill({ status: 404, json: {} });
  });
}

test("server cart: repeated opening and text request reveal rows without moving the page", async ({
  page,
}) => {
  await mockServer(page);
  await open(page);
  await expect(page.locator("#modeBanner")).toContainText("ИИ подключён");
  await page.getByRole("button", { name: "Показать корзину" }).click();
  const summary = page.locator("#cartSummary");
  await expect(summary.locator(".cart-row")).toBeInViewport();
  await expect(summary).toBeFocused();
  await ask(page, "Оплата и доставка");
  await expect(page.locator("#sendButton")).toBeEnabled();
  const documentTop = await page.evaluate(() => scrollY);
  await page.getByRole("button", { name: "Показать корзину" }).click();
  await expect(summary.locator("h3")).toBeInViewport();
  await expect(summary.locator(".cart-row")).toBeInViewport();
  await expect(summary).toBeFocused();
  expect(await page.evaluate(() => scrollY)).toBe(documentTop);
  await summary.getByRole("link", { name: "Прямая ссылка на эту корзину →" }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(summary.locator(".cart-row")).toBeInViewport();
  await ask(page, "Покажи корзину");
  await expect(page.locator("#sendButton")).toBeEnabled();
  await expect(summary).toHaveCount(1);
  await expect(summary).toContainText("TEST-001");
  await expect(summary.locator(".cart-row")).toBeInViewport();
  await page.reload();
  await expect(summary.locator(".cart-row")).toBeInViewport();
  await expect(summary).toBeFocused();
});

test("purchase terms have readable sections and safe lists; cart opens during a chat request", async ({
  page,
}) => {
  await mockServer(page);
  await open(page);
  await expect(page.locator("#modeBanner")).toContainText("ИИ подключён");
  await ask(page, "Оплата и доставка");
  await page.getByRole("button", { name: "Показать корзину" }).click();
  await expect(page.locator("#cartSummary")).toContainText("TEST-001");
  await expect(page.locator("#sendButton")).toBeEnabled();
  const terms = page.locator(".purchase-terms");
  await expect(terms.locator("h4")).toHaveText(["Оплата", "Доставка", "Минимальная партия"]);
  await expect(terms.locator("section").first().locator("li")).toHaveCount(3);
  await expect(terms.locator("section").nth(1).locator("li")).toHaveCount(10);
  await expect(terms.locator("img")).toHaveCount(0);
  await expect(terms).toContainText("<img src=x onerror=alert(1)>");
  await expect(page.getByRole("dialog")).not.toContainText("Этого дублирующего текста");
});

test("specification review preserves exceptions, aggregates selection and requires separate consent", async ({
  page,
}) => {
  const product = {
    id: 1,
    article: "TEST-001",
    name: "Тестовый товар",
    price: 100,
    quantity: 10,
    properties: {},
    stores: [],
    certificates: [],
    warnings: [],
    description: "",
    source: "https://ekt.kz/api/products/detail?id=1",
    fetched_at: "2026-09-23T00:00:00Z",
  };
  const rows = [
    {
      position: 1,
      query: "TEST-001",
      quantity: 2,
      product_id: 1,
      status: "ready",
      message: "Проверено",
      available: 10,
    },
    {
      position: 2,
      query: "TEST-001",
      quantity: 1,
      product_id: 1,
      status: "ready",
      message: "Проверено",
      available: 10,
    },
    {
      position: 3,
      query: "<img src=x onerror=alert(1)>",
      quantity: 1,
      status: "not_found",
      message: "Уточните код",
    },
    {
      position: 4,
      query: "Без количества",
      quantity: null,
      status: "needs_quantity",
      message: "Количество не указано",
    },
  ];
  let count = 0;
  let prepared = 0;
  let confirmations = 0;
  let cancellations = 0;
  const cart = () => ({ items: [], count, total: count * 100, url: "/cart", mode: "server" });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/session") {
      await route.fulfill({ json: { csrf: "test-only", ai: true, live: true, cart: cart() } });
    } else if (path === "/api/chat") {
      await route.fulfill({ json: { text: "Разбор файла", products: [product], review: rows } });
    } else if (path === "/api/cart/prepare") {
      const { items } = route.request().postDataJSON();
      expect(items).toEqual([{ product_id: 1, quantity: 3 }]);
      prepared++;
      await route.fulfill({
        json: {
          id: `test-proposal-${prepared}`,
          action: "add",
          cart_version: 0,
          items: [
            {
              product_id: 1,
              article: "TEST-001",
              name: product.name,
              quantity: 3,
              price: 100,
              line_total: 300,
            },
          ],
        },
      });
    } else if (path === "/api/cart/cancel") {
      cancellations++;
      await route.fulfill({ json: { ok: true } });
    } else if (path === "/api/cart/confirm") {
      expect(route.request().postDataJSON().confirmation).toBe("Да, добавить");
      confirmations++;
      count = 3;
      await route.fulfill({ json: cart() });
    } else await route.fulfill({ status: 404, json: {} });
  });
  await open(page);
  await expect(page.locator("#modeBanner")).toContainText("ИИ подключён");
  await ask(page, "Проверь спецификацию");
  const review = page.locator(".spec-review");
  await expect(review.locator(".review-row")).toHaveCount(4);
  await expect(review.getByRole("heading", { name: "Проверка спецификации" })).toBeInViewport();
  await expect(review).toContainText("Требуют уточнения: 2");
  await expect(review.locator("img")).toHaveCount(0);
  await expect(review).toContainText("<img src=x onerror=alert(1)>");
  await expect(review).toContainText("Запрошено: не указано");
  await expect(page.locator("#cartCount")).toHaveText("0");
  expect(prepared).toBe(0);
  const choices = review.getByRole("checkbox");
  await choices.nth(0).uncheck();
  await choices.nth(1).uncheck();
  await expect(review.getByRole("button", { name: "Проверить выбранное" })).toBeDisabled();
  await choices.nth(0).check();
  await choices.nth(1).check();
  await expect(review.locator(".review-summary")).toHaveText(
    "Выбрано строк: 2 из 4. Не выбрано: 2.",
  );
  await review.getByRole("button", { name: "Проверить выбранное" }).click();
  await expect(page.locator("[data-pending]")).toContainText("3 шт.");
  await expect(page.locator("#cartCount")).toHaveText("0");
  expect(confirmations).toBe(0);
  await expect(page.locator("#sendButton")).toBeEnabled();
  await choices.nth(1).uncheck();
  await expect(page.locator("[data-pending]")).toHaveCount(0);
  await expect.poll(() => cancellations).toBe(1);
  await choices.nth(1).check();
  await review.getByRole("button", { name: "Проверить выбранное" }).click();
  await expect(page.locator("[data-pending]")).toContainText("3 шт.");
  await expect(page.locator("#sendButton")).toBeEnabled();
  await page
    .locator("[data-pending]")
    .getByRole("button", { name: "Да, добавить", exact: true })
    .click();
  await expect(page.locator("#cartCount")).toHaveText("3");
  expect(confirmations).toBe(1);
  expect(await page.locator('[role="dialog"]').count()).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await review.getByRole("button", { name: "Уточнить позицию 4" }).click();
  await expect(page.getByRole("textbox", { name: "Сообщение" })).toHaveValue(
    "Уточнение для Без количества: ",
  );
  await page.locator("#prompt").blur();
  await review.getByRole("heading", { name: "Проверка спецификации" }).scrollIntoViewIfNeeded();
  await page
    .locator("#chat")
    .screenshot({ path: test.info().outputPath("specification-review.png") });
});
