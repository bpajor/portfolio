import { describe, expect, it } from "vitest";
import { markdownSections, publicPostToBlogPost, readingTime, staticPostToPublicPost } from "./blog-model";

describe("blog model", () => {
  it("converts static posts to API-shaped posts", () => {
    const post = staticPostToPublicPost({
      slug: "hello",
      title: "Hello",
      excerpt: "Short",
      publishedAt: "2026-05-05",
      readingTime: "1 min read",
      tags: ["Go"],
      sections: [{ heading: "Intro", body: "Body" }]
    });

    expect(post).toMatchObject({ id: "hello", slug: "hello", status: "published" });
    expect(post.contentMarkdown).toContain("## Intro");
  });

  it("converts API-published posts into SEO-readable blog posts", () => {
    const post = publicPostToBlogPost({
      id: "post-1",
      slug: "api-seo-post",
      title: "API SEO Post",
      excerpt: "An API-published article.",
      contentMarkdown: "Lead paragraph.\n\n## Deep section\n\nCrawler-visible body.",
      status: "published",
      publishedAt: "2026-05-16T12:00:00Z",
      seoTitle: "API SEO Post for crawlers",
      seoDescription: "A crawler-focused description.",
      tags: ["SEO", "API"]
    });

    expect(post).toMatchObject({
      slug: "api-seo-post",
      title: "API SEO Post",
      excerpt: "An API-published article.",
      seoTitle: "API SEO Post for crawlers",
      seoDescription: "A crawler-focused description.",
      tags: ["SEO", "API"]
    });
    expect(post.sections).toContainEqual({ heading: "Deep section", body: "Crawler-visible body." });
  });

  it("parses markdown headings into readable sections", () => {
    expect(markdownSections("Lead paragraph\n\n## Second\n\nBody")).toEqual([
      { heading: "Article", body: "Lead paragraph" },
      { heading: "Second", body: "Body" }
    ]);
  });

  it("estimates at least one minute of reading time", () => {
    expect(readingTime("short post")).toBe("1 min read");
  });
});
