export type AdminCommentStatus = "pending" | "approved" | "spam" | "deleted";

export type CommentStatusLike = {
  status: string;
};

export function countPendingComments(comments: CommentStatusLike[]) {
  return comments.filter((comment) => comment.status === "pending").length;
}

export function commentsForStatus<T extends CommentStatusLike>(comments: T[], status: AdminCommentStatus) {
  return comments.filter((comment) => comment.status === status);
}
