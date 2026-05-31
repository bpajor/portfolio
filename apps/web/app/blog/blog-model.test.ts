import { describe, expect, it } from "vitest";
import { hasRenderableRichHtml, markdownSections, publicPostToBlogPost, readingTime, staticPostToPublicPost } from "./blog-model";

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
      contentHtmlSanitized: "<p>Lead paragraph.</p><h2>Deep section</h2><p>Crawler-visible body.</p>",
      status: "published",
      publishedAt: "2026-05-16T12:00:00Z",
      seoTitle: "API SEO Post for crawlers",
      seoDescription: "A crawler-focused description.",
      ogImageId: "media-hero",
      tags: ["SEO", "API"]
    });

    expect(post).toMatchObject({
      slug: "api-seo-post",
      title: "API SEO Post",
      excerpt: "An API-published article.",
      contentHtmlSanitized: "<p>Lead paragraph.</p><h2>Deep section</h2><p>Crawler-visible body.</p>",
      seoTitle: "API SEO Post for crawlers",
      seoDescription: "A crawler-focused description.",
      ogImageId: "media-hero",
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

  it("detects rich HTML separately from legacy preformatted markdown", () => {
    expect(hasRenderableRichHtml("<h2>Intro</h2><p>Body</p>")).toBe(true);
    expect(hasRenderableRichHtml("<pre>## Intro\n\nBody</pre>")).toBe(false);
  });
});
