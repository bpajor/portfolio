import { describe, expect, it } from "vitest";
import { markdownSections, readingTime, staticPostToPublicPost } from "./blog-model";

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
