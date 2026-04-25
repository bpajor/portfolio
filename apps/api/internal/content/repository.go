package content

import "context"

type Profile struct {
	FullName         string   `json:"fullName"`
	Headline         string   `json:"headline"`
	ShortBio         string   `json:"shortBio"`
	LongBio          string   `json:"longBio"`
	Location         string   `json:"location"`
	CurrentCompany   string   `json:"currentCompany"`
	FocusAreas       []string `json:"focusAreas"`
	Skills           []string `json:"skills"`
	GitHubURL        string   `json:"githubUrl"`
	LinkedInURL      string   `json:"linkedinUrl"`
	Email            string   `json:"email"`
	ProfileImagePath string   `json:"profileImagePath"`
}

type Project struct {
	Slug        string   `json:"slug"`
	Title       string   `json:"title"`
	Eyebrow     string   `json:"eyebrow"`
	Summary     string   `json:"summary"`
	Description string   `json:"description"`
	Problem     string   `json:"problem"`
	Built       string   `json:"built"`
	Signals     []string `json:"signals"`
	Stack       []string `json:"stack"`
	RepoURL     string   `json:"repoUrl"`
	DemoURL     *string  `json:"demoUrl"`
	SortOrder   int      `json:"sortOrder"`
	IsFeatured  bool     `json:"isFeatured"`
}

type Repository interface {
	GetProfile(ctx context.Context) (Profile, error)
	ListFeaturedProjects(ctx context.Context) ([]Project, error)
	GetProjectBySlug(ctx context.Context, slug string) (Project, bool, error)
}

type StaticRepository struct{}

func NewStaticRepository() StaticRepository {
	return StaticRepository{}
}

func (StaticRepository) GetProfile(context.Context) (Profile, error) {
	return Profile{
		FullName:         "Blazej Pajor",
		Headline:         "Software Engineer for reliable backend and AI-driven systems",
		ShortBio:         "Software Engineer working across backend development, cloud infrastructure, and AI-driven systems.",
		LongBio:          "I design, build, and maintain scalable systems using Go, PHP, Google Cloud Platform, and Kubernetes. My work focuses on reliability, performance optimization, and operating production cloud infrastructure. I am also expanding into LLM-based systems and Agentic AI, building automation and intelligent workflows with clear architecture and operational ownership.",
		Location:         "Poland / Remote",
		CurrentCompany:   "WP Engine",
		FocusAreas:       []string{"Backend development", "Cloud infrastructure", "Agentic AI"},
		Skills:           []string{"Go", "PHP", "Google Cloud Platform", "Kubernetes", "PostgreSQL", "LLM systems", "MCP"},
		GitHubURL:        "https://github.com/bpajor/",
		LinkedInURL:      "https://www.linkedin.com/in/b%C5%82a%C5%BCej-pajor-837974238/",
		Email:            "blazej122@vp.pl",
		ProfileImagePath: "/images/profile.jpg",
	}, nil
}

func (StaticRepository) ListFeaturedProjects(context.Context) ([]Project, error) {
	return projects(), nil
}

func (StaticRepository) GetProjectBySlug(_ context.Context, slug string) (Project, bool, error) {
	for _, project := range projects() {
		if project.Slug == slug {
			return project, true, nil
		}
	}
	return Project{}, false, nil
}

func projects() []Project {
	return []Project{
		{
			Slug:        "pay-management-system",
			Title:       "Pay Management System",
			Eyebrow:     "Business operations",
			Summary:     "A system for monitoring employee payouts and keeping payroll-related workflows visible to internal users.",
			Description: "A business application for monitoring employee payouts and operational payroll workflows.",
			Problem:     "Payroll visibility usually breaks down when calculations, approvals, and operational status live in separate places.",
			Built:       "Designed an application surface for tracking payout state, business rules, and operational review paths.",
			Signals:     []string{"Domain modeling", "Workflow state", "Admin-facing UX"},
			Stack:       []string{"Backend", "Business logic", "Internal tooling"},
			RepoURL:     "https://github.com/bpajor/pay-man-sys",
			SortOrder:   10,
			IsFeatured:  true,
		},
		{
			Slug:        "pol-elections-2023-rest-api",
			Title:       "PolElections2023 REST API",
			Eyebrow:     "Public data API",
			Summary:     "A REST API exposing Polish parliamentary election results from 2023 through structured endpoints.",
			Description: "An API exposing Polish parliamentary election data with authenticated access patterns.",
			Problem:     "Election data is useful only when it can be queried predictably by district, committee, candidate, and result scope.",
			Built:       "Implemented an authenticated API layer for exploring election results and related entities through clear REST contracts.",
			Signals:     []string{"API design", "JWT auth", "Structured public data"},
			Stack:       []string{"Nest.js", "TypeScript", "Mongoose", "JWT"},
			RepoURL:     "https://github.com/bpajor/PolElections2023-rest-api",
			SortOrder:   20,
			IsFeatured:  true,
		},
	}
}
