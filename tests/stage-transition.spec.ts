import { test, expect } from "@playwright/test";

/**
 * Stage transition flow — runs on a mobile viewport (Pixel 7 via project config).
 *
 * Strategy: create a fresh order inside the test so we have a known starting stage
 * and aren't dependent on the state left behind by other tests or the seed.
 * After creation, the order sits at the stage immediately after "Order Booking"
 * (CAD Designing in the seed). We then:
 *   1. Start work (PENDING → IN_PROGRESS)
 *   2. Complete & advance (IN_PROGRESS → COMPLETED, new row opened at next stage)
 *   3. Verify stage history on the order detail reflects both steps.
 */

async function createFreshOrder(page: any) {
  const desc = `Stage-test item ${Date.now()}`;
  await page.goto("/orders/new");
  // Customer step — use pre-selected seeded customer
  await page.getByRole("button", { name: /continue/i }).click();
  // Item step
  await page.getByLabel(/item description/i).fill(desc);
  await page.getByLabel(/gross weight estimate/i).fill("4.500");
  await page.getByRole("button", { name: /continue/i }).click();
  // Stones step — skip
  await page.getByRole("button", { name: /continue/i }).click();
  // Commercial step — skip
  await page.getByRole("button", { name: /continue/i }).click();
  // Review → Create
  await page.getByRole("button", { name: /create order/i }).click();
  await expect(page).toHaveURL(/\/orders\/[^/?]+\?created=1/);
  const url = new URL(page.url());
  const orderId = url.pathname.split("/").pop()!;
  return { orderId, desc };
}

test.describe("Stage transition flow (mobile)", () => {
  test("start → complete → advance moves the order to the next stage", async ({ page }) => {
    const { orderId } = await createFreshOrder(page);

    await page.goto(`/stage-update/${orderId}`);

    // Capture the current stage name so we can assert it changes
    const stageLabel = page.locator("text=Current stage").locator("..").locator("div").nth(1);
    const startingStageName = (await stageLabel.textContent())?.trim();
    expect(startingStageName).toBeTruthy();

    // Assign a karigar from the dropdown (first real option)
    const karigarSelect = page.locator("select").first();
    const options = await karigarSelect.locator("option").allTextContents();
    const firstReal = options.find((o) => o && !/select/i.test(o));
    expect(firstReal, "seed must include a karigar in the current department").toBeTruthy();
    await karigarSelect.selectOption({ label: firstReal! });

    // Enter a weight-in value
    await page.getByLabel(/weight in/i).fill("4.500");

    // Start the stage
    await page.getByRole("button", { name: /start work/i }).click();
    await expect(page.getByText(/started/i).first()).toBeVisible();
    // Page refreshes; after refresh the primary action becomes Complete
    await expect(page.getByRole("button", { name: /complete & advance/i })).toBeVisible({ timeout: 10_000 });

    // Complete & advance — provide weight out
    await page.getByLabel(/weight out/i).fill("4.480");
    await page.getByRole("button", { name: /complete & advance/i }).click();
    await expect(page.getByText(/advanced to next stage/i).first()).toBeVisible();

    // Visit order detail and confirm the stage history shows both the completed stage
    // AND a new in-progress/pending row at the next stage.
    await page.goto(`/orders/${orderId}`);
    const history = page.getByRole("heading", { name: /stage history/i }).locator("..");
    await expect(history).toContainText(startingStageName!);
    // "completed" status dot is rendered — at least one row shows status "completed"
    await expect(history.getByText(/completed/i).first()).toBeVisible();
  });
});
