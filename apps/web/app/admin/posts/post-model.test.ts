import { describe, expect, it } from "vitest";
import { buildPostPayload, formatPostDate, parseTags } from "./post-model";

describe("admin post model", () => {
  it("parses comma-separated tags without blanks or duplicates", () => {
    expect(parseTags("GCP, Go, gcp, , Security ")).toEqual(["GCP", "Go", "Security"]);
  });

  it("builds a trimmed post payload for publishing", () => {
    const form = new FormData();
    form.set("slug", " my-post ");
    form.set("title", " My Post ");
    form.set("excerpt", " Short summary ");
    form.set("contentMarkdown", " ## Intro ");
    form.set("seoTitle", " SEO title ");
    form.set("seoDescription", " SEO description ");
    form.set("tags", "Go, GCP");

    expect(buildPostPayload(form, "published")).toEqual({
      slug: "my-post",
      title: "My Post",
      excerpt: "Short summary",
      contentMarkdown: "## Intro",
      status: "published",
      seoTitle: "SEO title",
      seoDescription: "SEO description",
      tags: ["Go", "GCP"]
    });
  });

  it("formats missing publication dates as draft-friendly text", () => {
    expect(formatPostDate()).toBe("Not published");
  });
});
