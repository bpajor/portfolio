import { NextResponse } from "next/server";
import { absoluteUrl, siteName } from "../seo";
import { posts } from "../site-data";

export const dynamic = "force-static";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function GET() {
  const items = posts
    .map((post) => {
      const url = absoluteUrl(`/blog/${post.slug}`);
      const body = post.sections.map((section) => `<h2>${escapeXml(section.heading)}</h2><p>${escapeXml(section.body)}</p>`).join("");
      return `
        <item>
          <title>${escapeXml(post.title)}</title>
          <link>${url}</link>
          <guid>${url}</guid>
          <description>${escapeXml(post.excerpt)}</description>
          <pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>
          <content:encoded><![CDATA[${body}]]></content:encoded>
        </item>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(siteName)} - Writing</title>
    <link>${absoluteUrl("/blog")}</link>
    <description>Technical writing on backend systems, GCP, Kubernetes, LLM systems, and MCP.</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8"
    }
  });
}
