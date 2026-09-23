import { test, expect } from "@playwright/test";

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
