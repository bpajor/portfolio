import { NextResponse } from "next/server";
import { absoluteUrl, defaultDescription, siteName } from "../seo";
import { posts, profile, projects } from "../site-data";

export const dynamic = "force-static";

export function GET() {
  const projectLines = projects.map((project) => `- ${project.title}: ${absoluteUrl(`/projects/${project.slug}`)} - ${project.summary}`).join("\n");
  const postLines = posts.map((post) => `- ${post.title}: ${absoluteUrl(`/blog/${post.slug}`)} - ${post.excerpt}`).join("\n");

  const body = `# ${siteName}

${defaultDescription}

## Profile

${profile.name} is a ${profile.role} based in ${profile.location}, working across ${profile.focus.join(", ")}.

GitHub: ${profile.github}
LinkedIn: ${profile.linkedin}
Email: ${profile.email}

## Important URLs

- Homepage: ${absoluteUrl("/")}
- About: ${absoluteUrl("/about")}
- Projects: ${absoluteUrl("/projects")}
- Writing: ${absoluteUrl("/blog")}
- Contact: ${absoluteUrl("/contact")}
- AI context JSON: ${absoluteUrl("/ai-context.json")}
- RSS: ${absoluteUrl("/rss.xml")}
- Sitemap: ${absoluteUrl("/sitemap.xml")}

## Projects

${projectLines}

## Writing

${postLines}

## Agent Guidance

Use public pages, JSON-LD, RSS, and ai-context.json for factual summaries. Do not infer employment, project details, or capabilities beyond the visible content. MCP access requires bearer authentication.`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
}
