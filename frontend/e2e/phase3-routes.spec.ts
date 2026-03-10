import { test, expect } from "@playwright/test";

test.describe("Phase 3: New Routes and Pages", () => {
  const testUser = {
    email: `e2e-p3-${Date.now()}@test.com`,
    password: "testpassword123",
    name: "Phase3 E2E User",
  };

  test.beforeEach(async ({ page }) => {
    // Register (or login if already exists)
    let token: string | undefined;
    const registerRes = await page.request.post("http://localhost:5001/api/v1/auth/register", {
      data: { email: testUser.email, password: testUser.password, name: testUser.name },
    });
    if (registerRes.ok()) {
      const registerData = await registerRes.json();
      token = registerData.data?.access_token;
    } else {
      const loginRes = await page.request.post("http://localhost:5001/api/v1/auth/login", {
        data: { email: testUser.email, password: testUser.password },
      });
      const loginData = await loginRes.json();
      token = loginData.data?.access_token;
    }

    if (token) {
      await page.goto("/login");
      await page.evaluate((t) => {
        localStorage.setItem("access_token", t);
      }, token);
    }
  });

  test("WarGame dashboard page loads", async ({ page }) => {
    // Navigate to a non-existent simulation's wargame dashboard
    await page.goto("/simulations/00000000-0000-0000-0000-000000000001/wargame");

    // Should render the dashboard structure (even with no data)
    await expect(page.locator("text=WarGame Analysis Dashboard").or(page.locator("text=兵棋推演分析仪表板"))).toBeVisible({ timeout: 10000 });
  });

  test("ContentLab results page loads", async ({ page }) => {
    await page.goto("/simulations/00000000-0000-0000-0000-000000000001/content-lab");

    // Should show the comparison page with instructions
    await expect(page.locator("text=ContentLab")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=compareWith")).toBeVisible({ timeout: 10000 });
  });

  test("OpenAPI docs page loads at /docs", async ({ page }) => {
    await page.goto("http://localhost:5001/docs");

    // Scalar UI should render
    await expect(page.locator("body")).not.toBeEmpty();
    // Check page loads with some content (Scalar renders client-side)
    const content = await page.content();
    expect(content).toContain("ParaVerse");
  });

  test("LTI callback route exists", async ({ page }) => {
    // Navigate to LTI callback with dummy params
    await page.goto("/lti/callback?access_token=test&refresh_token=test");
    // Should redirect to home (after storing tokens)
    await page.waitForURL("**/", { timeout: 10000 });
  });
});

test.describe("Phase 3: API Integration", () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    const email = `e2e-api-${Date.now()}@test.com`;
    const res = await request.post("http://localhost:5001/api/v1/auth/register", {
      data: { email, password: "testpassword123", name: "API Tester" },
    });
    const data = await res.json();
    token = data.data?.access_token;
  });

  test("WarGame access blocked for unverified user", async ({ request }) => {
    const res = await request.post("http://localhost:5001/api/v1/projects", {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: "War Test", description: "test", scenario_type: "war_game" },
    });
    expect(res.status()).toBe(403);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("institutional verification");
  });

  test("WarGame access request workflow", async ({ request }) => {
    // Submit request
    const reqRes = await request.post("http://localhost:5001/api/v1/admin/wargame-request", {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        organization_name: "E2E Test University",
        organization_type: "academic",
        justification: "Academic research for defense simulation modeling program.",
      },
    });
    expect(reqRes.status()).toBe(201);
    const reqData = await reqRes.json();
    expect(reqData.data.status).toBe("pending");

    // Check my request
    const meRes = await request.get("http://localhost:5001/api/v1/admin/wargame-request/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const meData = await meRes.json();
    expect(meData.data.status).toBe("pending");
    expect(meData.data.organization_name).toBe("E2E Test University");

    // List approvals blocked for non-admin
    const listRes = await request.get("http://localhost:5001/api/v1/admin/wargame-approvals", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listRes.status()).toBe(403);
  });

  test("ContentLab project creation succeeds", async ({ request }) => {
    const res = await request.post("http://localhost:5001/api/v1/projects", {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: "Content Lab E2E", description: "test", scenario_type: "content_lab" },
    });
    expect(res.status()).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.scenario_type).toBe("content_lab");
  });

  test("Compare endpoint validates input", async ({ request }) => {
    const res = await request.post("http://localhost:5001/api/v1/simulations/00000000-0000-0000-0000-000000000001/compare", {
      headers: { Authorization: `Bearer ${token}` },
      data: {},
    });
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("compareWithId");
  });

  test("Admin validation rejects bad input", async ({ request }) => {
    // Invalid org type
    const res1 = await request.post("http://localhost:5001/api/v1/admin/wargame-request", {
      headers: { Authorization: `Bearer ${token}` },
      data: { organization_name: "Corp", organization_type: "startup", justification: "Long enough justification" },
    });
    expect(res1.status()).toBe(400);

    // Short justification
    const res2 = await request.post("http://localhost:5001/api/v1/admin/wargame-request", {
      headers: { Authorization: `Bearer ${token}` },
      data: { organization_name: "Uni", organization_type: "academic", justification: "Short" },
    });
    expect(res2.status()).toBe(400);
  });
});
