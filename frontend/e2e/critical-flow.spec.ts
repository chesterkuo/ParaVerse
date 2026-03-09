import { test, expect } from "@playwright/test";

test.describe("ParaVerse Critical Flow", () => {
  const testUser = {
    email: `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
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

  test("create project and see step 1", async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.fill('input[placeholder="Email"]', testUser.email);
    await page.fill('input[placeholder="Password"]', testUser.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL("/");

    // Create project
    await page.click("text=New Project");
    await page.fill('input[placeholder="Project name"]', "E2E Test Project");
    await page.click("text=FinSentiment");
    await page.click("text=Create");

    // Should land on Step 1 (Knowledge Graph)
    await expect(page.locator("text=Step 1: Knowledge Graph")).toBeVisible();
  });

  test("project appears in project list", async ({ page }) => {
    // Login with same user
    await page.goto("/login");
    await page.fill('input[placeholder="Email"]', testUser.email);
    await page.fill('input[placeholder="Password"]', testUser.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL("/");

    // The created project should be visible in the project list
    await expect(page.locator("h3:has-text('E2E Test Project')").first()).toBeVisible({ timeout: 15000 });
  });
});
