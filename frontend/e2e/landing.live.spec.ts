import { test, expect, type Page } from "@playwright/test";

// Opt in: these tests use the configured OpenAI key and real read-only ekt API.
async function ask(page: Page, text: string) {
  await page.getByRole("textbox", { name: "Сообщение" }).fill(text);
  const reply = page.waitForResponse(
    (r) => r.url().endsWith("/api/chat") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Отправить", exact: true }).click();
  const response = await reply;
  expect(response.ok(), await response.text()).toBe(true);
  await expect(page.locator("#sendButton")).toBeEnabled();
  return response.json();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#modeBanner")).toContainText("ИИ подключён");
  await expect(page.locator("#modeBanner")).toContainText("каталог ekt.kz");
});

test("live UC-01…05: facts, absent product, terms, consent, persistent cart URL", async ({
  page,
}) => {
  const catalogueResponse = await page.request.get("/api/catalog/detail?id=515280");
  expect(catalogueResponse.ok(), await catalogueResponse.text()).toBe(true);
  const facts = await catalogueResponse.json();
  const firstResponse = page.waitForResponse(
    (r) => r.url().endsWith("/api/chat") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Проверить пример 027005 ↗", exact: true }).click();
  const response = await firstResponse;
  expect(response.ok(), await response.text()).toBe(true);
  let reply = await response.json();
  await expect(page.locator("#sendButton")).toBeEnabled();
  expect(reply.products[0].id).toBe(facts.id);
  expect(reply.products[0].quantity).toBe(facts.quantity);
  expect(reply.products[0].properties).toEqual(facts.properties);
  await expect(page.getByRole("dialog")).toContainText(facts.article);
  await expect(page.getByRole("dialog")).toContainText(`${facts.quantity} шт.`);
  if (!reply.products[0].certificates.length) {
    await expect(page.getByRole("dialog")).toContainText("Сертификат не указан");
  }

  reply = await ask(page, "Есть ли артикул ярп4520 в наличии?");
  expect(reply.products[0].quantity).toBe(0);
  expect(reply.alternatives.length).toBeGreaterThan(0);
  expect(reply.alternatives[0].product.quantity).toBeGreaterThan(0);
  await expect(page.getByRole("dialog")).toContainText(reply.alternatives[0].reason);

  reply = await ask(page, "Есть ли артикул 310100080_ в наличии?");
  expect(reply.products[0].quantity).toBe(0);
  expect(reply.alternatives.length).toBeGreaterThan(0);
  expect(
    reply.alternatives.every(
      (a: { product: { quantity: number }; reason: string }) =>
        a.product.quantity > 0 && a.reason.length > 0,
    ),
  ).toBe(true);

  reply = await ask(page, "Как оплатить, получить доставку и какая минимальная партия?");
  expect(reply.terms.source).toBe("https://ekt.kz/checkout-delivery/");
  await expect(page.getByRole("dialog")).toContainText(reply.terms.minimum);
  await expect(page.locator(".purchase-terms section")).toHaveCount(3);
  expect(await page.locator(".purchase-terms li").count()).toBeGreaterThan(4);

  await ask(page, "Добавь 2 шт 027005");
  await expect(page.locator("[data-pending]")).toContainText("2 шт.");
  await expect(page.locator("#cartCount")).toHaveText("0");
  await ask(page, "ок");
  await expect(page.locator("#cartCount")).toHaveText("0");
  await page
    .locator("[data-pending]")
    .getByRole("button", { name: "Да, добавить", exact: true })
    .click();
  await expect(page.locator("#cartCount")).toHaveText("2");
  await page.getByRole("link", { name: "Открыть корзину →", exact: true }).last().click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.locator("#cartSummary")).toContainText(facts.article);
  await expect(page.locator("#cartSummary")).toContainText("2 шт.");
  await page.reload();
  await expect(page.locator("#cartSummary")).toContainText("2 шт.");
  await expect(page.locator("#cartSummary .cart-row")).toBeInViewport();
  await ask(page, "Расскажи об оплате и доставке");
  await page.getByRole("button", { name: "Показать корзину" }).click();
  await expect(page.locator("#cartSummary .cart-row")).toBeInViewport();
  await expect(page.locator("#cartSummary")).toBeFocused();
  await ask(page, "Покажи мою корзину");
  await expect(page.locator("#cartSummary .cart-row")).toBeInViewport();
  await page.getByRole("button", { name: "Удалить позицию…" }).click();
  await expect(page.locator("[data-pending]")).toContainText("Подтвердите удаление");
  await expect(page.locator("#cartCount")).toHaveText("2");
  await page.locator("[data-pending]").getByRole("button", { name: "Отмена", exact: true }).click();
  await expect(page.locator("#sendButton")).toBeEnabled();
  await expect(page.locator("#cartCount")).toHaveText("2");
  await page.getByRole("button", { name: "Показать корзину" }).click();
  await page.getByRole("button", { name: "Удалить позицию…" }).click();
  await page
    .locator("[data-pending]")
    .getByRole("button", { name: "Да, удалить", exact: true })
    .click();
  await expect(page.locator("#cartCount")).toHaveText("0");
  await page.getByRole("button", { name: "Показать корзину" }).click();
  await expect(page.locator("#cartSummary")).toContainText("Пока пусто");
  expect(await page.locator('[role="dialog"]').count()).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("live specification: two verified rows, batch proposal, separate consent and cart", async ({
  page,
}) => {
  const picker = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Прикрепить спецификацию ↗", exact: true }).click();
  await (await picker).setFiles("../out/inputs/specification.xlsx");
  await expect(page.locator("#attachments")).toContainText("specification.xlsx");
  await expect(page.locator(".message.user")).toHaveCount(0);
  await expect(page.locator("#cartCount")).toHaveText("0");
  const reply = await ask(page, "Найди все товары и количества из спецификации");
  expect(reply.review).toHaveLength(2);
  expect(reply.review.map((r: { status: string }) => r.status)).toEqual(["ready", "ready"]);
  expect(
    reply.review.map((r: { product_id: number; quantity: number }) => [r.product_id, r.quantity]),
  ).toEqual([
    [515280, 2],
    [515281, 1],
  ]);
  expect(reply.proposal).toBeNull();
  const review = page.locator(".spec-review");
  await expect(review).toContainText("Требуют уточнения: 0");
  await expect(review).toContainText("200300274_");
  await expect(review).toContainText("200300275_");
  await expect(page.locator("#cartCount")).toHaveText("0");
  await review.getByRole("button", { name: "Проверить выбранное" }).click();
  await expect(page.locator("[data-pending]")).toContainText("2 шт.");
  await expect(page.locator("[data-pending]")).toContainText("1 шт.");
  await expect(page.locator("#cartCount")).toHaveText("0");
  await expect(page.locator("#sendButton")).toBeEnabled();
  await ask(page, "ок");
  await expect(page.locator("#cartCount")).toHaveText("0");
  await page
    .locator("[data-pending]")
    .getByRole("button", { name: "Да, добавить", exact: true })
    .click();
  await expect(page.locator("#cartCount")).toHaveText("3");
  await page.getByRole("link", { name: "Открыть корзину →", exact: true }).last().click();
  await expect(page.locator("#cartSummary .cart-row")).toHaveCount(2);
  await expect(page.locator("#cartSummary")).toContainText("200300274_");
  await expect(page.locator("#cartSummary")).toContainText("200300275_");
  const cart = await (await page.request.get("/api/cart")).json();
  expect(
    cart.items.map((r: { product_id: number; quantity: number }) => [r.product_id, r.quantity]),
  ).toEqual([
    [515280, 2],
    [515281, 1],
  ]);
  await page.reload();
  await expect(page.locator("#cartSummary .cart-row")).toHaveCount(2);
});
