import { test, expect } from "@playwright/test";

test.describe("Asset detail — accessibility", () => {
  test("shows the selected asset with landmarks and active navigation", async ({ page }) => {
    await page.goto("/assets");

    const firstAssetLink = page
      .getByRole("table")
      .getByRole("row")
      .nth(1)
      .getByRole("link")
      .first();
    const assetTag = (await firstAssetLink.textContent())?.trim();
    await firstAssetLink.click();

    await expect(page.getByRole("heading", { name: assetTag })).toBeVisible();
    await expect(page.getByRole("navigation")).toBeVisible();
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    await expect(
      page.getByRole("navigation").getByRole("link", { name: "Assets" })
    ).toHaveAttribute("aria-current", "page");
  });
});
