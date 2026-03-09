import { test, expect } from "@playwright/test";

test.describe("ParaVerse Critical Flow", () => {
  const testUser = {
    email: `e2e-${Date.now()}@test.com`,
    password: "testpassword123",
    name: "E2E Test User",
  };

  test("register new user", async ({ page }) => {
    await page.goto("/register");
    await page.fill('input[placeholder="Name"]', testUser.name);
    await page.fill('input[placeholder="Email"]', testUser.email);
    await page.fill('input[placeholder*="Password"]', testUser.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL("/");
    await expect(page.locator("text=Projects")).toBeVisible();
  });

  test("login existing user", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[placeholder="Email"]', testUser.email);
    await page.fill('input[placeholder="Password"]', testUser.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL("/");
  });

  test("create project and navigate steps", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[placeholder="Email"]', testUser.email);
    await page.fill('input[placeholder="Password"]', testUser.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL("/");

    await page.click("text=New Project");
    await page.fill('input[placeholder="Project name"]', "E2E Test Project");
    await page.click("text=FinSentiment");
    await page.click("text=Create");

    await expect(page.locator("text=Step 1: Knowledge Graph")).toBeVisible();

    await page.click("text=Next Step");
    await expect(page.locator("text=Step 2: Environment Setup")).toBeVisible();

    await expect(page.locator("text=OASIS")).toBeVisible();
  });

  test("project appears in sidebar", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[placeholder="Email"]', testUser.email);
    await page.fill('input[placeholder="Password"]', testUser.password);
    await page.click('button[type="submit"]');

    await expect(page.locator("text=E2E Test Project")).toBeVisible();
  });
});
