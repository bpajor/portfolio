export type Project = {
  slug: string;
  title: string;
  eyebrow: string;
  summary: string;
  description: string;
  problem: string;
  built: string;
  signals: string[];
  stack: string[];
  href: string;
};

export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  readingTime: string;
  tags: string[];
  sections: Array<{
    heading: string;
    body: string;
  }>;
};

export const profile = {
  name: "Blazej Pajor",
  role: "Software Engineer",
  headline: "Building reliable backend platforms for cloud and AI workflows.",
  location: "Poland / Remote",
  company: "WP Engine",
  email: "blazej122@vp.pl",
  github: "https://github.com/bpajor/",
  linkedin: "https://www.linkedin.com/in/b%C5%82a%C5%BCej-pajor-837974238/",
  image: "/images/profile.jpg",
  focus: ["Go", "GCP", "Kubernetes", "LLM systems", "MCP", "PostgreSQL"]
};

export const projects: Project[] = [
  {
    slug: "pay-management-system",
    title: "Pay Management System",
    eyebrow: "Business operations",
    summary: "A system for monitoring employee payouts and keeping payroll-related workflows visible to internal users.",
    description: "A business application for monitoring employee payouts and operational payroll workflows.",
    problem: "Payroll visibility usually breaks down when calculations, approvals, and operational status live in separate places.",
    built: "Designed an application surface for tracking payout state, business rules, and operational review paths.",
    signals: ["Domain modeling", "Workflow state", "Admin-facing UX"],
    stack: ["Backend", "Business logic", "Internal tooling"],
    href: "https://github.com/bpajor/pay-man-sys"
  },
  {
    slug: "pol-elections-2023-rest-api",
    title: "PolElections2023 REST API",
    eyebrow: "Public data API",
    summary: "A REST API exposing Polish parliamentary election results from 2023 through structured endpoints.",
    description: "An API exposing Polish parliamentary election data with authenticated access patterns.",
    problem: "Election data is useful only when it can be queried predictably by district, committee, candidate, and result scope.",
    built: "Implemented an authenticated API layer for exploring election results and related entities through clear REST contracts.",
    signals: ["API design", "JWT auth", "Structured public data"],
    stack: ["Nest.js", "TypeScript", "Mongoose", "JWT"],
    href: "https://github.com/bpajor/PolElections2023-rest-api"
  }
];

export const posts: BlogPost[] = [
  {
    slug: "designing-low-cost-production-portfolio",
    title: "Designing a low-cost production portfolio platform",
    excerpt: "How I think about shaping a personal website as a real production system, not a static business card.",
    publishedAt: "2026-04-26",
    readingTime: "4 min read",
    tags: ["GCP", "PostgreSQL", "Security"],
    sections: [
      {
        heading: "The constraint is part of the architecture",
        body: "A small portfolio does not need heavyweight infrastructure, but it still benefits from production habits. The target is a compact GCP deployment with a Go API, PostgreSQL, backups, TLS, and a threat model that fits the size of the project."
      },
      {
        heading: "Keep the moving parts honest",
        body: "The public website can stay cache-friendly while the backend owns publishing, comments, and agent-facing context. That split keeps costs low and makes the system easier to reason about when traffic is quiet."
      },
      {
        heading: "Security before polish",
        body: "Admin access, comment moderation, database isolation, secure headers, and narrow firewall rules matter even for low-traffic software. Small systems are still systems, and the boring controls are what make later improvements safe."
      }
    ]
  },
  {
    slug: "mcp-as-a-portfolio-interface",
    title: "MCP as a portfolio interface for AI agents",
    excerpt: "A portfolio can expose structured, safe context to assistants without turning the admin surface into a free-for-all.",
    publishedAt: "2026-04-26",
    readingTime: "3 min read",
    tags: ["MCP", "Agentic AI", "Go"],
    sections: [
      {
        heading: "Agents need useful boundaries",
        body: "A good MCP server should expose clear read tools for profile, projects, posts, and site context. Write tools can exist later, but they need stronger authentication, audit logging, and narrower permissions."
      },
      {
        heading: "Structured content beats scraping",
        body: "When the website and API share the same domain model, agents can retrieve precise context instead of guessing from rendered HTML. That helps with GEO because the site can be understandable to crawlers, LLM systems, and humans at the same time."
      },
      {
        heading: "The interface becomes part of the portfolio",
        body: "For a backend and cloud engineer, the MCP layer is not a gimmick. It is a concrete way to show API design, security thinking, and practical AI infrastructure in one small surface."
      }
    ]
  }
];
