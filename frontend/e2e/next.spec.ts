import { test, expect } from "@playwright/test";

test("chat contrast: readable product facts, inputs and consent", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Начать разговор" }).click();
  await page.getByRole("textbox", { name: "Сообщение" }).fill("Есть ли 027228 в наличии?");
  await page.getByRole("button", { name: "Отправить", exact: true }).click();
  await expect(page.locator(".product-card").last()).toContainText("200300285_");
  await page
    .locator(".product-card")
    .last()
    .getByRole("button", { name: "В корзину", exact: true })
    .click();
  await expect(page.locator("[data-pending]")).toContainText("Подтвердите добавление");
  const selectors = [
    ".product-meta h3",
    ".product-meta small",
    ".product-price",
    ".specs dt",
    ".specs dd",
    ".source-note",
    ".warning",
    ".stock",
    ".message.user",
    ".consent b",
    ".consent .muted",
    ".chip",
    ".consent .button",
    "#prompt",
    "#sendButton",
  ];
  for (const selector of selectors) {
    const element = page.locator(`.assistant-widget ${selector}`).last();
    await expect(element).toBeAttached();
    const ratio = await element.evaluate((el) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext("2d")!;
      function rgba(color: string) {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        return Array.from(ctx.getImageData(0, 0, 1, 1).data);
      }
      function luminance(rgb: number[]) {
        return rgb
          .slice(0, 3)
          .map((x) => {
            const c = x / 255;
            return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          })
          .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i]!, 0);
      }
      let surface: Element | null = el;
      let bg = [0, 0, 0, 0];
      while (surface && bg[3] === 0) {
        bg = rgba(getComputedStyle(surface).backgroundColor);
        surface = surface.parentElement;
      }
      const fg = luminance(rgba(getComputedStyle(el).color));
      const back = luminance(bg);
      return (Math.max(fg, back) + 0.05) / (Math.min(fg, back) + 0.05);
    });
    expect(ratio, `${selector}: text/background contrast`).toBeGreaterThanOrEqual(4.5);
  }
  await page.locator(".product-card").last().scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath("chat-product-contrast.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(
    await page
      .locator(".product-card")
      .last()
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await expect(page.locator("#cartCount")).toHaveText("0");
});

test("Next landing: RGB accents, one chat and reduced motion", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-assistant-ready", "true");
  await expect(page.locator("h1")).toContainText("корзине");
  expect(await page.locator("iframe").count()).toBe(0);
  await expect(page.getByRole("button", { name: "Начать разговор" })).toBeEnabled();
  await page.screenshot({ path: test.info().outputPath("next-landing.png"), fullPage: true });
  await page.getByRole("button", { name: "Начать разговор" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Сообщение" })).toBeFocused();
  await page.locator(".chat-help [data-manager]").click();
  await expect(page.locator(".manager-panel")).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("next-manager.png") });
  await expect(page.getByRole("dialog")).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page.locator(".circuit-travel").evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  expect(errors).toEqual([]);
});
