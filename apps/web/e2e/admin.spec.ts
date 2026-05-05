import { expect, test, type Page } from "@playwright/test";

test.describe("admin surface", () => {
  async function signInByCookie(page: Page) {
    await page.goto("/");
    await page.context().addCookies([
      {
        name: "portfolio_admin_session",
        value: "test-session",
        url: page.url()
      }
    ]);
  }

  test("requires login before publishing workflows", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByRole("heading", { name: /admin/i })).toBeVisible();

    await page.goto("/admin/posts/new");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("submits admin login to the API prefix exactly once", async ({ page }) => {
    await page.route("**/api/admin/auth/login", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "invalid_credentials" } })
      });
    });

    await page.goto("/admin/login");
    await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();

    await page.getByLabel("Email").fill("admin@example.com");
    await page.getByLabel("Password").fill("wrong-password");

    const [request] = await Promise.all([
      page.waitForRequest(
        (nextRequest) =>
          nextRequest.method() === "POST" && nextRequest.url().includes("/api/admin/auth/login")
      ),
      page.getByRole("button", { name: "Sign in" }).click()
    ]);

    expect(new URL(request.url()).pathname).toBe("/api/admin/auth/login");
    await expect(page.getByText("Email or password is invalid.")).toBeVisible();
  });

  test("publishes a new blog post through the admin form", async ({ page }) => {
    await signInByCookie(page);

    let payload: Record<string, unknown> | null = null;
    await page.route("**/api/admin/posts", async (route) => {
      if (route.request().method() !== "POST") {
        await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
        return;
      }

      payload = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "post-123",
          slug: "admin-e2e-post",
          title: "Admin E2E Post",
          excerpt: "Published from the admin panel.",
          contentMarkdown: "## Intro\n\nPublished body.",
          status: "published",
          publishedAt: "2026-05-05T10:00:00Z",
          seoTitle: "Admin E2E Post",
          seoDescription: "Published from the admin panel.",
          tags: ["Admin", "E2E"],
          createdAt: "2026-05-05T10:00:00Z",
          updatedAt: "2026-05-05T10:00:00Z"
        })
      });
    });

    await page.goto("/admin/posts/new");
    await page.getByRole("textbox", { name: "Title", exact: true }).fill("Admin E2E Post");
    await page.getByLabel("Slug").fill("admin-e2e-post");
    await page.getByLabel("Excerpt").fill("Published from the admin panel.");
    await page.getByLabel("Markdown").fill("## Intro\n\nPublished body.");
    await page.getByRole("textbox", { name: "SEO title", exact: true }).fill("Admin E2E Post");
    await page.getByLabel("SEO description").fill("Published from the admin panel.");
    await page.getByLabel("Tags").fill("Admin, E2E");
    await page.getByRole("button", { name: "Publish" }).click();

    await expect(page).toHaveURL(/\/admin\/posts\/post-123/);
    expect(payload).toMatchObject({
      slug: "admin-e2e-post",
      title: "Admin E2E Post",
      status: "published",
      tags: ["Admin", "E2E"]
    });
  });

  test("edits an existing blog post through the admin form", async ({ page }) => {
    await signInByCookie(page);

    let payload: Record<string, unknown> | null = null;
    await page.route("**/api/admin/posts/post-123", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "post-123",
            slug: "admin-e2e-post",
            title: "Admin E2E Post",
            excerpt: "Initial excerpt.",
            contentMarkdown: "## Intro\n\nInitial body.",
            status: "draft",
            seoTitle: "Admin E2E Post",
            seoDescription: "Initial SEO description.",
            tags: ["Admin"],
            createdAt: "2026-05-05T10:00:00Z",
            updatedAt: "2026-05-05T10:00:00Z"
          })
        });
        return;
      }

      payload = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "post-123",
          slug: "admin-e2e-post",
          title: "Updated Admin E2E Post",
          excerpt: "Initial excerpt.",
          contentMarkdown: "## Intro\n\nInitial body.",
          status: "draft",
          seoTitle: "Admin E2E Post",
          seoDescription: "Initial SEO description.",
          tags: ["Admin"],
          createdAt: "2026-05-05T10:00:00Z",
          updatedAt: "2026-05-05T10:05:00Z"
        })
      });
    });

    await page.goto("/admin/posts/post-123");
    await page.getByRole("textbox", { name: "Title", exact: true }).fill("Updated Admin E2E Post");
    await page.getByRole("button", { name: "Save draft" }).click();

    await expect(page.getByText("Draft saved.")).toBeVisible();
    expect(payload).toMatchObject({
      title: "Updated Admin E2E Post",
      status: "draft"
    });
  });

  test("moderates pending comments", async ({ page }) => {
    await signInByCookie(page);

    let moderatedStatus = "";
    await page.route("**/api/admin/comments?status=pending", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "comment-123",
            postId: "post-123",
            postTitle: "Admin E2E Post",
            postSlug: "admin-e2e-post",
            displayName: "Reader",
            body: "Looks useful.",
            status: "pending",
            createdAt: "2026-05-05T10:00:00Z"
          }
        ])
      });
    });
    await page.route("**/api/admin/comments/comment-123/moderate", async (route) => {
      moderatedStatus = (route.request().postDataJSON() as { status: string }).status;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "comment-123", status: moderatedStatus })
      });
    });

    await page.goto("/admin/comments");
    await expect(page.getByText("Looks useful.")).toBeVisible();
    await page.getByRole("button", { name: "Approve", exact: true }).click();

    expect(moderatedStatus).toBe("approved");
  });
});
