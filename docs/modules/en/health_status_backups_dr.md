# Module Health, Status, Backups and Disaster Recovery

## Status

- Type: minor module
- Value: 1 point
- Status: implemented and validated in the Docker environment
- Subject requirement: health checks, status page, automated backups, and
  disaster recovery procedure

This module monitors ClearTrend's main services, exposes their state on a
public page, automatically backs up PostgreSQL, and provides a testable restore
procedure.

## Architecture

```text
Browser
   |
   +--> /status
   |       |
   |       +--> /api/health
   |               |
   |               +--> Prisma --> PostgreSQL
   |               +--> FastAPI /health
   |
Docker healthcheck
   |
   +--> /api/health/live

Backup service
   |
   +--> pg_dump --> backups/*.sql
```

Responsibilities are separated:

- `/api/health/live` only verifies that the web server responds.
- `/api/health` checks the overall application state.
- `/status` presents that state to a user.
- The Docker `backup` service runs PostgreSQL backups.
- The `restore-check` and `restore` commands cover recovery.

This separation is important: an analysis outage must not make the status page
inaccessible.

## Health Checks

### Web Liveness

Endpoint:

```text
GET /api/health/live
```

Expected response:

```json
{
  "status": "ok",
  "service": "web",
  "timestamp": "2026-06-07T17:23:22.565Z"
}
```

This endpoint contacts neither PostgreSQL nor FastAPI. Docker uses it to know
whether the web container is alive.

### Global State

Endpoint:

```text
GET /api/health
```

The route performs two checks in parallel:

- PostgreSQL with a Prisma `SELECT 1` query.
- FastAPI with a call to `${ANALYSIS_URL}/health`, limited to 2 seconds.

Nominal response:

```json
{
  "status": "ok",
  "timestamp": "2026-06-07T17:23:22.565Z",
  "services": {
    "web": "ok",
    "database": "ok",
    "analysis": "ok"
  }
}
```

HTTP codes:

| Situation | Code |
|---|---:|
| PostgreSQL and FastAPI available | `200` |
| PostgreSQL unavailable | `503` |
| FastAPI unavailable or too slow | `503` |
| `ANALYSIS_URL` missing but PostgreSQL available | `200` with `analysis: "not_configured"` |

The last case is intentional in the current code. For a normal evaluation,
`ANALYSIS_URL` must be configured; an unconfigured analysis service should not
be presented as a complete operating state.

### Docker Healthchecks

Docker Compose monitors:

- `db` with `pg_isready`.
- `analysis` with its FastAPI `/health` endpoint.
- `web` with `/api/health/live`.

The web waits until PostgreSQL is healthy and the analysis container has
started. It does not wait for analysis to be healthy, which lets `/status`
display a degraded state during startup or an outage.

## Status Page

The public page is available here:

```text
http://localhost:3000/status
```

In HTTPS mode:

```text
https://localhost/status
```

It displays:

- global state;
- web state;
- PostgreSQL state;
- analysis service state;
- time of the last check.

The page queries `/api/health` every 15 seconds and also provides a refresh
button. It is available in English, French, and Spanish.

## Automated Backups

The Docker `backup` service uses the `postgres:17-alpine` image.

On startup, it:

1. waits until PostgreSQL is healthy;
2. immediately runs `pg_dump`;
3. writes the dump into `backups/`;
4. removes dumps older than the configured retention period;
5. waits before starting again.

File name:

```text
backups/transcendence_20260607T171804Z.sql
```

The timestamp is in UTC.

Creation is atomic: the dump is first written to a `.tmp` file, then renamed
only if `pg_dump` finishes successfully. A partial dump should therefore not
appear as a valid backup.

Files are created with restrictive permissions through `umask 077`. They are
ignored by Git.

### Backed-Up Data

The backup contains the PostgreSQL database:

- users and profiles;
- watchlists;
- settings;
- API keys;
- analyses, reports, and other Prisma tables.

CSV files from the analysis service are not backed up. They are considered a
cache that can be regenerated from data sources.

## Important Variables

Variables present in `.env`:

| Variable | Default value | Role |
|---|---|---|
| `POSTGRES_USER` | `transcendence` | PostgreSQL user |
| `POSTGRES_PASSWORD` | `transcendence` | PostgreSQL password |
| `POSTGRES_DB` | `transcendence` | Database backed up and restored |
| `DATABASE_URL` | Docker PostgreSQL URL | Prisma connection |
| `ANALYSIS_URL` | `http://analysis:8000` | FastAPI internal address |
| `BACKUP_INTERVAL_SECONDS` | `86400` | Interval between two backups, 24 h |
| `BACKUP_RETENTION_DAYS` | `7` | Dump retention duration |

Variables internal to scripts:

| Variable | Default value | Role |
|---|---|---|
| `POSTGRES_HOST` | `db` | PostgreSQL service name |
| `BACKUP_DIR` | `/backups` | Target directory in the container |

Example for hourly backups with three days of retention:

```env
BACKUP_INTERVAL_SECONDS=3600
BACKUP_RETENTION_DAYS=3
```

The `backup` service must be recreated after a `.env` change:

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --force-recreate backup
```

## Useful Commands

### Start the Project

```sh
make dev
```

The `backup` service is included in `make dev` and `make up`.

### Check Services

```sh
make ps
make health
```

Direct tests:

```sh
curl -i http://localhost:3000/api/health/live
curl -i http://localhost:3000/api/health
curl -i http://localhost:8000/health
```

View logs:

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs backup
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs analysis
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs web
```

### Create an Immediate Backup

```sh
make backup
```

Check the file:

```sh
ls -lh backups/
```

### Test a Dump Without Touching the Current Database

```sh
make restore-check file=backups/transcendence_YYYYMMDDTHHMMSSZ.sql
```

This command:

1. creates a temporary database;
2. restores the dump;
3. verifies that at least one public table exists;
4. removes the temporary database.

A valid response looks like:

```text
Restore check passed: 11 public tables restored from /backups/...
```

## Disaster Recovery Procedure

Warning: `make restore` replaces the current PostgreSQL database. Always run
`restore-check` first.

### Steps

1. List available dumps:

```sh
ls -lh backups/
```

2. Test the chosen dump:

```sh
make restore-check file=backups/transcendence_YYYYMMDDTHHMMSSZ.sql
```

3. Restore the database:

```sh
make restore file=backups/transcendence_YYYYMMDDTHHMMSSZ.sql
```

The restore command:

- temporarily stops `web` and `analysis`;
- deletes the current database;
- recreates an empty database;
- restores the dump with stop-on-first-SQL-error behavior;
- restarts `analysis` and `web`, even if restore fails.

4. Verify system recovery:

```sh
make health
make ps
```

5. Open:

```text
http://localhost:3000/status
```

## Degraded Mode Test

This scenario proves that the status page remains accessible during an analysis
outage.

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml stop analysis
curl -i http://localhost:3000/api/health/live
curl -i http://localhost:3000/api/health
curl -i http://localhost:3000/status
```

Expected result:

- `/api/health/live` returns `200`.
- `/api/health` returns `503` with `analysis: "error"`.
- `/status` returns `200` and shows analysis as unavailable.

Then restart the service:

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml start analysis
```

After preloading, `/api/health` should return to `200`.

## RPO and RTO

With default values:

- Target RPO: maximum 24 hours of lost data.
- Estimated RTO: a few minutes for this project-sized database.

RPO depends directly on `BACKUP_INTERVAL_SECONDS`. Hourly backups reduce RPO to
about one hour, but increase write count and disk usage.

## Test Performed

On June 7, 2026:

- all three services returned a nominal state;
- stopping FastAPI produced a global `503` without making `/status`
  inaccessible;
- FastAPI returning brought the global state back to `200`;
- a 22 KB PostgreSQL dump was created;
- the dump was restored into a temporary database;
- 11 public tables were found.

## Main Files

| File | Role |
|---|---|
| `web/src/app/api/health/route.ts` | Global health check |
| `web/src/app/api/health/live/route.ts` | Web liveness |
| `web/src/app/status/` | Public status page |
| `analysis/src/main.py` | FastAPI `/health` endpoint |
| `docker-compose.yml` | Healthchecks and `backup` service |
| `scripts/backup-db.sh` | Dump creation |
| `scripts/backup-loop.sh` | Dump scheduling |
| `scripts/restore-check.sh` | Non-destructive dump test |
| `Makefile` | User commands |
| `.env.example` | Documented configuration |

## Known Limitations

This implementation is sufficient for the subject module, but it should not be
presented as a complete production strategy:

- dumps remain on the same machine as the project;
- they are not encrypted;
- no remote or off-site copy is made;
- no alert is sent on failure;
- the `backup` service is not included in `/api/health`;
- the automated test verifies tables, not the business content of every table.

For real production, encrypted remote storage, external rotation, alerts, and
regular restore exercises should be added.

## Quick Demonstration Flow

1. Open `/status` and show the three services operational.
2. Run `make backup`.
3. Show the new file in `backups/`.
4. Run `make restore-check file=...`.
5. Show the message confirming restored tables.
6. Stop `analysis` and show the global `503` with `/status` still accessible.
7. Restart `analysis` and show the return to the operational state.
