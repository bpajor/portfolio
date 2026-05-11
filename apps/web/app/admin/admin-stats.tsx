"use client";

import { useEffect, useState } from "react";
import { FileText, MessageSquare, ShieldCheck, Sparkles } from "lucide-react";
import { apiUrl } from "../api-url";
import { Panel } from "./_components/admin-shell";
import { AdminPost } from "./posts/post-model";
import { CommentStatusLike, countPendingComments } from "./comments/comment-model";

export { countPendingComments } from "./comments/comment-model";

type AdminStatsProps = {
  featuredProjectsCount: number;
};

export function countPublishedPosts(posts: Array<Pick<AdminPost, "status">>) {
  return posts.filter((post) => post.status === "published").length;
}

export function AdminStats({ featuredProjectsCount }: AdminStatsProps) {
  const [publishedPostsCount, setPublishedPostsCount] = useState<number | null>(null);
  const [pendingCommentsCount, setPendingCommentsCount] = useState<number | null>(null);

  useEffect(() => {
    let ignore = false;

    fetch(apiUrl("/admin/posts"), { credentials: "include" })
      .then((response) => {
        if (!response.ok) {
          throw new Error("posts unavailable");
        }
        return response.json() as Promise<AdminPost[]>;
      })
      .then((posts) => {
        if (!ignore) {
          setPublishedPostsCount(countPublishedPosts(posts));
        }
      })
      .catch(() => {
        if (!ignore) {
          setPublishedPostsCount(0);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    fetch(apiUrl("/admin/comments?status=pending"), { credentials: "include" })
      .then((response) => {
        if (!response.ok) {
          throw new Error("comments unavailable");
        }
        return response.json() as Promise<CommentStatusLike[]>;
      })
      .then((comments) => {
        if (!ignore) {
          setPendingCommentsCount(countPendingComments(comments));
        }
      })
      .catch(() => {
        if (!ignore) {
          setPendingCommentsCount(0);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  const stats = [
    { label: "Published posts", value: publishedPostsCount === null ? "..." : publishedPostsCount, icon: FileText },
    { label: "Featured projects", value: featuredProjectsCount, icon: Sparkles },
    { label: "Pending comments", value: pendingCommentsCount === null ? "..." : pendingCommentsCount, icon: MessageSquare },
    { label: "Security checks", value: 4, icon: ShieldCheck }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Panel key={stat.label}>
            <Icon className="text-sky-300" size={20} aria-hidden="true" />
            <p className="mt-5 text-3xl font-semibold text-white">{stat.value}</p>
            <p className="mt-1 text-sm text-slate-400">{stat.label}</p>
          </Panel>
        );
      })}
    </div>
  );
}
