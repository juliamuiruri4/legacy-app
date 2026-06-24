import { test, expect } from "@playwright/test";

test.describe("Employees list — happy path", () => {
  test("renders heading and table column headers", async ({ page }) => {
    await page.goto("/employees");
    await expect(page.getByRole("heading", { name: "Employees" })).toBeVisible();
    const table = page.getByRole("table");
    await expect(table.getByText("Name", { exact: true })).toBeVisible();
    await expect(table.getByText("Email", { exact: true })).toBeVisible();
    await expect(table.getByText("Department", { exact: true })).toBeVisible();
    await expect(table.getByText("Title", { exact: true })).toBeVisible();
    await expect(table.getByText("Status", { exact: true })).toBeVisible();
  });

  test("table contains at least one data row", async ({ page }) => {
    await page.goto("/employees");
    const rowCount = await page.getByRole("table").getByRole("row").count();
    expect(rowCount).toBeGreaterThan(1);
  });

  test("each employee row links to their detail page", async ({ page }) => {
    await page.goto("/employees");
    const firstNameLink = page
      .getByRole("table")
      .getByRole("row")
      .nth(1)
      .getByRole("link")
      .first();
    await expect(firstNameLink).toHaveAttribute("href", /\/employees\/\d+/);
  });

  test("Department filter control is reachable by its visible label", async ({ page }) => {
    await page.goto("/employees");
    await expect(page.getByLabel("Department")).toBeVisible();
  });

  test("Active only checkbox is connected to its label", async ({ page }) => {
    await page.goto("/employees");
    await expect(page.getByLabel("Active only")).toBeVisible();
  });

  test("Filter button submits the filter form", async ({ page }) => {
    await page.goto("/employees");
    await page.getByLabel("Department").selectOption("Engineering");
    await page.getByRole("button", { name: "Filter" }).click();
    await expect(page).toHaveURL(/department=Engineering/);
  });
});
