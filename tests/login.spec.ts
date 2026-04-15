import { test, expect } from "@playwright/test";

/**
 * Login flow — covers the single most critical gate in the app.
 * These tests bypass the shared auth state by clearing it per test.
 */

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Login", () => {
  test("rejects wrong password and shows an error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("admin@mitva.local");
    await page.getByLabel("Password").fill("not-the-right-password");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("logs in with correct credentials and lands on the dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("admin@mitva.local");
    await page.getByLabel("Password").fill("admin123");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.getByRole("heading", { name: "Mitva PTS" })).toBeVisible();
    // KPI card should be visible on dashboard
    await expect(page.getByText(/live orders/i).first()).toBeVisible();
  });
});
