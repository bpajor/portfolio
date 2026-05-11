import { describe, expect, it } from "vitest";
import { countPendingComments, countPublishedPosts } from "./admin-stats";

describe("admin stats", () => {
  it("counts only published posts", () => {
    expect(
      countPublishedPosts([
        { status: "published" },
        { status: "draft" },
        { status: "published" },
        { status: "archived" }
      ])
    ).toBe(2);
  });

  it("counts pending comments from the moderation queue", () => {
    expect(
      countPendingComments([
        { status: "pending" },
        { status: "approved" },
        { status: "pending" },
        { status: "spam" }
      ])
    ).toBe(2);
  });
});
