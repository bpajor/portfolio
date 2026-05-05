"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { apiUrl } from "../../api-url";
import { posts as staticPosts } from "../../site-data";
import { CommentsSection } from "./comments-section";
import { PublicPost, formatPublishedDate, markdownSections, readingTime, staticPostToPublicPost } from "../blog-model";

const fallbackPosts = staticPosts.map(staticPostToPublicPost);

export function BlogPostClient({ slug }: { slug: string }) {
  const fallbackPost = fallbackPosts.find((post) => post.slug === slug) ?? null;
  const [post, setPost] = useState<PublicPost | null>(fallbackPost);
  const [isMissing, setMissing] = useState(false);

  useEffect(() => {
    let ignore = false;

    fetch(apiUrl(`/posts/${slug}`))
      .then((response) => {
        if (response.status === 404) {
          return null;
        }
        return response.ok ? response.json() : fallbackPost;
      })
      .then((nextPost: PublicPost | null) => {
        if (ignore) {
          return;
        }
        setPost(nextPost);
        setMissing(!nextPost);
      })
      .catch(() => {
        if (!ignore) {
          setPost(fallbackPost);
          setMissing(!fallbackPost);
        }
      });

    return () => {
      ignore = true;
    };
  }, [fallbackPost, slug]);

  if (isMissing) {
    return (
      <article className="mx-auto max-w-3xl px-5 py-12 md:py-16">
        <Link href="/blog" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <ArrowLeft size={16} aria-hidden="true" />
          Writing
        </Link>
        <h1 className="mt-8 text-3xl font-semibold tracking-tight text-white">Post not found</h1>
      </article>
    );
  }

  if (!post) {
    return <p className="mx-auto max-w-3xl px-5 py-12 text-sm text-slate-400">Loading post...</p>;
  }

  const sections = markdownSections(post.contentMarkdown ?? "");

  return (
    <article className="mx-auto max-w-3xl px-5 py-12 md:py-16">
      <Link href="/blog" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
        <ArrowLeft size={16} aria-hidden="true" />
        Writing
      </Link>
      <div className="mt-8 font-mono text-xs uppercase text-slate-500">
        {formatPublishedDate(post.publishedAt)} / {readingTime(post.contentMarkdown ?? post.excerpt)}
      </div>
      <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-white md:text-5xl">
        {post.title}
      </h1>
      <p className="mt-5 text-base leading-7 text-slate-300 md:text-lg md:leading-8">{post.excerpt}</p>
      <div className="mt-6 flex flex-wrap gap-2">
        {post.tags.map((tag) => (
          <span key={tag} className="rounded-full border border-emerald-300/20 bg-emerald-300/5 px-3 py-1 text-xs text-emerald-100">
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-10 space-y-8 border-t border-white/10 pt-8">
        {sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-xl font-semibold text-white md:text-2xl">{section.heading}</h2>
            {section.body ? <p className="mt-3 whitespace-pre-line text-base leading-7 text-slate-400">{section.body}</p> : null}
          </section>
        ))}
      </div>
      <CommentsSection slug={post.slug} />
    </article>
  );
}
