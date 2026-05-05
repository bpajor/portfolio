import type { Metadata } from "next";
import { SiteFrame } from "../../_components/site-frame";
import { posts } from "../../site-data";
import { JsonLd, blogPostJsonLd, breadcrumbJsonLd, pageMetadata } from "../../seo";
import { BlogPostClient } from "./blog-post-client";

export function generateStaticParams() {
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = posts.find((item) => item.slug === slug);
  if (!post) {
    return pageMetadata({
      title: "Writing",
      description: "Technical writing by Blazej Pajor.",
      path: `/blog/${slug}`,
      type: "article"
    });
  }
  return pageMetadata({
    title: post.title,
    description: post.excerpt,
    path: `/blog/${post.slug}`,
    type: "article",
    publishedTime: post.publishedAt,
    tags: post.tags
  });
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const staticPost = posts.find((item) => item.slug === slug);

  return (
    <SiteFrame>
      {staticPost ? (
        <JsonLd
          data={[
            blogPostJsonLd(staticPost),
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Writing", path: "/blog" },
              { name: staticPost.title, path: `/blog/${staticPost.slug}` }
            ])
          ]}
        />
      ) : null}
      <BlogPostClient slug={slug} />
    </SiteFrame>
  );
}
