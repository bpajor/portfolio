import { describe, expect, it } from "vitest";
import { canSubmitComment, normalizeCommentDraft } from "./comment-form-model";

describe("public comment form model", () => {
  it("requires a display name and body before submission", () => {
    expect(canSubmitComment({ displayName: "", body: "Useful post." })).toBe(false);
    expect(canSubmitComment({ displayName: "Reader", body: "" })).toBe(false);
    expect(canSubmitComment({ displayName: "Reader", body: "Useful post." })).toBe(true);
  });

  it("trims public comment fields before sending them to the API", () => {
    expect(normalizeCommentDraft({ displayName: " Reader ", body: " Useful post. " })).toEqual({
      displayName: "Reader",
      body: "Useful post."
    });
  });
});
