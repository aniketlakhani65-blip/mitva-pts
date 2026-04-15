import { test as setup, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

/**
 * Logs in as the seeded admin user and persists cookies for all subsequent tests.
 * The resulting storageState is reused by the "desktop" and "mobile" projects.
 */
const authDir = path.join(__dirname, ".auth");
const userFile = path.join(authDir, "user.json");

setup("authenticate as admin", async ({ page }) => {
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@mitva.local");
  await page.getByLabel("Password").fill("admin123");
  await page.getByRole("button", { name: /sign in/i }).click();

  // Dashboard header appears after a successful login
  await expect(page.getByRole("heading", { name: "Mitva PTS" })).toBeVisible();

  await page.context().storageState({ path: userFile });
});
