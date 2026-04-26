$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$composeFile = Join-Path $repoRoot "compose.dev.yml"
$migrationFile = Join-Path $repoRoot "db\migrations\00001_initial_schema.sql"
$envFile = Join-Path $repoRoot ".env"

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

  $upMigration = (Get-Content -Raw $migrationFile) -split "-- \+goose Down"
  $upMigration[0] | docker compose -f $composeFile exec -T postgres psql -U $postgresUser -d $postgresDb
}
finally {
  Pop-Location
}
