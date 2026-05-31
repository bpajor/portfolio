import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
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

const apiProject = {
  id: "project-1",
  slug: "api-seo-project",
  title: "API SEO Project",
  eyebrow: "Crawler case study",
  summary: "An API-managed project.",
  description: "A project rendered from the API.",
  problem: "Crawler assets need fresh projects.",
  built: "Dynamic project metadata.",
  signals: ["SEO", "API"],
  stack: ["Go", "Next.js"],
  repoUrl: "https://github.com/bpajor/portfolio",
  demoUrl: "",
  sortOrder: 1,
  isFeatured: true,
  createdAt: "2026-05-16T12:00:00Z",
  updatedAt: "2026-05-16T12:00:00Z"
};

function mockApiFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/projects")) {
        return Response.json([apiProject]);
      }
      return Response.json([apiPost]);
    })
  );
}

describe("SEO crawler assets", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("includes API-published posts in sitemap routes", async () => {
    vi.stubEnv("API_INTERNAL_BASE_URL", "http://api.test/api");
    mockApiFetch();

    const routes = await sitemap();

    expect(routes.map((route) => route.url)).toContain("http://localhost:3000/blog/api-seo-post");
    expect(routes.map((route) => route.url)).toContain("http://localhost:3000/projects/api-seo-project");
  });

  it("includes API-published posts in RSS", async () => {
    vi.stubEnv("API_INTERNAL_BASE_URL", "http://api.test/api");
    mockApiFetch();

    const response = await rssGET();
    const body = await response.text();

    expect(body).toContain("API SEO Post");
    expect(body).toContain("Crawler-visible body.");
  });

  it("includes API-published posts in llms.txt", async () => {
    vi.stubEnv("API_INTERNAL_BASE_URL", "http://api.test/api");
    mockApiFetch();

    const response = await llmsGET();
    const body = await response.text();

    expect(body).toContain("API SEO Post");
    expect(body).toContain("http://localhost:3000/blog/api-seo-post");
    expect(body).toContain("API SEO Project");
    expect(body).toContain("http://localhost:3000/projects/api-seo-project");
  });

  it("includes API-published posts in ai-context.json", async () => {
    vi.stubEnv("API_INTERNAL_BASE_URL", "http://api.test/api");
    mockApiFetch();

    const response = await aiContextGET();
    const body = await response.json();

    expect(body.writing).toContainEqual(
      expect.objectContaining({
        title: "API SEO Post",
        slug: "api-seo-post",
        url: "http://localhost:3000/blog/api-seo-post"
      })
    );
    expect(body.projects).toContainEqual(
      expect.objectContaining({
        title: "API SEO Project",
        slug: "api-seo-project",
        url: "http://localhost:3000/projects/api-seo-project"
      })
    );
  });

  it("ships favicon and installable icon assets", () => {
    for (const file of ["favicon.ico", "icon.svg", "apple-touch-icon.png", "icon-192.png", "icon-512.png"]) {
      expect(existsSync(join(process.cwd(), "public", file)), `${file} should exist`).toBe(true);
    }

    const favicon = readFileSync(join(process.cwd(), "public", "favicon.ico"));
    expect(favicon.subarray(0, 4)).toEqual(Buffer.from([0, 0, 1, 0]));

    const manifest = JSON.parse(readFileSync(join(process.cwd(), "public", "site.webmanifest"), "utf8"));
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: "/icon-192.png", sizes: "192x192", type: "image/png" }),
        expect.objectContaining({ src: "/icon-512.png", sizes: "512x512", type: "image/png" })
      ])
    );
  });
});
