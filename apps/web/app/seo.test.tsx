import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  JsonLd,
  absoluteUrl,
  blogPostJsonLd,
  breadcrumbJsonLd,
  pageMetadata,
  personJsonLd,
  publicRoutes
} from "./seo";
import { posts, profile, projects } from "./site-data";

describe("SEO and GEO helpers", () => {
  it("builds absolute URLs from the configured site URL", () => {
    expect(absoluteUrl("/blog")).toBe("http://localhost:3000/blog");
    expect(absoluteUrl("projects")).toBe("http://localhost:3000/projects");
  });

  it("builds canonical metadata with Open Graph and Twitter images", () => {
    const metadata = pageMetadata({
      title: "Projects",
      description: "Selected systems work.",
      path: "/projects"
    });

    expect(metadata.alternates?.canonical).toBe("http://localhost:3000/projects");
    expect(metadata.openGraph?.title).toBe("Projects");
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("escapes JSON-LD script content", () => {
    const html = renderToStaticMarkup(<JsonLd data={{ name: "<script>alert(1)</script>" }} />);

    expect(html).toContain("application/ld+json");
    expect(html).toContain("\\u003cscript>");
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  it("describes the profile as a Person entity", () => {
    const jsonLd = personJsonLd();

    expect(jsonLd["@type"]).toBe("Person");
    expect(jsonLd.name).toBe(profile.name);
    expect(jsonLd.sameAs).toEqual([profile.github, profile.linkedin]);
    expect(jsonLd.knowsAbout).toContain("GCP");
  });

  it("keeps sitemap routes in sync with known projects and posts", () => {
    const routePaths = publicRoutes().map((route) => route.path);

    for (const project of projects) {
      expect(routePaths).toContain(`/projects/${project.slug}`);
    }
    for (const post of posts) {
      expect(routePaths).toContain(`/blog/${post.slug}`);
    }
  });

  it("can include API-published posts in sitemap routes", () => {
    const routePaths = publicRoutes([
      {
        slug: "api-seo-post",
        title: "API SEO Post",
        excerpt: "An API-published article.",
        publishedAt: "2026-05-16T12:00:00Z",
        readingTime: "1 min read",
        tags: ["SEO"],
        sections: [{ heading: "Article", body: "Crawler-visible body." }]
      }
    ]).map((route) => route.path);

    expect(routePaths).toContain("/blog/api-seo-post");
  });

  it("builds article JSON-LD with readable content", () => {
    const post = posts[0];
    const jsonLd = blogPostJsonLd(post);

    expect(jsonLd["@type"]).toBe("BlogPosting");
    expect(jsonLd.headline).toBe(post.title);
    expect(jsonLd.articleBody).toContain(post.sections[0].heading);
    expect(jsonLd.keywords).toBe(post.tags.join(", "));
  });

  it("builds ordered breadcrumbs", () => {
    const jsonLd = breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Projects", path: "/projects" }
    ]);

    expect(jsonLd.itemListElement).toHaveLength(2);
    expect(jsonLd.itemListElement[1]).toMatchObject({
      position: 2,
      name: "Projects",
      item: "http://localhost:3000/projects"
    });
  });
});
