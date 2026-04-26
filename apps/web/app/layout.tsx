import type { Metadata, Viewport } from "next";
import "./globals.css";
import { absoluteUrl, defaultDescription, siteName, siteUrl } from "./seo";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteName} - Software Engineer`,
    template: `%s | ${siteName}`
  },
  description: defaultDescription,
  alternates: {
    canonical: absoluteUrl("/"),
    types: {
      "application/rss+xml": absoluteUrl("/rss.xml")
    }
  },
  openGraph: {
    title: `${siteName} - Software Engineer`,
    description: "Backend, cloud infrastructure, and AI systems portfolio by Blazej Pajor.",
    url: siteUrl,
    siteName,
    locale: "en_US",
    type: "website",
    images: [{ url: absoluteUrl("/images/profile.jpg"), width: 1200, height: 630, alt: siteName }]
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteName} - Software Engineer`,
    description: defaultDescription,
    images: [absoluteUrl("/images/profile.jpg")]
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1
    }
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
