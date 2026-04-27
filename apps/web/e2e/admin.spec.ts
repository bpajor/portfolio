import { expect, test } from "@playwright/test";

test.describe("admin surface", () => {
  test("requires login before publishing workflows", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByRole("heading", { name: /admin/i })).toBeVisible();

    await page.goto("/admin/posts/new");
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
