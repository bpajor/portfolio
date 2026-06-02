$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$composeFile = Join-Path $repoRoot "compose.dev.yml"
$migrationsDir = Join-Path $repoRoot "db\migrations"
$envFile = Join-Path $repoRoot ".env"

function Get-SchemaMigrations {
  Get-ChildItem $migrationsDir -File |
    Where-Object { $_.Name -match "^\d+.*\.sql$" } |
    Sort-Object Name |
    Where-Object {
      $raw = Get-Content -Raw $_.FullName
      $raw -match "-- \+goose Up" -and $raw -match "-- \+goose Down"
    }
}

function Get-DevEnvValue {
  param(
    [string]$Name,
    [string]$Fallback
  )

  $processValue = [Environment]::GetEnvironmentVariable($Name)
  if ($processValue) {
    return $processValue
  }

  if (Test-Path $envFile) {
    $line = Get-Content $envFile | Where-Object { $_ -match "^$Name=" } | Select-Object -First 1
    if ($line) {
      return ($line -replace "^$Name=", "").Trim().Trim('"').Trim("'")
    }
  }

  return $Fallback
}

$postgresUser = Get-DevEnvValue -Name "POSTGRES_USER" -Fallback "portfolio"
$postgresDb = Get-DevEnvValue -Name "POSTGRES_DB" -Fallback "portfolio"

Push-Location $repoRoot
try {
  docker compose -f $composeFile down -v
  docker compose -f $composeFile up -d postgres

  for ($i = 0; $i -lt 40; $i++) {
    docker compose -f $composeFile exec -T postgres pg_isready -U $postgresUser -d $postgresDb | Out-Null
    if ($LASTEXITCODE -eq 0) {
      break
    }
    Start-Sleep -Seconds 1
  }

  if ($LASTEXITCODE -ne 0) {
    throw "PostgreSQL did not become ready."
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
    $upSql | docker compose -f $composeFile exec -T postgres psql -v ON_ERROR_STOP=1 -U $postgresUser -d $postgresDb
  }
}
finally {
  Pop-Location
}
