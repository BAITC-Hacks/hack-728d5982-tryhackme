import { test, expect } from "@playwright/test";

test("Next API proxy preserves session, CSRF and browser origin checks", async ({
  page,
  playwright,
  baseURL,
}) => {
  await page.goto("/");
  await expect(page.locator("#modeBanner")).toContainText("ИИ подключён");
  const session = await (await page.request.get("/api/session")).json();
  const origin = new URL(baseURL!).origin;
  let result = await page.request.post("/api/cart/cancel", {
    headers: {
      Origin: "https://foreign.invalid",
      "X-Forwarded-Host": "foreign.invalid",
      "X-CSRF-Token": session.csrf,
    },
    data: {},
  });
  expect(result.status()).toBe(403);
  result = await page.request.post("/api/cart/cancel", { headers: { Origin: origin }, data: {} });
  expect(result.status()).toBe(403);
  result = await page.request.post("/api/cart/cancel", {
    headers: { Origin: origin, "X-CSRF-Token": session.csrf },
    data: {},
  });
  expect(result.ok(), await result.text()).toBe(true);
  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === "ekt_session")).toMatchObject({
    httpOnly: true,
    sameSite: "Strict",
  });
  const stranger = await playwright.request.newContext({ baseURL });
  expect((await stranger.get("/api/cart")).status()).toBe(401);
  await stranger.get("/api/session");
  result = await stranger.post("/api/cart/cancel", {
    headers: { "X-CSRF-Token": session.csrf },
    data: {},
  });
  expect(result.status()).toBe(403);
  await stranger.dispose();
  expect((await (await page.request.get("/api/cart")).json()).count).toBe(0);
});
