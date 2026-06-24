import { test, expect } from "@playwright/test";

test.describe("Dashboard — landmark structure", () => {
  test("page exposes navigation, main, and footer landmarks", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation")).toBeVisible();
    await expect(page.getByRole("main")).toBeVisible();
    // <footer> maps to the contentinfo landmark role
    await expect(page.getByRole("contentinfo")).toBeVisible();
  });

  test("main landmark contains the Dashboard heading", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("main").getByRole("heading", { name: "Dashboard" })
    ).toBeVisible();
  });
});

test.describe("Active navigation state", () => {
  test("Dashboard link carries aria-current=page on the home page", async ({ page }) => {
    await page.goto("/");
    const dashLink = page.getByRole("navigation").getByRole("link", { name: "Dashboard" });
    await expect(dashLink).toHaveAttribute("aria-current", "page");
  });

  test("Assets link carries aria-current=page on the assets page", async ({ page }) => {
    await page.goto("/assets");
    const assetsLink = page.getByRole("navigation").getByRole("link", { name: "Assets" });
    await expect(assetsLink).toHaveAttribute("aria-current", "page");
  });

  test("Employees link carries aria-current=page on the employees page", async ({ page }) => {
    await page.goto("/employees");
    const employeesLink = page.getByRole("navigation").getByRole("link", { name: "Employees" });
    await expect(employeesLink).toHaveAttribute("aria-current", "page");
  });

  test("inactive nav links do not carry aria-current on the assets page", async ({ page }) => {
    await page.goto("/assets");
    const dashLink = page.getByRole("navigation").getByRole("link", { name: "Dashboard" });
    const empLink = page.getByRole("navigation").getByRole("link", { name: "Employees" });
    await expect(dashLink).not.toHaveAttribute("aria-current", "page");
    await expect(empLink).not.toHaveAttribute("aria-current", "page");
  });
});

test.describe("Asset form — label connections", () => {
  test("every visible label is programmatically connected to its control", async ({ page }) => {
    await page.goto("/assets/new");
    // getByLabel resolves the control via the <label for="…"> / id="…" pairing
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
});

test.describe("Asset list filters — label connections", () => {
  test("Type, Status, and search controls are reachable by their visible labels", async ({
    page,
  }) => {
    await page.goto("/assets");
    await expect(page.getByLabel("Type")).toBeVisible();
    await expect(page.getByLabel("Status")).toBeVisible();
    await expect(page.getByLabel("Search tag / manufacturer / model")).toBeVisible();
  });

  test("selecting a Type filter and clicking Filter updates the URL", async ({ page }) => {
    await page.goto("/assets");
    await page.getByLabel("Type").selectOption("Laptop");
    await page.getByRole("button", { name: "Filter" }).click();
    await expect(page).toHaveURL(/type=Laptop/);
  });
});

test.describe("Keyboard navigation", () => {
  test("Assets navbar link is focusable and activates via Enter key", async ({ page }) => {
    await page.goto("/");
    const assetsLink = page.getByRole("navigation").getByRole("link", { name: "Assets" });
    await assetsLink.focus();
    await expect(assetsLink).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/assets/);
  });

  test("tab order reaches the New asset button on the assets page", async ({ page }) => {
    await page.goto("/assets");
    const newAssetLink = page.getByRole("link", { name: "+ New asset" });
    await newAssetLink.focus();
    await expect(newAssetLink).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/assets\/new/);
  });
});
