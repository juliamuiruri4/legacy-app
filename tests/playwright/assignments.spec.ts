import { test, expect } from "@playwright/test";

test.describe("Assignments page — accessibility", () => {
  test("loads with landmarks and active navigation", async ({ page }) => {
    await page.goto("/assignments");

    await expect(page.getByRole("heading", { name: "Assignments" })).toBeVisible();
    await expect(page.getByRole("navigation")).toBeVisible();
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    await expect(
      page.getByRole("navigation").getByRole("link", { name: "Assignments" })
    ).toHaveAttribute("aria-current", "page");
  });
});
