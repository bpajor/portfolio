export type AdminProject = {
  id: string;
  slug: string;
  title: string;
  eyebrow: string;
  summary: string;
  description: string;
  problem: string;
  built: string;
  signals: string[];
  stack: string[];
  repoUrl: string;
  demoUrl: string;
  sortOrder: number;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProjectPayload = {
  slug: string;
  title: string;
  eyebrow: string;
  summary: string;
  description: string;
  problem: string;
  built: string;
  signals: string[];
  stack: string[];
  repoUrl: string;
  demoUrl: string;
  sortOrder: number;
  isFeatured: boolean;
};

export function parseProjectList(value: FormDataEntryValue | string | null) {
  if (typeof value !== "string") {
    return [];
  }

  const seen = new Set<string>();
  const items: string[] = [];
  for (const item of value.split(",")) {
    const cleaned = item.trim();
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) {
      continue;
    }
    seen.add(key);
    items.push(cleaned);
  }
  return items;
}

export function buildProjectPayload(form: FormData): ProjectPayload {
  const text = (name: string) => String(form.get(name) ?? "").trim();
  const parsedSortOrder = Number.parseInt(text("sortOrder"), 10);

  return {
    slug: text("slug"),
    title: text("title"),
    eyebrow: text("eyebrow"),
    summary: text("summary"),
    description: text("description"),
    problem: text("problem"),
    built: text("built"),
    signals: parseProjectList(form.get("signals")),
    stack: parseProjectList(form.get("stack")),
    repoUrl: text("repoUrl"),
    demoUrl: text("demoUrl"),
    sortOrder: Number.isFinite(parsedSortOrder) ? parsedSortOrder : 0,
    isFeatured: form.get("isFeatured") === "on"
  };
}
