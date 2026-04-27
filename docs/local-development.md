# Local Development

## PostgreSQL

The local database runs through Docker Compose and binds PostgreSQL only to loopback.

```powershell
npm run dev:db:up
```

Default connection string:

```text
postgres://portfolio:portfolio@127.0.0.1:55432/portfolio?sslmode=disable
```

Reset the development database and apply the initial migration:

```powershell
npm run dev:db:reset
```

This command deletes the local development PostgreSQL volume before recreating the database.

Useful alternatives:

```powershell
npm run dev:db:logs
npm run dev:db:down
make db-psql
```

## API

Copy `.env.example` to `.env`, then run:

```powershell
make api
```

## Docker Desktop Troubleshooting

If `docker ps` works but `docker images` or `docker image inspect postgres:13` hangs, restart Docker Desktop and the WSL backend:

```powershell
wsl --shutdown
```

If Docker Desktop does not recover after that, fully restart Docker Desktop and retry:

```powershell
docker version
docker image inspect postgres:13
docker compose -f compose.dev.yml up -d postgres
```

If Docker returns `Internal Server Error` for `docker compose` on Windows, make sure the active context is Docker Desktop's Linux engine:

```powershell
docker context ls
docker context use desktop-linux
```

If that still fails, stop Docker Desktop processes, run `wsl --shutdown`, start Docker Desktop again, and wait until `docker compose -f compose.dev.yml ps` responds normally.
