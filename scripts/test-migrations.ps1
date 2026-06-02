$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$composeFile = Join-Path $repoRoot "compose.dev.yml"
$migrationsDir = Join-Path $repoRoot "db\migrations"
$seedFile = Join-Path $repoRoot "db\migrations\00002_seed_initial_posts.sql"

function Get-SchemaMigrations {
  Get-ChildItem $migrationsDir -File |
    Where-Object { $_.Name -match "^\d+.*\.sql$" } |
    Sort-Object Name |
    Where-Object {
      $raw = Get-Content -Raw $_.FullName
      $raw -match "-- \+goose Up" -and $raw -match "-- \+goose Down"
    }
}

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

  $schemaMigrations = @(Get-SchemaMigrations)
  if ($schemaMigrations.Count -eq 0) {
    throw "No schema migrations with goose Up/Down sections were found."
  }

  foreach ($migration in $schemaMigrations) {
    $parts = (Get-Content -Raw $migration.FullName) -split "-- \+goose Down"
    if ($parts.Count -ne 2) {
      throw "$($migration.Name) must contain exactly one goose Down section."
    }
    $upSql = ($parts[0] -replace "-- \+goose Up", "").Trim()
    $upSql | docker compose -f $composeFile exec -T postgres psql -v ON_ERROR_STOP=1 -U portfolio -d portfolio
  }
  Get-Content -Raw $seedFile | docker compose -f $composeFile exec -T postgres psql -v ON_ERROR_STOP=1 -U portfolio -d portfolio
  Get-Content -Raw $seedFile | docker compose -f $composeFile exec -T postgres psql -v ON_ERROR_STOP=1 -U portfolio -d portfolio
  docker compose -f $composeFile exec -T postgres psql -v ON_ERROR_STOP=1 -U portfolio -d portfolio -c "SELECT to_regclass('public.profile')" | Out-Null
  $mcpTokens = docker compose -f $composeFile exec -T postgres psql -tAc "SELECT to_regclass('public.mcp_tokens')" -U portfolio -d portfolio
  if ($mcpTokens.Trim() -ne "mcp_tokens") {
    throw "Up migrations did not create public.mcp_tokens."
  }
  $postCount = docker compose -f $composeFile exec -T postgres psql -tAc "SELECT count(*) FROM posts" -U portfolio -d portfolio
  if ([int]$postCount.Trim() -ne 2) {
    throw "Seed migration post count is $($postCount.Trim()), expected 2."
  }

  foreach ($migration in ($schemaMigrations | Sort-Object Name -Descending)) {
    $parts = (Get-Content -Raw $migration.FullName) -split "-- \+goose Down"
    $downSql = $parts[1].Trim()
    $downSql | docker compose -f $composeFile exec -T postgres psql -v ON_ERROR_STOP=1 -U portfolio -d portfolio
  }
  $result = docker compose -f $composeFile exec -T postgres psql -tAc "SELECT to_regclass('public.profile')" -U portfolio -d portfolio
  if ($result.Trim()) {
    throw "Down migration left public.profile in place."
  }
}
finally {
  docker compose -f $composeFile down -v
  Pop-Location
}
