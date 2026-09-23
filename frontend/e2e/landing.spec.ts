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
