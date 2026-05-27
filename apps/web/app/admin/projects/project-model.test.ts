import { describe, expect, it } from "vitest";
import { buildProjectPayload, parseProjectList } from "./project-model";

describe("admin project model", () => {
  it("parses comma-separated project lists without blanks or duplicates", () => {
    expect(parseProjectList("Go, Next.js, go, , PostgreSQL ")).toEqual(["Go", "Next.js", "PostgreSQL"]);
  });

  it("builds a trimmed project payload", () => {
    const form = new FormData();
    form.set("slug", " project-crud ");
    form.set("title", " Project CRUD ");
    form.set("eyebrow", " Admin ");
    form.set("summary", " Short summary ");
    form.set("description", " Public description ");
    form.set("problem", " Problem text ");
    form.set("built", " Built text ");
    form.set("signals", "Admin, CRUD");
    form.set("stack", "Go, Next.js");
    form.set("repoUrl", " https://github.com/bpajor/portfolio ");
    form.set("demoUrl", " https://bpajor.dev/projects/project-crud ");
    form.set("sortOrder", " 7 ");
    form.set("isFeatured", "on");

    expect(buildProjectPayload(form)).toEqual({
      slug: "project-crud",
      title: "Project CRUD",
      eyebrow: "Admin",
      summary: "Short summary",
      description: "Public description",
      problem: "Problem text",
      built: "Built text",
      signals: ["Admin", "CRUD"],
      stack: ["Go", "Next.js"],
      repoUrl: "https://github.com/bpajor/portfolio",
      demoUrl: "https://bpajor.dev/projects/project-crud",
      sortOrder: 7,
      isFeatured: true
    });
  });

  it("uses empty demo URL and unfeatured defaults", () => {
    const form = new FormData();
    form.set("title", "Hidden Project");

    const payload = buildProjectPayload(form);

    expect(payload.demoUrl).toBe("");
    expect(payload.isFeatured).toBe(false);
    expect(payload.sortOrder).toBe(0);
  });
});
