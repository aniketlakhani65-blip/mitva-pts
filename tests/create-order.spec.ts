import { test, expect } from "@playwright/test";

/**
 * Order creation wizard — the highest-frequency write path.
 * The test walks through all 5 steps and asserts the success page.
 */

test.describe("Create order wizard", () => {
  test("creates an order with an existing customer end-to-end", async ({ page }) => {
    const uniqueDesc = `Test ring ${Date.now()}`;

    await page.goto("/orders/new");
    await expect(page.getByRole("heading", { name: /new order/i })).toBeVisible();

    // Step 1: Customer — default is "Existing customer" with first seeded customer selected
    await expect(page.getByText("Customer", { exact: true })).toBeVisible();
    // Select is populated by seed data; ensure an option is chosen (first non-empty)
    const customerSelect = page.locator("select").first();
    const options = await customerSelect.locator("option").allTextContents();
    const firstReal = options.find((o) => o && !/select/i.test(o));
    expect(firstReal).toBeTruthy();
    await customerSelect.selectOption({ label: firstReal! });
    await page.getByRole("button", { name: /continue/i }).click();

    // Step 2: Item
    await page.getByLabel(/item description/i).fill(uniqueDesc);
    await page.getByLabel(/size/i).fill("US 7");
    await page.getByLabel(/gross weight estimate/i).fill("5.250");
    await page.getByRole("button", { name: /continue/i }).click();

    // Step 3: Stones — add one stone
    await page.getByRole("button", { name: /add stone/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Step 4: Commercial
    await page.getByLabel(/quoted price/i).fill("50000");
    await page.getByLabel(/advance paid/i).fill("10000");
    await page.getByRole("button", { name: /continue/i }).click();

    // Step 5: Review — verify the item description we entered shows up
    await expect(page.getByText(uniqueDesc)).toBeVisible();
    await page.getByRole("button", { name: /create order/i }).click();

    // Success — redirected to /orders/[id]?created=1
    await expect(page).toHaveURL(/\/orders\/[^/?]+\?created=1/);
    await expect(page.getByText(/order created successfully/i)).toBeVisible();
    await expect(page.getByText(uniqueDesc)).toBeVisible();

    // Job number is shown in the success banner in YYMM-NNNN format
    await expect(page.locator("code").filter({ hasText: /^\d{4}-\d{4}$/ }).first()).toBeVisible();
  });

  test("blocks continuing past Item step when required fields are empty", async ({ page }) => {
    await page.goto("/orders/new");
    // Step 1 → Step 2
    await page.getByRole("button", { name: /continue/i }).click();
    // Step 2 without filling anything
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page.getByText(/describe the item/i)).toBeVisible();
  });
});
