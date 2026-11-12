import { expect, test } from "@playwright/test";

test("the test recruitment adds a playable engineer without processing a payment", async ({ page }, info) => {
  if (info.project.name !== "desktop") test.skip();
  await page.goto("/?seed=recruit-ui&scen=lone");
  await page.waitForFunction(() => (window as any).__game?.ready === true);
  await page.evaluate(() => (window as any).__game.pause());
  expect(await page.evaluate(() => [...(window as any).__game.game.pawns.values()].filter((p: any) => p.faction === "colony" && !p.robot).length)).toBe(1);

  await page.getByTestId("recruit-open").click();
  await expect(page.getByTestId("recruit-modal")).toContainText("Modo de prueba");
  await expect(page.getByTestId("recruit-explorer")).toContainText("Astronauta Explorador ($2 USDT)");
  await expect(page.getByTestId("recruit-engineer")).toContainText("Ingeniero Robótico ($5 USDT)");
  await page.getByTestId("recruit-engineer").click();
  await page.getByTestId("recruit-simulate-payment").click();

  await expect(page.getByTestId("recruit-modal")).toBeHidden();
  expect(await page.evaluate(() => [...(window as any).__game.game.pawns.values()].filter((p: any) => p.faction === "colony" && !p.robot).length)).toBe(2);
  await expect(page.getByTestId("space-mission-titanium")).toHaveCount(1);
});
