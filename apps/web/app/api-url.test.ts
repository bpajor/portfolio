import { afterEach, describe, expect, it, vi } from "vitest";

async function loadApiUrl(baseUrl?: string) {
  vi.resetModules();
  if (baseUrl === undefined) {
    vi.unstubAllEnvs();
  } else {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", baseUrl);
  }
  return import("./api-url");
}

describe("apiUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the configured /api prefix exactly once", async () => {
    const { apiUrl } = await loadApiUrl("/api");

    expect(apiUrl("/admin/auth/login")).toBe("/api/admin/auth/login");
    expect(apiUrl("posts/hello/comments")).toBe("/api/posts/hello/comments");
  });

  it("trims trailing slashes from the configured base URL", async () => {
    const { apiUrl } = await loadApiUrl("https://example.com/api/");

    expect(apiUrl("/admin/comments")).toBe("https://example.com/api/admin/comments");
  });

  it("defaults to the local API service prefix", async () => {
    const { apiUrl } = await loadApiUrl();

    expect(apiUrl("/healthz")).toBe("http://127.0.0.1:8080/api/healthz");
  });
});
