import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Blazej Pajor - Software Engineer",
    template: "%s | Blazej Pajor"
  },
  description:
    "Software Engineer focused on backend systems, GCP, Kubernetes, reliability, and AI-driven workflows.",
  openGraph: {
    title: "Blazej Pajor - Software Engineer",
    description:
      "Backend, cloud infrastructure, and AI systems portfolio by Blazej Pajor.",
    url: siteUrl,
    siteName: "Blazej Pajor",
    images: [{ url: "/images/profile.jpg", width: 1200, height: 630 }]
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
