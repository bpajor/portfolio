import { expect, test } from "@playwright/test";

const adminSessionToken = process.env.E2E_ADMIN_SESSION_TOKEN;
const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";

test.describe("admin live staging", () => {
  test.skip(!adminSessionToken, "requires E2E_ADMIN_SESSION_TOKEN from the deployed staging database");

  test("creates updates and deletes a post against the deployed API", async ({ page }) => {
    await page.context().addCookies([
      {
        name: "portfolio_admin_session",
        value: adminSessionToken ?? "",
        url: baseURL
      }
    ]);

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const title = `Live Admin E2E ${suffix}`;
    const updatedTitle = `Updated Live Admin E2E ${suffix}`;
    const slug = `live-admin-e2e-${suffix}`;

    await page.goto("/admin/posts/new");
    await page.getByRole("textbox", { name: "Title", exact: true }).fill(title);
    await page.getByLabel("Slug").fill(slug);
    await page.getByLabel("Excerpt").fill("A live staging post created by Playwright.");
    await page.getByLabel("Markdown").fill("## Live staging\n\nThis post verifies real admin mutations.");
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
    await expect(page).toHaveURL(new RegExp(`/admin/posts/${created.id}$`));

    await page.getByRole("textbox", { name: "Title", exact: true }).fill(updatedTitle);
    const [updateResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === "PUT" &&
          new URL(response.url()).pathname === `/api/admin/posts/${created.id}`
      ),
      page.getByRole("button", { name: "Save draft" }).click()
    ]);
    expect(updateResponse.status(), await updateResponse.text()).toBe(200);
    await expect(page.getByText("Draft saved.")).toBeVisible();

    const fetched = await page.request.get(`/api/admin/posts/${created.id}`);
    await expect(fetched).toBeOK();
    expect(((await fetched.json()) as { title: string }).title).toBe(updatedTitle);

    const deleteResponse = await page.request.delete(`/api/admin/posts/${created.id}`, {
      headers: {
        Cookie: `portfolio_admin_session=${adminSessionToken}`,
        Origin: new URL(baseURL).origin
      }
    });
    expect(deleteResponse.status()).toBe(204);
  });
});
