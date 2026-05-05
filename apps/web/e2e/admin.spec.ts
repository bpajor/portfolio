import { expect, test } from "@playwright/test";

test.describe("admin surface", () => {
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
});
