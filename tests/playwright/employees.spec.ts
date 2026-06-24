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

  test.describe("Employee detail — accessibility", () => {
    test("shows the selected employee with landmarks and active navigation", async ({ page }) => {
      await page.goto("/employees");

      const firstNameLink = page
        .getByRole("table")
        .getByRole("row")
        .nth(1)
        .getByRole("link")
        .first();
      await expect(firstNameLink).toBeVisible();
      const employeeName = (await firstNameLink.textContent())?.trim();
      expect(employeeName, "Expected first employee link to have text").toBeTruthy();
      await firstNameLink.click();

      await expect(page.getByRole("heading", { name: employeeName! })).toBeVisible();
      await expect(page.getByRole("navigation")).toBeVisible();
      await expect(page.getByRole("main")).toBeVisible();
      await expect(page.getByRole("contentinfo")).toBeVisible();
      await expect(
        page.getByRole("navigation").getByRole("link", { name: "Employees" })
      ).toHaveAttribute("aria-current", "page");
    });
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
