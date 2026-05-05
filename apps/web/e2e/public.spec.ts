import { expect, test } from "@playwright/test";

test.describe("public website", () => {
  test("renders core public routes", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /building reliable backend platforms/i })).toBeVisible();

    await page.goto("/projects");
    await expect(page.getByRole("heading", { name: /practical systems/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /pay management system/i })).toBeVisible();

    await page.goto("/blog");
    await expect(page.getByRole("heading", { name: /technical writing/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /low-cost production portfolio/i })).toBeVisible();

    await page.goto("/contact");
    await expect(page.getByRole("heading", { name: /let's talk about backend/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "github.com/bpajor" })).toBeVisible();
  });

  test("serves GEO and crawler assets", async ({ page }) => {
    const robots = await page.request.get("/robots.txt");
    await expect(robots).toBeOK();
    await expect(await robots.text()).toContain("Sitemap:");

    const sitemap = await page.request.get("/sitemap.xml");
    await expect(sitemap).toBeOK();
    await expect(await sitemap.text()).toContain("/blog/mcp-as-a-portfolio-interface");

    const llms = await page.request.get("/llms.txt");
    await expect(llms).toBeOK();
    await expect(await llms.text()).toContain("Blazej Pajor");

    const aiContext = await page.request.get("/ai-context.json");
    await expect(aiContext).toBeOK();
    expect((await aiContext.json()).person.name).toBe("Blazej Pajor");
  });

  test("keeps public comments read-only for the v1 release", async ({ page }) => {
    await page.goto("/blog/designing-low-cost-production-portfolio");

    await expect(page.getByRole("heading", { name: "Discussion" })).toBeVisible();
    await expect(page.getByText(/public comments are read-only/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /submit comment/i })).toHaveCount(0);
  });

  test("renders API-published posts on the public blog", async ({ page }) => {
    const post = {
      id: "post-123",
      slug: "admin-e2e-post",
      title: "Admin E2E Post",
      excerpt: "Published from the admin panel.",
      contentMarkdown: "## Intro\n\nPublished body.",
      status: "published",
      publishedAt: "2026-05-05T10:00:00Z",
      tags: ["Admin", "E2E"],
      createdAt: "2026-05-05T10:00:00Z",
      updatedAt: "2026-05-05T10:00:00Z"
    };

    await page.route("**/api/posts", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([post]) });
    });
    await page.route("**/api/posts/admin-e2e-post", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(post) });
    });
    await page.route("**/api/posts/admin-e2e-post/comments", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });

    await page.goto("/blog");
    await expect(page.getByRole("link", { name: /admin e2e post/i })).toBeVisible();

    await page.goto("/blog/admin-e2e-post");
    await expect(page.getByRole("heading", { name: "Admin E2E Post" })).toBeVisible();
    await expect(page.getByText("Published body.")).toBeVisible();
  });
});
