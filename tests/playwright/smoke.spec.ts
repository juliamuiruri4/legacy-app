import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("dashboard loads with AssetTrack title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/AssetTrack/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  test("navbar contains all primary links", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation");
    await expect(nav.getByRole("link", { name: "Assets" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Employees" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Assignments" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Reports" })).toBeVisible();
  });

  test("Assets link navigates to /assets", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation").getByRole("link", { name: "Assets" }).click();
    await expect(page).toHaveURL(/\/assets/);
    await expect(page).toHaveTitle(/AssetTrack/);
  });

  test("Employees link navigates to /employees", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation").getByRole("link", { name: "Employees" }).click();
    await expect(page).toHaveURL(/\/employees/);
    await expect(page).toHaveTitle(/AssetTrack/);
  });
});
