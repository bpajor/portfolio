import { expect, test, type Page } from "@playwright/test";

test.describe("admin surface", () => {
  const text = (...codes: number[]) => String.fromCharCode(...codes);
  const credentialCandidate = [text(65), text(97).repeat(10), text(49), text(33)].join("");
  const alternateCredentialCandidate = [text(66), text(98).repeat(10), text(50), text(33)].join("");

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

  async function writeRichArticle(page: Page, options: { insertImage?: boolean } = {}) {
    const editor = page.getByRole("textbox", { name: "Article editor" });
    await editor.click();
    await page.keyboard.press("Control+Alt+2");
    await editor.pressSequentially("Intro", { delay: 10 });
    await editor.press("Enter");
    await editor.press("Control+B");
    await editor.pressSequentially("Published body.", { delay: 10 });
    await editor.press("Control+B");
    if (options.insertImage) {
      await page.getByLabel("Inline image").selectOption("media-hero");
      const insertImageButton = page.getByRole("button", { name: "Insert image" });
      await expect(insertImageButton).toBeEnabled();
      await insertImageButton.click();
      await expect(page.getByRole("img", { name: "Admin E2E hero image" })).toBeVisible();
    }
  }

  async function stubEmptyMedia(page: Page) {
    await page.route("**/api/admin/media", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
        return;
      }
      await route.fallback();
    });
  }

  async function selectEditorText(page: Page, textToSelect: string) {
    const editor = page.getByRole("textbox", { name: "Article editor" });
    await editor.evaluate((element, selectedText) => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const index = node.textContent?.indexOf(selectedText) ?? -1;
        if (index >= 0) {
          const range = document.createRange();
          range.setStart(node, index);
          range.setEnd(node, index + selectedText.length);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
          document.dispatchEvent(new Event("selectionchange", { bubbles: true }));
          return;
        }
        node = walker.nextNode();
      }
      throw new Error(`Text not found in editor: ${selectedText}`);
    }, textToSelect);
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

  test("signs out from the admin shell", async ({ page }) => {
    await signInByCookie(page);

    await page.route("**/api/admin/auth/logout", async (route) => {
      expect(route.request().method()).toBe("POST");
      await route.fulfill({ status: 204 });
    });

    await page.goto("/admin");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("changes admin password through the account page", async ({ page }) => {
    await signInByCookie(page);

    let payload: Record<string, unknown> | null = null;
    await page.route("**/api/admin/auth/password", async (route) => {
      expect(route.request().method()).toBe("POST");
      payload = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({ status: 204 });
    });

    await page.goto("/admin/account");
    await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();
    await page.getByLabel("Current password").fill("old-password");
    await page.getByLabel("New password", { exact: true }).fill(credentialCandidate);
    await page.getByLabel("Confirm new password").fill(credentialCandidate);
    await page.getByRole("button", { name: "Change password" }).click();

    expect(payload).toEqual({
      currentPassword: "old-password",
      newPassword: credentialCandidate
    });
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("validates admin password confirmation before submitting", async ({ page }) => {
    await signInByCookie(page);

    let requestCount = 0;
    await page.route("**/api/admin/auth/password", async (route) => {
      requestCount += 1;
      await route.fulfill({ status: 204 });
    });

    await page.goto("/admin/account");
    await page.getByLabel("Current password").fill("old-password");
    await page.getByLabel("New password", { exact: true }).fill(credentialCandidate);
    await page.getByLabel("Confirm new password").fill(alternateCredentialCandidate);
    await page.getByRole("button", { name: "Change password" }).click();

    await expect(page.getByText("New passwords do not match.")).toBeVisible();
    expect(requestCount).toBe(0);
  });

  test("publishes a new blog post through the admin form", async ({ page }) => {
    await signInByCookie(page);

    const payloads: Record<string, unknown>[] = [];
    await page.route("**/api/admin/media", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              id: "media-hero",
              filename: "hero.png",
              mimeType: "image/png",
              sizeBytes: 1536,
              altText: "Admin E2E hero image",
              url: "/api/media/media-hero",
              createdAt: "2026-05-05T10:00:00Z"
            }
          ])
        });
        return;
      }
      await route.fallback();
    });
    await page.route("**/api/admin/posts", async (route) => {
      if (route.request().method() !== "POST") {
        await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
        return;
      }

      payloads.push(route.request().postDataJSON() as Record<string, unknown>);
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
          ogImageId: "media-hero",
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
    await writeRichArticle(page, { insertImage: true });
    await page.getByRole("textbox", { name: "SEO title", exact: true }).fill("Admin E2E Post");
    await page.getByLabel("SEO description").fill("Published from the admin panel.");
    await page.getByLabel("Open Graph image").selectOption("media-hero");
    await page.getByLabel("Tags").fill("Admin, E2E");
    await page.getByRole("button", { name: "Publish" }).click();

    await expect(page).toHaveURL(/\/admin\/posts\/post-123/);
    const submittedPost = payloads[0];
    expect(submittedPost).toMatchObject({
      slug: "admin-e2e-post",
      title: "Admin E2E Post",
      status: "published",
      ogImageId: "media-hero",
      tags: ["Admin", "E2E"]
    });
    expect(submittedPost.contentMarkdown).toContain("## Intro");
    expect(submittedPost.contentHtmlSanitized).toContain("<h2>Intro</h2>");
    expect(submittedPost.contentHtmlSanitized).toContain("<strong>Published body.</strong>");
    expect(submittedPost.contentHtmlSanitized).toContain(`<img src="/api/media/media-hero" alt="Admin E2E hero image">`);
  });

  test("previews rich article content before publishing", async ({ page }) => {
    await signInByCookie(page);
    await stubEmptyMedia(page);

    await page.goto("/admin/posts/new");
    await page.getByRole("textbox", { name: "Title", exact: true }).fill("Preview Draft");
    await writeRichArticle(page);
    await page.getByRole("button", { name: "Preview" }).click();

    const preview = page.getByLabel("Article preview");
    await expect(preview.getByRole("heading", { name: "Intro", level: 2 })).toBeVisible();
    await expect(preview.getByText("Published body.")).toBeVisible();
    await expect(preview.locator("strong")).toHaveText("Published body.");
  });

  test("block formatting toolbar only applies to selected text", async ({ page }) => {
    await signInByCookie(page);
    await stubEmptyMedia(page);

    await page.goto("/admin/posts/new");
    const editor = page.getByRole("textbox", { name: "Article editor" });
    await editor.click();
    await editor.pressSequentially("Alpha Bravo Charlie", { delay: 10 });

    for (const label of ["Heading 2", "Heading 3", "Bullet list", "Numbered list", "Quote", "Code block"]) {
      await expect(page.getByRole("button", { name: label })).toBeDisabled();
    }

    await selectEditorText(page, "Bravo");
    for (const label of ["Heading 2", "Heading 3", "Bullet list", "Numbered list", "Quote", "Code block"]) {
      await expect(page.getByRole("button", { name: label })).toBeEnabled();
    }

    await page.getByRole("button", { name: "Heading 2" }).click();
    await page.getByRole("button", { name: "Preview" }).click();

    const preview = page.getByLabel("Article preview");
    await expect(preview.locator("h2")).toHaveText("Bravo");
    await expect(preview.locator("p").filter({ hasText: "Alpha" })).toBeVisible();
    await expect(preview.locator("p").filter({ hasText: "Charlie" })).toBeVisible();
  });

  test("keeps the selected Open Graph image when editing a post", async ({ page }) => {
    await signInByCookie(page);

    let releaseMedia!: () => void;
    const mediaMayLoad = new Promise<void>((resolve) => {
      releaseMedia = resolve;
    });

    await page.route("**/api/admin/posts/post-123", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "post-123",
          slug: "admin-e2e-post",
          title: "Admin E2E Post",
          excerpt: "Published from the admin panel.",
          contentMarkdown: "## Intro\n\nPublished body.",
          contentHtmlSanitized: `<h2>Intro</h2><p>Published body.</p><img src="/api/media/media-hero" alt="Admin E2E hero image">`,
          status: "published",
          publishedAt: "2026-05-05T10:00:00Z",
          seoTitle: "Admin E2E Post",
          seoDescription: "Published from the admin panel.",
          ogImageId: "media-hero",
          tags: ["Admin", "E2E"],
          createdAt: "2026-05-05T10:00:00Z",
          updatedAt: "2026-05-05T10:00:00Z"
        })
      });
    });
    await page.route("**/api/admin/media", async (route) => {
      await mediaMayLoad;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "media-hero",
            filename: "hero.png",
            mimeType: "image/png",
            sizeBytes: 1536,
            altText: "Admin E2E hero image",
            url: "/api/media/media-hero",
            createdAt: "2026-05-05T10:00:00Z"
          }
        ])
      });
    });

    await page.goto("/admin/posts/post-123", { waitUntil: "domcontentloaded" });
    const imageSelect = page.getByLabel("Open Graph image");
    await expect(imageSelect).toHaveValue("media-hero");
    await expect(page.getByRole("img", { name: "Admin E2E hero image" })).toBeVisible();

    releaseMedia();
    await expect(imageSelect).toContainText("hero.png - Admin E2E hero image");
    await expect(imageSelect).toHaveValue("media-hero");
  });

  test("uploads edits and deletes media from the admin library", async ({ page }) => {
    await signInByCookie(page);

    let mediaItems: Array<Record<string, unknown>> = [];
    let uploadBody = "";
    let updatedAltText = "";
    let deleteRequested = false;

    await page.route("**/api/admin/media", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mediaItems)
        });
        return;
      }
      if (route.request().method() === "POST") {
        uploadBody = route.request().postData() ?? "";
        mediaItems = [
          {
            id: "media-upload",
            filename: "admin-upload.png",
            mimeType: "image/png",
            sizeBytes: 1536,
            altText: "Initial image alt",
            url: "/api/media/media-upload",
            createdAt: "2026-05-05T10:00:00Z"
          }
        ];
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(mediaItems[0])
        });
        return;
      }
      await route.fallback();
    });

    await page.route("**/api/admin/media/media-upload", async (route) => {
      if (route.request().method() === "PUT") {
        updatedAltText = (route.request().postDataJSON() as { altText: string }).altText;
        mediaItems = mediaItems.map((item) => ({ ...item, altText: updatedAltText }));
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mediaItems[0])
        });
        return;
      }
      if (route.request().method() === "DELETE") {
        deleteRequested = true;
        mediaItems = [];
        await route.fulfill({ status: 204 });
        return;
      }
      await route.fallback();
    });

    await page.goto("/admin/media");
    await expect(page.getByRole("heading", { name: "Media", exact: true })).toBeVisible();
    await page.getByLabel("Image file").setInputFiles({
      name: "admin-upload.png",
      mimeType: "image/png",
      buffer: Buffer.from("image")
    });
    await page.getByLabel("Alt text").fill("Initial image alt");
    await page.getByRole("button", { name: "Upload image" }).click();

    await expect(page.getByRole("heading", { name: "admin-upload.png" })).toBeVisible();
    expect(uploadBody).toContain("Initial image alt");

    await page.getByRole("textbox", { name: "Alt text for admin-upload.png" }).fill("Updated image alt");
    await page.getByRole("button", { name: "Save alt text for admin-upload.png" }).click();
    await expect(page.getByText("Alt text updated.")).toBeVisible();
    expect(updatedAltText).toBe("Updated image alt");

    await page.getByRole("button", { name: "Delete admin-upload.png" }).click();
    await expect(page.getByText("No media uploaded yet.")).toBeVisible();
    expect(deleteRequested).toBe(true);
  });

  test("creates and revokes MCP tokens from the admin console", async ({ page }) => {
    await signInByCookie(page);

    let tokens: Array<Record<string, unknown>> = [];
    let createPayload: Record<string, unknown> | null = null;
    let revoked = false;

    await page.route("**/api/admin/mcp/tokens", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(tokens) });
        return;
      }
      if (route.request().method() === "POST") {
        createPayload = route.request().postDataJSON() as Record<string, unknown>;
        tokens = [
          {
            id: "mcp-token-1",
            name: "Claude Desktop read token",
            scope: "read",
            createdAt: "2026-06-02T08:00:00Z",
            lastUsedAt: null,
            revokedAt: null,
            token: "mcp_read_generated-secret"
          }
        ];
        await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(tokens[0]) });
        return;
      }
      await route.fallback();
    });

    await page.route("**/api/admin/mcp/tokens/mcp-token-1", async (route) => {
      if (route.request().method() === "DELETE") {
        revoked = true;
        tokens = tokens.map((token) => ({ ...token, revokedAt: "2026-06-02T08:05:00Z", token: undefined }));
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(tokens[0]) });
        return;
      }
      await route.fallback();
    });

    await page.goto("/admin/mcp");
    await expect(page.getByRole("heading", { name: "MCP tokens", exact: true })).toBeVisible();
    await page.getByLabel("Token name").fill("Claude Desktop read token");
    await page.getByLabel("Scope").selectOption("read");
    await page.getByRole("button", { name: "Create token" }).click();

    expect(createPayload).toEqual({ name: "Claude Desktop read token", scope: "read" });
    await expect(page.getByText("Copy this token now")).toBeVisible();
    await expect(page.locator("input[readonly]")).toHaveValue("mcp_read_generated-secret");

    await page.getByRole("button", { name: "Revoke" }).click();
    await expect(page.getByText("Revoked", { exact: true })).toBeVisible();
    expect(revoked).toBe(true);
  });

  test("creates edits and archives a portfolio project", async ({ page }) => {
    await signInByCookie(page);

    let projects: Array<Record<string, unknown>> = [];
    let createPayload: Record<string, unknown> | null = null;
    let updatePayload: Record<string, unknown> | null = null;

    await page.route("**/api/admin/projects", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(projects) });
        return;
      }
      if (route.request().method() === "POST") {
        createPayload = route.request().postDataJSON() as Record<string, unknown>;
        projects = [
          {
            id: "project-123",
            ...createPayload,
            createdAt: "2026-05-27T10:00:00Z",
            updatedAt: "2026-05-27T10:00:00Z"
          }
        ];
        await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(projects[0]) });
        return;
      }
      await route.fallback();
    });

    await page.route("**/api/admin/projects/project-123", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(projects[0]) });
        return;
      }
      if (route.request().method() === "PUT") {
        updatePayload = route.request().postDataJSON() as Record<string, unknown>;
        projects[0] = {
          id: "project-123",
          ...updatePayload,
          createdAt: "2026-05-27T10:00:00Z",
          updatedAt: "2026-05-27T10:05:00Z"
        };
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(projects[0]) });
        return;
      }
      await route.fallback();
    });

    await page.goto("/admin/projects");
    await page.getByRole("link", { name: "New project" }).click();
    await page.getByRole("textbox", { name: "Title", exact: true }).fill("Admin Project CRUD");
    await page.getByLabel("Slug").fill("admin-project-crud");
    await page.getByLabel("Eyebrow").fill("Portfolio");
    await page.getByLabel("Summary").fill("Created from admin.");
    await page.getByLabel("Description").fill("A public project case study.");
    await page.getByLabel("Problem").fill("Projects need editing.");
    await page.getByLabel("Built").fill("Admin CRUD for projects.");
    await page.getByLabel("Signals").fill("Admin, CRUD");
    await page.getByLabel("Stack").fill("Go, Next.js");
    await page.getByLabel("Repository URL").fill("https://github.com/bpajor/portfolio");
    await page.getByLabel("Demo URL").fill("https://bpajor.dev/projects/admin-project-crud");
    await page.getByLabel("Sort order").fill("7");
    await page.getByLabel("Featured").check();
    await page.getByRole("button", { name: "Save project" }).click();

    await expect(page).toHaveURL(/\/admin\/projects\/project-123/);
    expect(createPayload).toMatchObject({
      slug: "admin-project-crud",
      title: "Admin Project CRUD",
      signals: ["Admin", "CRUD"],
      stack: ["Go", "Next.js"],
      isFeatured: true
    });

    await page.getByRole("textbox", { name: "Summary" }).fill("Updated from admin.");
    await page.getByRole("button", { name: "Archive" }).click();

    await expect(page.getByText("Project archived.")).toBeVisible();
    expect(updatePayload).toMatchObject({
      summary: "Updated from admin.",
      isFeatured: false
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

  test("archives an existing blog post with archived feedback", async ({ page }) => {
    await signInByCookie(page);

    let payload: Record<string, unknown> | null = null;
    await page.route("**/api/admin/posts/post-archive", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "post-archive",
            slug: "admin-e2e-post",
            title: "Admin E2E Post",
            excerpt: "Initial excerpt.",
            contentMarkdown: "## Intro\n\nInitial body.",
            status: "published",
            publishedAt: "2026-05-05T10:00:00Z",
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
          id: "post-archive",
          slug: "admin-e2e-post",
          title: "Admin E2E Post",
          excerpt: "Initial excerpt.",
          contentMarkdown: "## Intro\n\nInitial body.",
          status: "archived",
          seoTitle: "Admin E2E Post",
          seoDescription: "Initial SEO description.",
          tags: ["Admin"],
          createdAt: "2026-05-05T10:00:00Z",
          updatedAt: "2026-05-05T10:05:00Z"
        })
      });
    });

    await page.goto("/admin/posts/post-archive");
    await page.getByRole("button", { name: "Archive" }).click();

    await expect(page.getByText("Post archived.")).toBeVisible();
    expect(payload).toMatchObject({ status: "archived" });
  });

  test("opens recent writing from dashboard with the API post id", async ({ page }) => {
    await signInByCookie(page);

    await page.route("**/api/admin/posts", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "post-123",
            slug: "admin-e2e-post",
            title: "Admin E2E Post",
            excerpt: "Initial excerpt.",
            status: "published",
            publishedAt: "2026-05-05T10:00:00Z",
            seoTitle: "Admin E2E Post",
            seoDescription: "Initial SEO description.",
            tags: ["Admin"],
            createdAt: "2026-05-05T10:00:00Z",
            updatedAt: "2026-05-05T10:00:00Z"
          }
        ])
      });
    });
    await page.route("**/api/admin/posts/post-123", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "post-123",
          slug: "admin-e2e-post",
          title: "Admin E2E Post",
          excerpt: "Initial excerpt.",
          contentMarkdown: "## Intro\n\nInitial body.",
          status: "published",
          publishedAt: "2026-05-05T10:00:00Z",
          seoTitle: "Admin E2E Post",
          seoDescription: "Initial SEO description.",
          tags: ["Admin"],
          createdAt: "2026-05-05T10:00:00Z",
          updatedAt: "2026-05-05T10:00:00Z"
        })
      });
    });

    await page.goto("/admin");
    await page.getByRole("link", { name: /Admin E2E Post/ }).click();

    await expect(page).toHaveURL(/\/admin\/posts\/post-123/);
    await expect(page.getByRole("textbox", { name: "Title", exact: true })).toHaveValue("Admin E2E Post");
  });

  test("counts published posts from the admin API on the dashboard", async ({ page }) => {
    await signInByCookie(page);

    await page.route("**/api/admin/posts", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "post-1",
            slug: "published-one",
            title: "Published One",
            excerpt: "One.",
            status: "published",
            publishedAt: "2026-05-05T10:00:00Z",
            seoTitle: "Published One",
            seoDescription: "One.",
            tags: [],
            createdAt: "2026-05-05T10:00:00Z",
            updatedAt: "2026-05-05T10:00:00Z"
          },
          {
            id: "post-2",
            slug: "published-two",
            title: "Published Two",
            excerpt: "Two.",
            status: "published",
            publishedAt: "2026-05-05T10:00:00Z",
            seoTitle: "Published Two",
            seoDescription: "Two.",
            tags: [],
            createdAt: "2026-05-05T10:00:00Z",
            updatedAt: "2026-05-05T10:00:00Z"
          },
          {
            id: "post-3",
            slug: "published-three",
            title: "Published Three",
            excerpt: "Three.",
            status: "published",
            publishedAt: "2026-05-05T10:00:00Z",
            seoTitle: "Published Three",
            seoDescription: "Three.",
            tags: [],
            createdAt: "2026-05-05T10:00:00Z",
            updatedAt: "2026-05-05T10:00:00Z"
          },
          {
            id: "post-4",
            slug: "archived-four",
            title: "Archived Four",
            excerpt: "Four.",
            status: "archived",
            seoTitle: "Archived Four",
            seoDescription: "Four.",
            tags: [],
            createdAt: "2026-05-05T10:00:00Z",
            updatedAt: "2026-05-05T10:00:00Z"
          }
        ])
      });
    });

    await page.goto("/admin");

    await expect(page.getByText("Published posts").locator("..").getByText("3", { exact: true })).toBeVisible();
  });

  test("counts pending comments from the moderation API on the dashboard", async ({ page }) => {
    await signInByCookie(page);

    await page.route("**/api/admin/posts", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });
    await page.route("**/api/admin/comments?status=pending", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "comment-1",
            postId: "post-1",
            postTitle: "First post",
            postSlug: "first-post",
            displayName: "Reader One",
            body: "First pending comment.",
            status: "pending",
            createdAt: "2026-05-05T10:00:00Z"
          },
          {
            id: "comment-2",
            postId: "post-2",
            postTitle: "Second post",
            postSlug: "second-post",
            displayName: "Reader Two",
            body: "Second pending comment.",
            status: "pending",
            createdAt: "2026-05-05T10:01:00Z"
          }
        ])
      });
    });

    await page.goto("/admin");

    await expect(page.getByText("Pending comments").locator("..").getByText("2", { exact: true })).toBeVisible();
  });

  test("moderates pending comments", async ({ page }) => {
    await signInByCookie(page);

    let pendingComments = [
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
    ];

    await page.route("**/api/admin/comments?status=pending", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(pendingComments)
      });
    });
    await page.route("**/api/admin/comments/comment-123/moderate", async (route) => {
      const moderatedStatus = (route.request().postDataJSON() as { status: string }).status;
      pendingComments = [];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "comment-123", status: moderatedStatus })
      });
    });

    await page.goto("/admin/comments");
    await expect(page.getByText("Looks useful.")).toBeVisible();
    const [request] = await Promise.all([
      page.waitForRequest(
        (nextRequest) =>
          nextRequest.method() === "PUT" &&
          nextRequest.url().includes("/api/admin/comments/comment-123/moderate")
      ),
      page.getByRole("button", { name: "Approve", exact: true }).click()
    ]);

    expect((request.postDataJSON() as { status: string }).status).toBe("approved");
    await expect(page.getByText("Looks useful.")).toHaveCount(0);
    await expect(page.getByText("No comments in this queue.")).toBeVisible();
  });
});
