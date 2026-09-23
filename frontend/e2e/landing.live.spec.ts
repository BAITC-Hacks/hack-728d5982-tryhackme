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
  await page.getByRole("button", { name: "Открыть чат", exact: true }).click();
});

test("live UC-01…05: facts, absent product, terms, consent, persistent cart URL", async ({
  page,
}) => {
  const facts = await (
    await page.request.get("/api/catalog/detail?id=515280")
  ).json();
  let reply = await ask(
    page,
    "Есть ли 027005? Покажи характеристики и сертификат.",
  );
  expect(reply.products[0].id).toBe(facts.id);
  expect(reply.products[0].quantity).toBe(facts.quantity);
  expect(reply.products[0].properties).toEqual(facts.properties);
  await expect(page.getByRole("dialog")).toContainText(facts.article);
  await expect(page.getByRole("dialog")).toContainText(`${facts.quantity} шт.`);
  if (!reply.products[0].certificates.length) {
    await expect(page.getByRole("dialog")).toContainText(
      "Сертификат не указан",
    );
  }

  reply = await ask(
    page,
    "Есть ли артикул ярп4520? Если нет, предложи аналог.",
  );
  expect(reply.products[0].quantity).toBe(0);
  expect(reply.alternatives.length).toBeGreaterThan(0);
  expect(reply.alternatives[0].product.quantity).toBeGreaterThan(0);
  await expect(page.getByRole("dialog")).toContainText(
    reply.alternatives[0].reason,
  );

  reply = await ask(
    page,
    "Как оплатить, получить доставку и какая минимальная партия?",
  );
  expect(reply.terms.source).toBe("https://ekt.kz/checkout-delivery/");
  await expect(page.getByRole("dialog")).toContainText(reply.terms.minimum);

  await ask(page, "Добавь 2 шт 027005");
  await expect(page.locator("[data-pending]")).toContainText("2 шт.");
  await expect(page.locator("#cartCount")).toHaveText("0");
  await ask(page, "ок");
  await expect(page.locator("#cartCount")).toHaveText("0");
  await page.getByRole("button", { name: "Да, добавить", exact: true }).click();
  await expect(page.locator("#cartCount")).toHaveText("2");
  await page
    .getByRole("link", { name: "Открыть корзину →", exact: true })
    .last()
    .click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.locator("#cartSummary")).toContainText(facts.article);
  await expect(page.locator("#cartSummary")).toContainText("2 шт.");
  await page.reload();
  await expect(page.locator("#cartSummary")).toContainText("2 шт.");
  expect(await page.locator('[role="dialog"]').count()).toBe(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("live attachment: extracted article resolves to verified product, never consent", async ({
  page,
}) => {
  await page.locator("#fileInput").setInputFiles({
    name: "spec.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Артикул,Количество\n027228,2\n"),
  });
  await expect(page.locator("#attachments")).toContainText("spec.csv");
  const reply = await ask(page, "Найди товары из спецификации");
  expect(reply.products.some((p: { id: number }) => p.id === 515291)).toBe(
    true,
  );
  await expect(page.getByRole("dialog")).toContainText(
    "Распознано во вложении",
  );
  await expect(page.getByRole("dialog")).toContainText("200300285_");
  await expect(page.locator("#cartCount")).toHaveText("0");
});
