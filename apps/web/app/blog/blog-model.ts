import { BlogPost } from "../site-data";

export type PublicPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  contentMarkdown?: string;
  status: "published";
  publishedAt?: string;
  seoTitle?: string;
  seoDescription?: string;
  tags: string[];
};

export type MarkdownSection = {
  heading: string;
  body: string;
};

export type SeoBlogPost = BlogPost & {
  id?: string;
  contentMarkdown?: string;
  seoTitle?: string;
  seoDescription?: string;
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

export function publicPostToBlogPost(post: PublicPost): SeoBlogPost {
  const sections = markdownSections(post.contentMarkdown ?? "");

  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    contentMarkdown: post.contentMarkdown,
    publishedAt: post.publishedAt ?? new Date().toISOString(),
    readingTime: readingTime(post.contentMarkdown ?? post.excerpt),
    tags: post.tags,
    sections: sections.length > 0 ? sections : [{ heading: "Article", body: post.excerpt }],
    seoTitle: post.seoTitle,
    seoDescription: post.seoDescription
  };
}

export function blogPostToPublicPost(post: SeoBlogPost): PublicPost {
  return {
    id: post.id ?? post.slug,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    contentMarkdown: post.contentMarkdown ?? post.sections.map((section) => `## ${section.heading}\n\n${section.body}`).join("\n\n"),
    status: "published",
    publishedAt: post.publishedAt,
    seoTitle: post.seoTitle,
    seoDescription: post.seoDescription,
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
