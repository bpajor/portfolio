import type { Metadata } from "next";
import { SiteFrame } from "../../_components/site-frame";
import { posts } from "../../site-data";
import { JsonLd, blogPostJsonLd, breadcrumbJsonLd, pageMetadata } from "../../seo";
import { BlogPostClient } from "./blog-post-client";
import { getPublishedSeoPost, seoPostToPublicPost } from "../server-posts";

export function generateStaticParams() {
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedSeoPost(slug);
  if (!post) {
    return pageMetadata({
      title: "Writing",
      description: "Technical writing by Blazej Pajor.",
      path: `/blog/${slug}`,
      type: "article"
    });
  }
  return pageMetadata({
    title: post.seoTitle ?? post.title,
    description: post.seoDescription ?? post.excerpt,
    path: `/blog/${post.slug}`,
    type: "article",
    publishedTime: post.publishedAt,
    tags: post.tags
  });
}

export const dynamic = "force-dynamic";

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPublishedSeoPost(slug);
  const publicPost = post ? seoPostToPublicPost(post) : null;

  return (
    <SiteFrame>
      {post ? (
        <JsonLd
          data={[
            blogPostJsonLd(post),
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Writing", path: "/blog" },
              { name: post.title, path: `/blog/${post.slug}` }
            ])
          ]}
        />
      ) : null}
      <BlogPostClient slug={slug} initialPost={publicPost} />
    </SiteFrame>
  );
}
