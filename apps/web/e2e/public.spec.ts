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
});
