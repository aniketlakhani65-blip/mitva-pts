import { test, expect } from "@playwright/test";

/**
 * Dashboard smoke test — asserts the operational dashboard renders the core
 * KPI surfaces and the by-stage grid is populated from seed data.
 *
 * This is intentionally a smoke test (visibility + navigation) rather than an
 * exact-count test: real data flowing through the system will change numbers,
 * but the sections themselves should remain stable.
 */

test.describe("Operational dashboard", () => {
  test("renders KPI cards, by-stage grid, and navigates into a department queue", async ({ page }) => {
    await page.goto("/");

    // App header
    await expect(page.getByRole("heading", { name: "Mitva PTS" })).toBeVisible();

    // KPI row — at least these four headline metrics must be present
    await expect(page.getByText(/live orders/i).first()).toBeVisible();
    await expect(page.getByText(/overdue/i).first()).toBeVisible();
    await expect(page.getByText(/due in 7 days/i).first()).toBeVisible();
    await expect(page.getByText(/ready for dispatch/i).first()).toBeVisible();

    // Live-by-stage section renders stages seeded in the DB.
    // "CAD Designing" is the first manufacturing stage after Order Booking in the seed.
    const byStage = page.getByRole("heading", { name: /live orders by stage/i }).locator("..");
    await expect(byStage).toBeVisible();
    await expect(byStage.getByText(/cad designing/i).first()).toBeVisible();

    // Clicking a stage card should deep-link into the stage-update queue filtered by department.
    await byStage.getByText(/cad designing/i).first().click();
    await expect(page).toHaveURL(/\/stage-update(\?|$)/);
  });
});
