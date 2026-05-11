import { describe, expect, it } from "vitest";
import { commentsForStatus, countPendingComments } from "./comment-model";

describe("admin comment model", () => {
  it("counts pending comments", () => {
    expect(
      countPendingComments([
        { status: "pending" },
        { status: "approved" },
        { status: "pending" }
      ])
    ).toBe(2);
  });

  it("keeps the current moderation queue scoped to its selected status", () => {
    const comments = [
      { id: "comment-1", status: "approved" },
      { id: "comment-2", status: "pending" },
      { id: "comment-3", status: "spam" }
    ];

    expect(commentsForStatus(comments, "pending")).toEqual([{ id: "comment-2", status: "pending" }]);
  });
});
