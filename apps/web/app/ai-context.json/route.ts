import { NextResponse } from "next/server";
import { absoluteUrl, defaultDescription, siteName } from "../seo";
import { profile, projects } from "../site-data";
import { getPublishedSeoPosts } from "../blog/server-posts";

export const dynamic = "force-dynamic";

export async function GET() {
  const posts = await getPublishedSeoPosts();

  return NextResponse.json({
    site: {
      name: siteName,
      url: absoluteUrl("/"),
      language: "en",
      description: defaultDescription
    },
    person: {
      name: profile.name,
      role: profile.role,
      headline: profile.headline,
      location: profile.location,
      company: profile.company,
      focus: profile.focus,
      github: profile.github,
      linkedin: profile.linkedin,
      email: profile.email
    },
    projects: projects.map((project) => ({
      title: project.title,
      slug: project.slug,
      url: absoluteUrl(`/projects/${project.slug}`),
      repository: project.href,
      summary: project.summary,
      stack: project.stack,
      signals: project.signals
    })),
    writing: posts.map((post) => ({
      title: post.title,
      slug: post.slug,
      url: absoluteUrl(`/blog/${post.slug}`),
      excerpt: post.excerpt,
      publishedAt: post.publishedAt,
      tags: post.tags
    })),
    machineReadable: {
      llms: absoluteUrl("/llms.txt"),
      rss: absoluteUrl("/rss.xml"),
      sitemap: absoluteUrl("/sitemap.xml"),
      mcp: absoluteUrl("/mcp")
    },
    safety: {
      mcpRequiresBearerToken: true,
      adminActionsRequireSeparateToken: true,
      noShellOrArbitraryFileTools: true
    }
  });
}
