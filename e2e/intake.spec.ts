import { expect, test } from "@playwright/test";

/**
 * spec/14 M4: a student completes intake on a 360 px phone in under 3 minutes, with the network
 * off for steps 2–4 and back on before submit. Steps 2–4 must work from what is already loaded.
 */
test("student intake at 360px, offline from step 2 until submit, under 3 minutes", async ({ page, context }) => {
  const started = Date.now();
  await page.goto("/join/student");
  const next = page.getByRole("button", { name: "Next", exact: true });

  // Step 1: About you
  await expect(page.getByRole("heading", { name: "About you" })).toBeVisible();
  const formShown = Date.now(); // the form stamps its start time when it loads
  await page.getByLabel("First name").fill("Tolu");
  await page.getByLabel("Surname").fill("E2E-Adeyemi");
  for (let i = 0; i < 2; i++) await page.getByRole("button", { name: "+1" }).click(); // 13 → 14
  await page.getByRole("radio", { name: "Girl", exact: true }).click();
  await page.getByRole("radio", { name: "JSS3", exact: true }).click();
  await page.getByRole("radio", { name: "Oyo", exact: true }).click();
  await page.getByPlaceholder(/Type at least 2 letters/).fill("Demo Gram");
  await page.getByRole("button", { name: /Demo Grammar School/ }).click();
  await expect(page.getByText("Demo Grammar School")).toBeVisible();
  await next.click();

  // Steps 2–4 with the network off
  await expect(page.getByRole("heading", { name: "Your dreams" })).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByRole("status").filter({ hasText: /offline|connection/i })).toBeVisible();

  await page.getByLabel("When I grow up, I want to be…").fill("Engineer");
  await page.getByRole("group", { name: "I'm excited about" }).first().getByRole("checkbox").first().click();
  await page.getByRole("group", { name: "Which programme would you like to join?" }).getByRole("checkbox").first().click();
  await next.click();

  await expect(page.getByRole("heading", { name: "Where you'd like help" })).toBeVisible();
  await page.getByRole("group", { name: "I'd love help with" }).first().getByRole("checkbox").first().click();
  await page.getByRole("radiogroup", { name: "Do you use a phone?" }).getByRole("radio").first().click();
  await next.click();

  await expect(page.getByRole("heading", { name: "Staying in touch" })).toBeVisible();
  await page.getByLabel("Parent or guardian's name").fill("Mrs Adeyemi");
  await page.getByLabel("Their relationship to me").selectOption({ index: 1 });
  await page.getByLabel("Their phone number").fill("0803 555 0199");
  await page.getByRole("radiogroup", { name: "Pick your picture" }).getByRole("radio").first().click();
  await next.click();

  await expect(page.getByRole("heading", { name: "Quick check-in" })).toBeVisible();
  for (let q = 1; q <= 5; q++) {
    await page.getByRole("radiogroup").last().getByRole("radio").nth(3).click();
    await page.waitForTimeout(350); // the scale moves on by itself after 220 ms
  }
  await page.getByRole("checkbox").check();

  // The server refuses forms filled in under 20 s (a bot check); a real student is slower than this script.
  const wait = 22_000 - (Date.now() - formShown);
  if (wait > 0) await page.waitForTimeout(wait);
  // Back online before submit
  await context.setOffline(false);
  await expect(page.getByText("You're offline")).toBeHidden();
  await page.getByRole("button", { name: "Send my answers" }).click();

  await expect(page.getByRole("status").filter({ hasText: "Thank you, Tolu." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remind my guardian" })).toBeVisible();
  expect(Date.now() - started).toBeLessThan(3 * 60_000);
});
