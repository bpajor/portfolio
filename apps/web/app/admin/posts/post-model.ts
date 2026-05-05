export type PostStatus = "draft" | "published" | "archived";

export type AdminPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  contentMarkdown?: string;
  status: PostStatus;
  publishedAt?: string;
  seoTitle: string;
  seoDescription: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type PostPayload = {
  slug: string;
  title: string;
  excerpt: string;
  contentMarkdown: string;
  status: PostStatus;
  seoTitle: string;
  seoDescription: string;
  tags: string[];
};

export function parseTags(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return [];
  }

  const seen = new Set<string>();
  const tags: string[] = [];
  for (const tag of value.split(",")) {
    const cleaned = tag.trim();
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) {
      continue;
    }
    seen.add(key);
    tags.push(cleaned);
  }
  return tags;
}

export function buildPostPayload(form: FormData, status: PostStatus): PostPayload {
  const text = (name: string) => String(form.get(name) ?? "").trim();

  return {
    slug: text("slug"),
    title: text("title"),
    excerpt: text("excerpt"),
    contentMarkdown: text("contentMarkdown"),
    status,
    seoTitle: text("seoTitle"),
    seoDescription: text("seoDescription"),
    tags: parseTags(form.get("tags"))
  };
}

export function formatPostDate(value?: string) {
  if (!value) {
    return "Not published";
  }
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}
