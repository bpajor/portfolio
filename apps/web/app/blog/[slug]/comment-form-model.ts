export type CommentDraft = {
  displayName: string;
  body: string;
};

export function normalizeCommentDraft(draft: CommentDraft): CommentDraft {
  return {
    displayName: draft.displayName.trim(),
    body: draft.body.trim()
  };
}

export function canSubmitComment(draft: CommentDraft) {
  const normalized = normalizeCommentDraft(draft);
  return normalized.displayName.length > 0 && normalized.body.length > 0;
}
