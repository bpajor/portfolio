"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "../../../api-url";
import { AdminPost } from "../post-model";
import { PostForm } from "../post-form";

export function EditPost({ id }: { id: string }) {
  const [post, setPost] = useState<AdminPost | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    fetch(apiUrl(`/admin/posts/${id}`), { credentials: "include" })
      .then((response) => {
        if (!response.ok) {
          throw new Error("post unavailable");
        }
        return response.json() as Promise<AdminPost>;
      })
      .then((nextPost) => {
        if (!ignore) {
          setPost(nextPost);
        }
      })
      .catch(() => {
        if (!ignore) {
          setError("Post could not be loaded.");
        }
      });

    return () => {
      ignore = true;
    };
  }, [id]);

  if (error) {
    return <p className="text-sm text-red-300">{error}</p>;
  }

  if (!post) {
    return <p className="text-sm text-slate-400">Loading post...</p>;
  }

  return <PostForm post={post} />;
}
