import { BlogPost } from "../site-data";

export type PublicPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  contentMarkdown?: string;
  status: "published";
  publishedAt?: string;
  tags: string[];
};

export type MarkdownSection = {
  heading: string;
  body: string;
};

export function staticPostToPublicPost(post: BlogPost): PublicPost {
  return {
    id: post.slug,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    contentMarkdown: post.sections.map((section) => `## ${section.heading}\n\n${section.body}`).join("\n\n"),
    status: "published",
    publishedAt: post.publishedAt,
    tags: post.tags
  };
}

export function formatPublishedDate(value?: string) {
  if (!value) {
    return "Draft";
  }
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

export function readingTime(content = "") {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.ceil(words / 200))} min read`;
}

export function markdownSections(markdown = ""): MarkdownSection[] {
  const sections: MarkdownSection[] = [];
  let current: MarkdownSection | null = null;

  for (const line of markdown.split(/\r?\n/)) {
    if (line.startsWith("## ")) {
      if (current) {
        sections.push({ heading: current.heading, body: current.body.trim() });
      }
      current = { heading: line.replace(/^##\s+/, "").trim(), body: "" };
      continue;
    }

    if (!current) {
      current = { heading: "Article", body: "" };
    }
    current.body += `${line}\n`;
  }

  if (current) {
    sections.push({ heading: current.heading, body: current.body.trim() });
  }

  return sections.filter((section) => section.heading || section.body);
}
