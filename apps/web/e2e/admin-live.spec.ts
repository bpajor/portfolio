import { expect, test, type Page } from "@playwright/test";

const adminSessionToken = process.env.E2E_ADMIN_SESSION_TOKEN;
const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const baseOrigin = new URL(baseURL).origin;
const baseHost = new URL(baseURL).hostname;
const baseSupportsSecureCookies = baseURL.startsWith("https://") || baseHost === "localhost";
const cloudShellLikeOrigin =
  process.env.E2E_CLOUD_SHELL_ORIGIN ??
  "https://3000-cs-e2e.cs-europe-west4-bhnf.cloudshell.dev";
const turnstileTestToken = "XXXX.DUMMY.TOKEN.XXXX";

async function deleteAdminPost(page: Page, postId: string, origin = baseOrigin, referer?: string) {
  const response = await page.request.delete(`/api/admin/posts/${postId}`, {
    headers: {
      Cookie: `portfolio_admin_session=${adminSessionToken}`,
      Origin: origin,
      ...(referer ? { Referer: referer } : {})
    }
  });
  expect([204, 404], await response.text()).toContain(response.status());
}

async function writeRichArticle(page: Page, heading: string, body: string) {
  const editor = page.getByRole("textbox", { name: "Article editor" });
  await editor.click();
  await page.keyboard.press("Control+Alt+2");
  await editor.pressSequentially(heading, { delay: 10 });
  await editor.press("Enter");
  await editor.pressSequentially(body, { delay: 10 });
}

test.describe("admin live staging", () => {
  test.skip(!adminSessionToken, "requires E2E_ADMIN_SESSION_TOKEN from the deployed staging database");

  test("logs in through the deployed admin form", async ({ page }) => {
    test.skip(!adminEmail || !adminPassword, "requires E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD");

    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(adminEmail ?? "");
    await page.getByLabel("Password").fill(adminPassword ?? "");

    const [loginResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          new URL(response.url()).pathname === "/api/admin/auth/login"
      ),
      page.getByRole("button", { name: "Sign in" }).click()
    ]);

    const loginBodyText = await loginResponse.text();
    expect(loginResponse.status(), loginBodyText).toBe(200);
    const loginBody = JSON.parse(loginBodyText) as { email: string; role: string };
    expect(loginBody.email.toLowerCase()).toBe((adminEmail ?? "").toLowerCase());
    expect(loginBody.role).toBe("admin");

    if (!baseSupportsSecureCookies) {
      await expect(page).toHaveURL(/\/admin\/login$/);
      return;
    }

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Publishing dashboard", exact: true })).toBeVisible();
  });

  test("creates updates and deletes a post against the deployed API", async ({ page }) => {
    let postId: string | undefined;

    await page.context().addCookies([
      {
        name: "portfolio_admin_session",
        value: adminSessionToken ?? "",
        url: baseURL
      }
    ]);

    try {
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const title = `Live Admin E2E ${suffix}`;
      const updatedTitle = `Updated Live Admin E2E ${suffix}`;
      const slug = `live-admin-e2e-${suffix}`;

      await page.goto("/admin/posts/new");
      await page.getByRole("textbox", { name: "Title", exact: true }).fill(title);
      await page.getByLabel("Slug").fill(slug);
      await page.getByLabel("Excerpt").fill("A live staging post created by Playwright.");
      await writeRichArticle(page, "Live staging", "This post verifies real admin mutations.");
      await page.getByRole("textbox", { name: "SEO title", exact: true }).fill(title);
      await page.getByLabel("SEO description").fill("A live staging post created by Playwright.");
      await page.getByLabel("Tags").fill("E2E, Staging");

      const [createResponse] = await Promise.all([
        page.waitForResponse(
          (response) =>
            response.request().method() === "POST" &&
            new URL(response.url()).pathname === "/api/admin/posts"
        ),
        page.getByRole("button", { name: "Publish" }).click()
      ]);
      expect(createResponse.status(), await createResponse.text()).toBe(201);

      const created = (await createResponse.json()) as { id: string };
      postId = created.id;
      await expect(page).toHaveURL(new RegExp(`/admin/posts/${postId}$`));

      await page.getByRole("textbox", { name: "Title", exact: true }).fill(updatedTitle);
      const [updateResponse] = await Promise.all([
        page.waitForResponse(
          (response) =>
            response.request().method() === "PUT" &&
            new URL(response.url()).pathname === `/api/admin/posts/${postId}`
        ),
        page.getByRole("button", { name: "Save draft" }).click()
      ]);
      expect(updateResponse.status(), await updateResponse.text()).toBe(200);
      await expect(page.getByText("Draft saved.")).toBeVisible();

      const fetched = await page.request.get(`/api/admin/posts/${postId}`, {
        headers: { Cookie: `portfolio_admin_session=${adminSessionToken}` }
      });
      await expect(fetched).toBeOK();
      expect(((await fetched.json()) as { title: string }).title).toBe(updatedTitle);
    } finally {
      if (postId) {
        await deleteAdminPost(page, postId);
      }
    }
  });

  test("publishes a post, moderates a comment, verifies public visibility, and cleans up", async ({ page }) => {
    let postId: string | undefined;
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const slug = `live-flow-e2e-${suffix}`;
    const title = `Live Flow E2E ${suffix}`;
    const commentBody = `Live moderation comment ${suffix}`;

    try {
      const createResponse = await page.request.post("/api/admin/posts", {
        headers: {
          Cookie: `portfolio_admin_session=${adminSessionToken}`,
          Origin: baseOrigin
        },
        data: {
          title,
          slug,
          excerpt: "A live staging post that verifies the public publishing path.",
          contentMarkdown: "## Live flow\n\nThis post verifies publication, comments, moderation, and cleanup.",
          status: "published",
          seoTitle: title,
          seoDescription: "A live staging post that verifies the public publishing path.",
          tags: ["E2E", "Staging", "Moderation"]
        }
      });
      expect(createResponse.status(), await createResponse.text()).toBe(201);

      const created = (await createResponse.json()) as { id: string; slug: string; status: string };
      postId = created.id;
      expect(created.slug).toBe(slug);
      expect(created.status).toBe("published");

      const publicPostResponse = await page.request.get(`/api/posts/${slug}`);
      await expect(publicPostResponse).toBeOK();
      const publicPost = (await publicPostResponse.json()) as { title: string; status: string };
      expect(publicPost).toMatchObject({ title, status: "published" });

      await page.goto(`/blog/${slug}`);
      await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
      await expect(page.getByText("This post verifies publication, comments, moderation, and cleanup.")).toBeVisible();

      const commentResponse = await page.request.post(`/api/posts/${slug}/comments`, {
        data: {
          displayName: "Live E2E Reader",
          body: commentBody,
          turnstileToken: turnstileTestToken
        }
      });
      expect(commentResponse.status(), await commentResponse.text()).toBe(202);

      const pendingResponse = await page.request.get("/api/admin/comments?status=pending", {
        headers: {
          Cookie: `portfolio_admin_session=${adminSessionToken}`
        }
      });
      await expect(pendingResponse).toBeOK();
      const pendingComments = (await pendingResponse.json()) as Array<{
        id: string;
        postSlug: string;
        displayName: string;
        body: string;
        status: string;
      }>;
      const pendingComment = pendingComments.find((comment) => comment.postSlug === slug && comment.body === commentBody);
      expect(pendingComment).toMatchObject({
        postSlug: slug,
        displayName: "Live E2E Reader",
        body: commentBody,
        status: "pending"
      });

      const moderateResponse = await page.request.put(`/api/admin/comments/${pendingComment?.id}/moderate`, {
        headers: {
          Cookie: `portfolio_admin_session=${adminSessionToken}`,
          Origin: baseOrigin
        },
        data: { status: "approved" }
      });
      await expect(moderateResponse).toBeOK();

      const publicCommentsResponse = await page.request.get(`/api/posts/${slug}/comments`);
      await expect(publicCommentsResponse).toBeOK();
      const publicComments = (await publicCommentsResponse.json()) as Array<{ displayName: string; body: string; status: string }>;
      expect(publicComments).toContainEqual(
        expect.objectContaining({
          displayName: "Live E2E Reader",
          body: commentBody,
          status: "approved"
        })
      );

      await page.reload();
      await expect(page.getByText(commentBody)).toBeVisible();
    } finally {
      if (postId) {
        await deleteAdminPost(page, postId);
      }
    }
  });

  test("accepts Cloud Shell preview origin for admin mutations", async ({ page }) => {
    let postId: string | undefined;

    try {
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const response = await page.request.post("/api/admin/posts", {
        headers: {
          Cookie: `portfolio_admin_session=${adminSessionToken}`,
          Origin: cloudShellLikeOrigin,
          Referer: `${cloudShellLikeOrigin}/admin/posts/new`
        },
        data: {
          title: `Cloud Shell CSRF E2E ${suffix}`,
          slug: `cloud-shell-csrf-e2e-${suffix}`,
          excerpt: "A live staging post created with a Cloud Shell preview origin.",
          contentMarkdown: "## Cloud Shell\n\nThis verifies CSRF with the preview origin.",
          status: "draft",
          seoTitle: `Cloud Shell CSRF E2E ${suffix}`,
          seoDescription: "A live staging post created with a Cloud Shell preview origin.",
          tags: ["E2E", "CSRF"]
        }
      });
      expect(response.status(), await response.text()).toBe(201);

      const created = (await response.json()) as { id: string };
      postId = created.id;

      const deleteResponse = await page.request.delete(`/api/admin/posts/${postId}`, {
        headers: {
          Cookie: `portfolio_admin_session=${adminSessionToken}`,
          Origin: cloudShellLikeOrigin,
          Referer: `${cloudShellLikeOrigin}/admin/posts/${postId}`
        }
      });
      expect(deleteResponse.status()).toBe(204);
      postId = undefined;
    } finally {
      if (postId) {
        await deleteAdminPost(page, postId, cloudShellLikeOrigin, `${cloudShellLikeOrigin}/admin/posts/${postId}`);
      }
    }
  });
});
