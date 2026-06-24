import { test, expect } from "@playwright/test";

test.describe("Reports page — accessibility", () => {
  test("loads with landmarks and active navigation", async ({ page }) => {
    await page.goto("/reports");

    await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
    await expect(page.getByRole("navigation")).toBeVisible();
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    await expect(
      page.getByRole("navigation").getByRole("link", { name: "Reports" })
    ).toHaveAttribute("aria-current", "page");
  });
});
