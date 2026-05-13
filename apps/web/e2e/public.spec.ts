import { expect, test } from "@playwright/test";

test.describe("public website", () => {
  test("renders core public routes", async ({ page }) => {
    const blogPost = {
      id: "core-route-post",
      slug: "core-route-writing",
      title: "Core Route Writing",
      excerpt: "Deterministic blog content for the public route smoke test.",
      contentMarkdown: "Core route body.",
      status: "published",
      publishedAt: "2026-05-05T13:00:00Z",
      tags: ["Core"],
      createdAt: "2026-05-05T13:00:00Z",
      updatedAt: "2026-05-05T13:00:00Z"
    };

    await page.goto("/");
    await expect(page.getByRole("heading", { name: /building reliable backend platforms/i })).toBeVisible();

    await page.goto("/projects");
    await expect(page.getByRole("heading", { name: /practical systems/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /pay management system/i })).toBeVisible();

    await page.route("**/api/posts", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([blogPost]) });
    });

    await page.goto("/blog");
    await expect(page.getByRole("heading", { name: /technical writing/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /core route writing/i })).toBeVisible();

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

  test("submits a public comment for moderation", async ({ page }) => {
    const post = {
      id: "commentable-post",
      slug: "commentable-writing",
      title: "Commentable Writing",
      excerpt: "Public comment flow test.",
      contentMarkdown: "Commentable body.",
      status: "published",
      publishedAt: "2026-05-05T10:00:00Z",
      tags: ["Comments"],
      createdAt: "2026-05-05T10:00:00Z",
      updatedAt: "2026-05-05T10:00:00Z"
    };
    let submittedBody: { displayName: string; body: string; turnstileToken: string } | undefined;

    await page.route("**/api/posts/commentable-writing", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(post) });
    });
    await page.route("**/api/posts/commentable-writing/comments", async (route) => {
      if (route.request().method() === "POST") {
        submittedBody = route.request().postDataJSON();
        await route.fulfill({
          status: 202,
          contentType: "application/json",
          body: JSON.stringify({ id: "pending-comment", status: "pending" })
        });
        return;
      }

      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });

    await page.goto("/blog/commentable-writing");

    await expect(page.getByRole("heading", { name: "Discussion" })).toBeVisible();
    await page.getByLabel("Display name").fill(" Reader ");
    await page.getByLabel("Comment").fill(" Useful post. ");
    await page.getByRole("button", { name: "Submit comment" }).click();

    expect(submittedBody).toMatchObject({
      displayName: "Reader",
      body: "Useful post."
    });
    expect(submittedBody?.turnstileToken).toEqual(expect.any(String));
    await expect(page.getByText("Comment sent for moderation.")).toBeVisible();
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

  test("does not flash static placeholder posts while API posts load", async ({ page }) => {
    const post = {
      id: "post-loading",
      slug: "api-loaded-writing",
      title: "API Loaded Writing",
      excerpt: "Loaded after the initial blog render.",
      contentMarkdown: "Loaded body.",
      status: "published",
      publishedAt: "2026-05-05T12:00:00Z",
      tags: ["API"],
      createdAt: "2026-05-05T12:00:00Z",
      updatedAt: "2026-05-05T12:00:00Z"
    };
    let releasePosts!: () => void;
    const postsBlocked = new Promise<void>((resolve) => {
      releasePosts = resolve;
    });

    await page.route("**/api/posts", async (route) => {
      await postsBlocked;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([post]) });
    });

    await page.goto("/blog");

    await expect(page.getByRole("heading", { name: /technical writing/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /low-cost production portfolio/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /mcp as a portfolio interface/i })).toHaveCount(0);

    releasePosts();
    await expect(page.getByRole("link", { name: /api loaded writing/i })).toBeVisible();
  });
});
