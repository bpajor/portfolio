$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$composeFile = Join-Path $repoRoot "compose.dev.yml"
$migrationFile = Join-Path $repoRoot "db\migrations\00001_initial_schema.sql"
$seedFile = Join-Path $repoRoot "db\migrations\00002_seed_initial_posts.sql"

Push-Location $repoRoot
try {
  docker compose -f $composeFile down -v
  docker compose -f $composeFile up -d postgres

  $ready = $false
  for ($i = 0; $i -lt 60; $i++) {
    docker compose -f $composeFile exec -T postgres pg_isready -U portfolio -d portfolio 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
      $ready = $true
      break
    }
    Start-Sleep -Seconds 1
  }

  if (-not $ready) {
    docker compose -f $composeFile logs postgres
    throw "PostgreSQL database 'portfolio' did not become ready."
  }

  $parts = (Get-Content -Raw $migrationFile) -split "-- \+goose Down"
  if ($parts.Count -ne 2) {
    throw "Migration file must contain exactly one goose Down section."
  }

  $upSql = ($parts[0] -replace "-- \+goose Up", "").Trim()
  $downSql = $parts[1].Trim()

  $upSql | docker compose -f $composeFile exec -T postgres psql -v ON_ERROR_STOP=1 -U portfolio -d portfolio
  Get-Content -Raw $seedFile | docker compose -f $composeFile exec -T postgres psql -v ON_ERROR_STOP=1 -U portfolio -d portfolio
  Get-Content -Raw $seedFile | docker compose -f $composeFile exec -T postgres psql -v ON_ERROR_STOP=1 -U portfolio -d portfolio
  docker compose -f $composeFile exec -T postgres psql -v ON_ERROR_STOP=1 -U portfolio -d portfolio -c "SELECT to_regclass('public.profile')" | Out-Null
  $postCount = docker compose -f $composeFile exec -T postgres psql -tAc "SELECT count(*) FROM posts" -U portfolio -d portfolio
  if ([int]$postCount.Trim() -ne 2) {
    throw "Seed migration post count is $($postCount.Trim()), expected 2."
  }

  $downSql | docker compose -f $composeFile exec -T postgres psql -v ON_ERROR_STOP=1 -U portfolio -d portfolio
  $result = docker compose -f $composeFile exec -T postgres psql -tAc "SELECT to_regclass('public.profile')" -U portfolio -d portfolio
  if ($result.Trim()) {
    throw "Down migration left public.profile in place."
  }
}
finally {
  docker compose -f $composeFile down -v
  Pop-Location
}
