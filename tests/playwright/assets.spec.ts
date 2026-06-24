import { test, expect } from "@playwright/test";

test.describe("Assets list — happy path", () => {
  test("renders heading and table column headers", async ({ page }) => {
    await page.goto("/assets");
    await expect(page.getByRole("heading", { name: "Assets" })).toBeVisible();
    const table = page.getByRole("table");
    await expect(table.getByText("Tag", { exact: true })).toBeVisible();
    await expect(table.getByText("Type", { exact: true })).toBeVisible();
    await expect(table.getByText("Make / Model", { exact: true })).toBeVisible();
    await expect(table.getByText("Serial", { exact: true })).toBeVisible();
    await expect(table.getByText("Status", { exact: true })).toBeVisible();
  });

  test("table contains at least one data row", async ({ page }) => {
    await page.goto("/assets");
    // All rows including header; at least 2 means at least one data row
    const rowCount = await page.getByRole("table").getByRole("row").count();
    expect(rowCount).toBeGreaterThan(1);
  });

  test("New asset button links to /assets/new", async ({ page }) => {
    await page.goto("/assets");
    await expect(page.getByRole("link", { name: "+ New asset" })).toHaveAttribute(
      "href",
      "/assets/new"
    );
  });
});

test.describe("Assets list — filter round trip", () => {
  test("Status filter limits the visible badges and updates the URL", async ({ page }) => {
    await page.goto("/assets");

    await page.getByLabel("Status").selectOption("available");
    await page.getByRole("button", { name: "Filter" }).click();

    await expect(page).toHaveURL(/status=available/);
    const availableBadges = page.getByRole("table").getByText("available", { exact: true });
    expect(await availableBadges.count()).toBeGreaterThan(0);
    await expect(page.getByRole("table").getByText("assigned", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("table").getByText("retired", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("table").getByText("lost", { exact: true })).toHaveCount(0);
  });

  test("Search filter and Clear link round-trip through the URL", async ({ page }) => {
    await page.goto("/assets");

    await page.getByLabel("Search tag / manufacturer / model").fill("Contoso");
    await page.getByRole("button", { name: "Filter" }).click();

    await expect(page).toHaveURL(/q=Contoso/);
    await page.getByRole("link", { name: "Clear" }).click();
    await expect(page).toHaveURL(/\/assets$/);
  });
});

// Exercise #8 — these tests document the CORRECT badge-color contract.
// Locators are scoped to getByRole("table") so they resolve to the badge <span>
// inside a table cell, not to a same-text <option> in the Status filter dropdown.
test.describe("Assets list — status badge colors (Exercise #8)", () => {
  test("'available' badge carries the success variant", async ({ page }) => {
    await page.goto("/assets?status=available");
    const badge = page.getByRole("table").getByText("available").first();
    await expect(badge).toHaveClass(/bg-success/);
  });

  test("'assigned' badge carries the primary variant", async ({ page }) => {
    await page.goto("/assets?status=assigned");
    const badge = page.getByRole("table").getByText("assigned").first();
    await expect(badge).toHaveClass(/bg-primary/);
  });

  test("'retired' badge carries the secondary (gray) variant, not success", async ({ page }) => {
    await page.goto("/assets?status=retired");
    const badge = page.getByRole("table").getByText("retired").first();
    await expect(badge).toHaveClass(/bg-secondary/);
    await expect(badge).not.toHaveClass(/bg-success/);
  });

  test("'lost' badge carries the danger (red) variant, not primary", async ({ page }) => {
    await page.goto("/assets?status=lost");
    const badge = page.getByRole("table").getByText("lost").first();
    await expect(badge).toHaveClass(/bg-danger/);
    await expect(badge).not.toHaveClass(/bg-primary/);
  });
});

test.describe("Add asset form — happy path", () => {
  test("renders heading, all labelled controls, and action buttons", async ({ page }) => {
    await page.goto("/assets/new");
    await expect(page.getByRole("heading", { name: "New asset" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Cancel" })).toBeVisible();
  });

  test("all form controls are reachable by their visible labels (Exercise #7)", async ({
    page,
  }) => {
    await page.goto("/assets/new");
    await expect(page.getByLabel("Asset tag")).toBeVisible();
    await expect(page.getByLabel("Type")).toBeVisible();
    await expect(page.getByLabel("Manufacturer")).toBeVisible();
    await expect(page.getByLabel("Model")).toBeVisible();
    await expect(page.getByLabel("Serial number")).toBeVisible();
    await expect(page.getByLabel("Status")).toBeVisible();
    await expect(page.getByLabel("Purchase date")).toBeVisible();
    await expect(page.getByLabel("Warranty expiry")).toBeVisible();
    await expect(page.getByLabel("Notes")).toBeVisible();
  });

  test("Cancel link returns to /assets", async ({ page }) => {
    await page.goto("/assets/new");
    await page.getByRole("link", { name: "Cancel" }).click();
    await expect(page).toHaveURL(/\/assets$/);
  });
});
