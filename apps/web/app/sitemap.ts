import type { MetadataRoute } from "next";
import { absoluteUrl, publicRoutes } from "./seo";
import { getPublishedSeoPosts } from "./blog/server-posts";
import { getSeoProjects } from "./projects/server-projects";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [writingPosts, projects] = await Promise.all([getPublishedSeoPosts(), getSeoProjects()]);

  return publicRoutes(writingPosts, projects).map((route) => {
    const lastModified =
      "lastModified" in route && typeof route.lastModified === "string"
        ? route.lastModified
        : new Date().toISOString();

    return {
      url: absoluteUrl(route.path),
      lastModified,
      changeFrequency: route.changeFrequency,
      priority: route.priority
    };
  });
}
