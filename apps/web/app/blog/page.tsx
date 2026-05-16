import type { Metadata } from "next";
import { PageIntro, SiteFrame } from "../_components/site-frame";
import { JsonLd, breadcrumbJsonLd, pageMetadata } from "../seo";
import { BlogList } from "./blog-list";
import { getPublishedPublicPosts } from "./server-posts";

const title = "Writing";
const description =
  "Technical writing by Blazej Pajor on backend architecture, GCP operations, LLM systems, MCP, and production engineering.";

export const metadata: Metadata = pageMetadata({
  title,
  description,
  path: "/blog"
});

export const dynamic = "force-dynamic";

export default async function BlogPage() {
  const posts = await getPublishedPublicPosts({ fallbackToStatic: false });

  return (
    <SiteFrame>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Writing", path: "/blog" }
        ])}
      />
      <PageIntro
        eyebrow="Writing"
        title="Technical writing as an engineering notebook."
        body="Notes on backend architecture, GCP operations, LLM systems, and the process of building this portfolio as a small but real production platform."
      />

      <BlogList initialPosts={posts} />
    </SiteFrame>
  );
}
