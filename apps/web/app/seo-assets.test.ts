import { afterEach, describe, expect, it, vi } from "vitest";
import sitemap from "./sitemap";
import { GET as aiContextGET } from "./ai-context.json/route";
import { GET as llmsGET } from "./llms.txt/route";
import { GET as rssGET } from "./rss.xml/route";

const apiPost = {
  id: "post-1",
  slug: "api-seo-post",
  title: "API SEO Post",
  excerpt: "An API-published article.",
  contentMarkdown: "## Article\n\nCrawler-visible body.",
  status: "published",
  publishedAt: "2026-05-16T12:00:00Z",
  seoTitle: "API SEO Post for crawlers",
  seoDescription: "A crawler-focused description.",
  tags: ["SEO", "API"],
  createdAt: "2026-05-16T12:00:00Z",
  updatedAt: "2026-05-16T12:00:00Z"
};

describe("SEO crawler assets", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("includes API-published posts in sitemap routes", async () => {
    vi.stubEnv("API_INTERNAL_BASE_URL", "http://api.test/api");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json([apiPost]))
    );

    const routes = await sitemap();

    expect(routes.map((route) => route.url)).toContain("http://localhost:3000/blog/api-seo-post");
  });

  it("includes API-published posts in RSS", async () => {
    vi.stubEnv("API_INTERNAL_BASE_URL", "http://api.test/api");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json([apiPost]))
    );

    const response = await rssGET();
    const body = await response.text();

    expect(body).toContain("API SEO Post");
    expect(body).toContain("Crawler-visible body.");
  });

  it("includes API-published posts in llms.txt", async () => {
    vi.stubEnv("API_INTERNAL_BASE_URL", "http://api.test/api");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json([apiPost]))
    );

    const response = await llmsGET();
    const body = await response.text();

    expect(body).toContain("API SEO Post");
    expect(body).toContain("http://localhost:3000/blog/api-seo-post");
  });

  it("includes API-published posts in ai-context.json", async () => {
    vi.stubEnv("API_INTERNAL_BASE_URL", "http://api.test/api");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json([apiPost]))
    );

    const response = await aiContextGET();
    const body = await response.json();

    expect(body.writing).toContainEqual(
      expect.objectContaining({
        title: "API SEO Post",
        slug: "api-seo-post",
        url: "http://localhost:3000/blog/api-seo-post"
      })
    );
  });
});
