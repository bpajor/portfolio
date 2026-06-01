"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { apiUrl } from "../../api-url";
import { posts as staticPosts } from "../../site-data";
import { CommentsSection } from "./comments-section";
import { PublicPost, formatPublishedDate, hasRenderableRichHtml, markdownSections, readingTime, staticPostToPublicPost } from "../blog-model";

const fallbackPosts = staticPosts.map(staticPostToPublicPost);

export function BlogPostClient({ slug, initialPost }: { slug: string; initialPost?: PublicPost | null }) {
  const fallbackPost = fallbackPosts.find((post) => post.slug === slug) ?? null;
  const [post, setPost] = useState<PublicPost | null>(initialPost ?? fallbackPost);
  const [isMissing, setMissing] = useState(!initialPost && !fallbackPost);

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

  const renderRichHtml = hasRenderableRichHtml(post.contentHtmlSanitized);
  const sections = markdownSections(post.contentMarkdown ?? "");
  const readingSource = post.contentHtmlSanitized && renderRichHtml ? post.contentHtmlSanitized : post.contentMarkdown ?? post.excerpt;

  return (
    <article className="mx-auto max-w-3xl px-5 py-12 md:py-16">
      <Link href="/blog" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
        <ArrowLeft size={16} aria-hidden="true" />
        Writing
      </Link>
      <div className="mt-8 font-mono text-xs uppercase text-slate-500">
        {formatPublishedDate(post.publishedAt)} / {readingTime(readingSource)}
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
      {post.ogImageId ? (
        // eslint-disable-next-line @next/next/no-img-element -- Uploaded media has unknown dimensions, so native img preserves the original aspect ratio without cropping.
        <img
          src={apiUrl(`/media/${post.ogImageId}`)}
          alt={post.title}
          className="mx-auto mt-8 max-h-[72vh] max-w-full rounded-md border border-white/10"
        />
      ) : null}

      {renderRichHtml ? (
        <div
          className="mt-10 border-t border-white/10 pt-8 text-base leading-7 text-slate-300 [&>*+*]:mt-5 [&_a]:text-sky-300 [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-sky-300/50 [&_blockquote]:pl-4 [&_blockquote]:text-slate-200 [&_code]:rounded [&_code]:bg-slate-900 [&_code]:px-1 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-white [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-white [&_img]:mx-auto [&_img]:max-h-[72vh] [&_img]:max-w-full [&_img]:rounded-md [&_img]:border [&_img]:border-white/10 [&_li+li]:mt-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-slate-900 [&_pre]:p-4 [&_strong]:text-white [&_ul]:list-disc [&_ul]:pl-6"
          dangerouslySetInnerHTML={{ __html: post.contentHtmlSanitized ?? "" }}
        />
      ) : (
        <div className="mt-10 space-y-8 border-t border-white/10 pt-8">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-xl font-semibold text-white md:text-2xl">{section.heading}</h2>
              {section.body ? <p className="mt-3 whitespace-pre-line text-base leading-7 text-slate-400">{section.body}</p> : null}
            </section>
          ))}
        </div>
      )}
      <CommentsSection slug={post.slug} />
    </article>
  );
}
