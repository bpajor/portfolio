WITH seed_posts(slug, title, excerpt, content_markdown, seo_title, seo_description, published_at) AS (
  VALUES
    (
      'designing-low-cost-production-portfolio',
      'Designing a low-cost production portfolio platform',
      'How I think about shaping a personal website as a real production system, not a static business card.',
      '## The constraint is part of the architecture

A small portfolio does not need heavyweight infrastructure, but it still benefits from production habits. The target is a compact GCP deployment with a Go API, PostgreSQL, backups, TLS, and a threat model that fits the size of the project.

## Keep the moving parts honest

The public website can stay cache-friendly while the backend owns publishing, comments, and agent-facing context. That split keeps costs low and makes the system easier to reason about when traffic is quiet.

## Security before polish

Admin access, comment moderation, database isolation, secure headers, and narrow firewall rules matter even for low-traffic software. Small systems are still systems, and the boring controls are what make later improvements safe.',
      'Designing a low-cost production portfolio platform',
      'How I think about shaping a personal website as a real production system, not a static business card.',
      '2026-04-26T00:00:00Z'::timestamptz
    ),
    (
      'mcp-as-a-portfolio-interface',
      'MCP as a portfolio interface for AI agents',
      'A portfolio can expose structured, safe context to assistants without turning the admin surface into a free-for-all.',
      '## Agents need useful boundaries

A good MCP server should expose clear read tools for profile, projects, posts, and site context. Write tools can exist later, but they need stronger authentication, audit logging, and narrower permissions.

## Structured content beats scraping

When the website and API share the same domain model, agents can retrieve precise context instead of guessing from rendered HTML. That helps with GEO because the site can be understandable to crawlers, LLM systems, and humans at the same time.

## The interface becomes part of the portfolio

For a backend and cloud engineer, the MCP layer is not a gimmick. It is a concrete way to show API design, security thinking, and practical AI infrastructure in one small surface.',
      'MCP as a portfolio interface for AI agents',
      'A portfolio can expose structured, safe context to assistants without turning the admin surface into a free-for-all.',
      '2026-04-26T00:00:00Z'::timestamptz
    )
),
inserted AS (
  INSERT INTO posts (
    slug,
    title,
    excerpt,
    content_markdown,
    content_html_sanitized,
    status,
    published_at,
    seo_title,
    seo_description
  )
  SELECT
    slug,
    title,
    excerpt,
    content_markdown,
    '<pre>' || replace(replace(replace(content_markdown, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</pre>',
    'published'::post_status,
    published_at,
    seo_title,
    seo_description
  FROM seed_posts
  ON CONFLICT (slug) DO NOTHING
  RETURNING id, slug
),
seeded AS (
  SELECT posts.id, posts.slug
  FROM posts
  JOIN seed_posts ON seed_posts.slug = posts.slug
),
seed_tags(slug, tag) AS (
  VALUES
    ('designing-low-cost-production-portfolio', 'GCP'),
    ('designing-low-cost-production-portfolio', 'PostgreSQL'),
    ('designing-low-cost-production-portfolio', 'Security'),
    ('mcp-as-a-portfolio-interface', 'MCP'),
    ('mcp-as-a-portfolio-interface', 'Agentic AI'),
    ('mcp-as-a-portfolio-interface', 'Go')
)
INSERT INTO post_tags (post_id, tag)
SELECT seeded.id, seed_tags.tag
FROM seeded
JOIN seed_tags ON seed_tags.slug = seeded.slug
ON CONFLICT DO NOTHING;
