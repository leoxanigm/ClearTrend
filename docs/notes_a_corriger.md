# Notes a corriger

Petite liste des points techniques a reprendre plus tard. Garder ce document
court: une note = un probleme, son impact, et une piste simple.

## Watchlist chargee en entier a la connexion

Probleme:

- A l'ouverture du dashboard, l'utilisateur voit rapidement la liste, puis le
  client recharge les donnees marche pour toute la watchlist.
- Avec plusieurs navigateurs ou plusieurs instances ouvertes, cela peut ralentir
  l'affichage des prix et variations.

Impact:

- Ce n'est pas un probleme de compatibilite navigateur.
- Cela peut fragiliser la demo si plusieurs personnes testent le dashboard en
  meme temps.

Pistes:

- Charger seulement les premiers symboles visibles au depart.
- Charger le symbole selectionne en priorite.
- Ajouter un chargement progressif ou pagine pour le reste de la watchlist.
- Mettre en cache les snapshots cote `web` ou `analysis` pour eviter de relire
  tous les fichiers a chaque instance.
- Limiter la watchlist demo par defaut si besoin pendant l'evaluation.




make[1]: Leaving directory '/home/esteb/transcendence'
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f db analysis web
analysis-1  | INFO:     Will watch for changes in these directories: ['/app']
analysis-1  | INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
analysis-1  | INFO:     Started reloader process [23] using WatchFiles
db-1        | 
db-1        | PostgreSQL Database directory appears to contain a database; Skipping initialization
db-1        | 
analysis-1  | INFO:     Started server process [25]
analysis-1  | INFO:     Waiting for application startup.
analysis-1  | INFO:     Application startup complete.
analysis-1  | Failed to read finance refresh rate setting.
analysis-1  | Traceback (most recent call last):
analysis-1  |   File "/app/src/app_settings.py", line 55, in get_finance_refresh_rate_duration
db-1        | 2026-06-05 12:00:34.610 UTC [1] LOG:  starting PostgreSQL 17.9 on x86_64-pc-linux-musl, compiled by gcc (Alpine 15.2.0) 15.2.0, 64-bit
db-1        | 2026-06-05 12:00:34.611 UTC [1] LOG:  listening on IPv4 address "0.0.0.0", port 5432
db-1        | 2026-06-05 12:00:34.611 UTC [1] LOG:  listening on IPv6 address "::", port 5432
db-1        | 2026-06-05 12:00:34.618 UTC [1] LOG:  listening on Unix socket "/var/run/postgresql/.s.PGSQL.5432"
analysis-1  |     cur.execute(
analysis-1  |     ~~~~~~~~~~~^
analysis-1  |         """
analysis-1  |         ^^^
analysis-1  |     ...<5 lines>...
analysis-1  |         (FINANCE_REFRESH_RATE_SETTING_KEY,),
analysis-1  |         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
analysis-1  |     )
analysis-1  |     ^
db-1        | 2026-06-05 12:00:34.628 UTC [29] LOG:  database system was interrupted; last known up at 2026-06-04 22:21:59 UTC
db-1        | 2026-06-05 12:00:35.587 UTC [29] LOG:  database system was not properly shut down; automatic recovery in progress
analysis-1  |   File "/usr/local/lib/python3.13/site-packages/psycopg/cursor.py", line 97, in execute
analysis-1  |     raise ex.with_traceback(None)
analysis-1  | psycopg.errors.UndefinedTable: relation "app_settings" does not exist
analysis-1  | LINE 3:                     FROM app_settings
analysis-1  |                                  ^
analysis-1  | INFO:     127.0.0.1:54462 - "GET /health HTTP/1.1" 200 OK
analysis-1  | INFO:     172.20.0.4:55424 - "GET /health HTTP/1.1" 200 OK
analysis-1  | INFO:     127.0.0.1:41482 - "GET /health HTTP/1.1" 200 OK
analysis-1  | INFO:     172.20.0.4:56342 - "GET /health HTTP/1.1" 200 OK
db-1        | 2026-06-05 12:00:35.592 UTC [29] LOG:  redo starts at 0/24EA1B0
db-1        | 2026-06-05 12:00:35.592 UTC [29] LOG:  invalid record length at 0/24EA2B8: expected at least 24, got 0
db-1        | 2026-06-05 12:00:35.592 UTC [29] LOG:  redo done at 0/24EA280 system usage: CPU: user: 0.00 s, system: 0.00 s, elapsed: 0.00 s
db-1        | 2026-06-05 12:00:35.601 UTC [27] LOG:  checkpoint starting: end-of-recovery immediate wait
db-1        | 2026-06-05 12:00:35.629 UTC [27] LOG:  checkpoint complete: wrote 3 buffers (0.0%); 0 WAL file(s) added, 0 removed, 0 recycled; write=0.007 s, sync=0.003 s, total=0.031 s; sync files=2, longest=0.002 s, average=0.002 s; distance=0 kB, estimate=0 kB; lsn=0/24EA2B8, redo lsn=0/24EA2B8
db-1        | 2026-06-05 12:00:35.639 UTC [1] LOG:  database system is ready to accept connections
db-1        | 2026-06-05 12:06:00.085 UTC [27] LOG:  checkpoint starting: time
db-1        | 2026-06-05 12:06:08.231 UTC [27] LOG:  checkpoint complete: wrote 57 buffers (0.3%); 0 WAL file(s) added, 0 removed, 0 recycled; write=8.117 s, sync=0.015 s, total=8.147 s; sync files=10, longest=0.004 s, average=0.002 s; distance=140 kB, estimate=140 kB; lsn=0/250D700, redo lsn=0/250D6A8
db-1        | 2026-06-05 12:11:28.835 UTC [27] LOG:  checkpoint starting: time
db-1        | 2026-06-05 12:11:34.277 UTC [27] LOG:  checkpoint complete: wrote 55 buffers (0.3%); 0 WAL file(s) added, 0 removed, 0 recycled; write=5.415 s, sync=0.010 s, total=5.442 s; sync files=10, longest=0.004 s, average=0.001 s; distance=134 kB, estimate=140 kB; lsn=0/252F0C0, redo lsn=0/252F030
db-1        | 2026-06-05 12:38:38.441 UTC [27] LOG:  checkpoint starting: time
db-1        | 2026-06-05 12:38:43.681 UTC [27] LOG:  checkpoint complete: wrote 53 buffers (0.3%); 0 WAL file(s) added, 0 removed, 0 recycled; write=5.214 s, sync=0.010 s, total=5.241 s; sync files=9, longest=0.003 s, average=0.002 s; distance=127 kB, estimate=139 kB; lsn=0/254F068, redo lsn=0/254F010
db-1        | 2026-06-05 12:43:58.180 UTC [27] LOG:  checkpoint starting: time
db-1        | 2026-06-05 12:44:04.525 UTC [27] LOG:  checkpoint complete: wrote 64 buffers (0.4%); 0 WAL file(s) added, 0 removed, 0 recycled; write=6.316 s, sync=0.013 s, total=6.346 s; sync files=16, longest=0.004 s, average=0.001 s; distance=242 kB, estimate=242 kB; lsn=0/258BAC8, redo lsn=0/258BA38
db-1        | 2026-06-05 13:00:01.615 UTC [27] LOG:  checkpoint starting: time
db-1        | 2026-06-05 13:00:06.761 UTC [27] LOG:  checkpoint complete: wrote 52 buffers (0.3%); 0 WAL file(s) added, 0 removed, 0 recycled; write=5.113 s, sync=0.015 s, total=5.146 s; sync files=9, longest=0.005 s, average=0.002 s; distance=124 kB, estimate=230 kB; lsn=0/25B64E0, redo lsn=0/25AAB88
db-1        | 2026-06-05 13:05:24.128 UTC [27] LOG:  checkpoint starting: time
db-1        | 2026-06-05 13:05:29.366 UTC [27] LOG:  checkpoint complete: wrote 53 buffers (0.3%); 0 WAL file(s) added, 0 removed, 0 recycled; write=5.212 s, sync=0.011 s, total=5.238 s; sync files=9, longest=0.004 s, average=0.002 s; distance=210 kB, estimate=228 kB; lsn=0/25F8828, redo lsn=0/25DF6F0
db-1        | 2026-06-05 13:27:01.198 UTC [27] LOG:  checkpoint starting: time
db-1        | 2026-06-05 13:27:05.337 UTC [27] LOG:  checkpoint complete: wrote 42 buffers (0.3%); 0 WAL file(s) added, 0 removed, 0 recycled; write=4.110 s, sync=0.008 s, total=4.140 s; sync files=7, longest=0.003 s, average=0.002 s; distance=100 kB, estimate=215 kB; lsn=0/25F8A58, redo lsn=0/25F8A00
db-1        | 2026-06-05 13:32:28.093 UTC [27] LOG:  checkpoint starting: time
db-1        | 2026-06-05 13:32:28.213 UTC [27] LOG:  checkpoint complete: wrote 1 buffers (0.0%); 0 WAL file(s) added, 0 removed, 0 recycled; write=0.101 s, sync=0.004 s, total=0.120 s; sync files=1, longest=0.004 s, average=0.004 s; distance=8 kB, estimate=195 kB; lsn=0/25FAAF8, redo lsn=0/25FAAA0
db-1        | 2026-06-05 14:54:07.213 UTC [27] LOG:  checkpoint starting: time
db-1        | 2026-06-05 14:54:07.346 UTC [27] LOG:  checkpoint complete: wrote 2 buffers (0.0%); 0 WAL file(s) added, 0 removed, 0 recycled; write=0.110 s, sync=0.005 s, total=0.134 s; sync files=2, longest=0.003 s, average=0.003 s; distance=2 kB, estimate=175 kB; lsn=0/25FB480, redo lsn=0/25FB428
db-1        | 
db-1        | PostgreSQL Database directory appears to contain a database; Skipping initialization
db-1        | 
db-1        | 2026-06-06 18:02:13.132 UTC [1] LOG:  starting PostgreSQL 17.9 on x86_64-pc-linux-musl, compiled by gcc (Alpine 15.2.0) 15.2.0, 64-bit
db-1        | 2026-06-06 18:02:13.132 UTC [1] LOG:  listening on IPv4 address "0.0.0.0", port 5432
db-1        | 2026-06-06 18:02:13.132 UTC [1] LOG:  listening on IPv6 address "::", port 5432
db-1        | 2026-06-06 18:02:13.140 UTC [1] LOG:  listening on Unix socket "/var/run/postgresql/.s.PGSQL.5432"
db-1        | 2026-06-06 18:02:13.152 UTC [29] LOG:  database system was interrupted; last known up at 2026-06-05 14:54:07 UTC
db-1        | 2026-06-06 18:02:14.715 UTC [29] LOG:  database system was not properly shut down; automatic recovery in progress
db-1        | 2026-06-06 18:02:14.724 UTC [29] LOG:  redo starts at 0/25FB428
db-1        | 2026-06-06 18:02:14.724 UTC [29] LOG:  invalid record length at 0/25FB530: expected at least 24, got 0
db-1        | 2026-06-06 18:02:14.724 UTC [29] LOG:  redo done at 0/25FB4F8 system usage: CPU: user: 0.00 s, system: 0.00 s, elapsed: 0.00 s
db-1        | 2026-06-06 18:02:14.740 UTC [27] LOG:  checkpoint starting: end-of-recovery immediate wait
db-1        | 2026-06-06 18:02:14.810 UTC [27] LOG:  checkpoint complete: wrote 3 buffers (0.0%); 0 WAL file(s) added, 0 removed, 0 recycled; write=0.028 s, sync=0.008 s, total=0.078 s; sync files=2, longest=0.004 s, average=0.004 s; distance=0 kB, estimate=0 kB; lsn=0/25FB530, redo lsn=0/25FB530
db-1        | 2026-06-06 18:02:14.829 UTC [1] LOG:  database system is ready to accept connections
db-1        | 2026-06-06 18:07:14.911 UTC [27] LOG:  checkpoint starting: time
db-1        | 2026-06-06 18:07:15.441 UTC [27] LOG:  checkpoint complete: wrote 6 buffers (0.0%); 0 WAL file(s) added, 0 removed, 0 recycled; write=0.505 s, sync=0.008 s, total=0.530 s; sync files=6, longest=0.004 s, average=0.002 s; distance=3 kB, estimate=3 kB; lsn=0/25FC208, redo lsn=0/25FC1B0
db-1        | 2026-06-06 22:38:03.583 UTC [12746] ERROR:  column "bannedAt" does not exist at character 235
db-1        | 2026-06-06 22:38:03.583 UTC [12746] STATEMENT:  
db-1        |       SELECT
db-1        |         id,
db-1        |         email,
db-1        |         role,
db-1        |         "displayName",
db-1        |         "avatarUrl",
db-1        |         "avatarMimeType",
db-1        |         "avatarSize",
db-1        |         "avatarScale",
db-1        |         "avatarOffsetX",
db-1        |         "avatarOffsetY"
db-1        |       FROM users
db-1        |       WHERE id = $1 AND "bannedAt" IS NULL
db-1        |       LIMIT 1
db-1        |     
db-1        | 2026-06-06 22:38:03.583 UTC [12747] ERROR:  column "bannedAt" does not exist at character 235
db-1        | 2026-06-06 22:38:03.583 UTC [12747] STATEMENT:  
db-1        |       SELECT
db-1        |         id,
db-1        |         email,
db-1        |         role,
db-1        |         "displayName",
db-1        |         "avatarUrl",
db-1        |         "avatarMimeType",
db-1        |         "avatarSize",
db-1        |         "avatarScale",
db-1        |         "avatarOffsetX",
db-1        |         "avatarOffsetY"
db-1        |       FROM users
db-1        |       WHERE id = $1 AND "bannedAt" IS NULL
db-1        |       LIMIT 1
db-1        |     
db-1        | 2026-06-06 22:38:04.354 UTC [12748] ERROR:  column "bannedAt" does not exist at character 235
db-1        | 2026-06-06 22:38:04.354 UTC [12748] STATEMENT:  
db-1        |       SELECT
db-1        |         id,
db-1        |         email,
db-1        |         role,
db-1        |         "displayName",
db-1        |         "avatarUrl",
db-1        |         "avatarMimeType",
db-1        |         "avatarSize",
db-1        |         "avatarScale",
db-1        |         "avatarOffsetX",
db-1        |         "avatarOffsetY"
db-1        |       FROM users
db-1        |       WHERE id = $1 AND "bannedAt" IS NULL
db-1        |       LIMIT 1
db-1        |     
db-1        | 2026-06-06 22:38:04.830 UTC [12749] ERROR:  column "bannedAt" does not exist at character 235
db-1        | 2026-06-06 22:38:04.830 UTC [12749] STATEMENT:  
db-1        |       SELECT
db-1        |         id,
db-1        |         email,
db-1        |         role,
db-1        |         "displayName",
db-1        |         "avatarUrl",
db-1        |         "avatarMimeType",
db-1        |         "avatarSize",
db-1        |         "avatarScale",
db-1        |         "avatarOffsetX",
db-1        |         "avatarOffsetY"
db-1        |       FROM users
db-1        |       WHERE id = $1 AND "bannedAt" IS NULL
db-1        |       LIMIT 1
db-1        |     
db-1        | 2026-06-06 22:38:05.494 UTC [12750] ERROR:  column "bannedAt" does not exist at character 235
db-1        | 2026-06-06 22:38:05.494 UTC [12750] STATEMENT:  
db-1        |       SELECT
db-1        |         id,
db-1        |         email,
db-1        |         role,
db-1        |         "displayName",
db-1        |         "avatarUrl",
db-1        |         "avatarMimeType",
db-1        |         "avatarSize",
db-1        |         "avatarScale",
db-1        |         "avatarOffsetX",
db-1        |         "avatarOffsetY"
db-1        |       FROM users
db-1        |       WHERE id = $1 AND "bannedAt" IS NULL
db-1        |       LIMIT 1
db-1        |     
db-1        | 2026-06-06 22:38:05.970 UTC [12751] ERROR:  column "bannedAt" does not exist at character 235
db-1        | 2026-06-06 22:38:05.970 UTC [12751] STATEMENT:  
db-1        |       SELECT
db-1        |         id,
db-1        |         email,
db-1        |         role,
db-1        |         "displayName",
db-1        |         "avatarUrl",
db-1        |         "avatarMimeType",
db-1        |         "avatarSize",
db-1        |         "avatarScale",
db-1        |         "avatarOffsetX",
db-1        |         "avatarOffsetY"
db-1        |       FROM users
db-1        |       WHERE id = $1 AND "bannedAt" IS NULL
db-1        |       LIMIT 1
db-1        |     
db-1        | 2026-06-06 22:38:06.133 UTC [12753] ERROR:  column "bannedAt" does not exist at character 235
db-1        | 2026-06-06 22:38:06.133 UTC [12753] STATEMENT:  
db-1        |       SELECT
db-1        |         id,
db-1        |         email,
db-1        |         role,
db-1        |         "displayName",
db-1        |         "avatarUrl",
db-1        |         "avatarMimeType",
db-1        |         "avatarSize",
db-1        |         "avatarScale",
db-1        |         "avatarOffsetX",
db-1        |         "avatarOffsetY"
db-1        |       FROM users
db-1        |       WHERE id = $1 AND "bannedAt" IS NULL
db-1        |       LIMIT 1
db-1        |     
db-1        | 2026-06-06 22:38:06.133 UTC [12752] ERROR:  column "bannedAt" does not exist at character 235
db-1        | 2026-06-06 22:38:06.133 UTC [12752] STATEMENT:  
db-1        |       SELECT
db-1        |         id,
db-1        |         email,
db-1        |         role,
db-1        |         "displayName",
db-1        |         "avatarUrl",
db-1        |         "avatarMimeType",
db-1        |         "avatarSize",
db-1        |         "avatarScale",
db-1        |         "avatarOffsetX",
db-1        |         "avatarOffsetY"
db-1        |       FROM users
db-1        |       WHERE id = $1 AND "bannedAt" IS NULL
db-1        |       LIMIT 1
db-1        |     
db-1        | 2026-06-06 22:38:07.346 UTC [12754] ERROR:  column "bannedAt" does not exist at character 235
db-1        | 2026-06-06 22:38:07.346 UTC [12754] STATEMENT:  
db-1        |       SELECT
db-1        |         id,
db-1        |         email,
db-1        |         role,
db-1        |         "displayName",
db-1        |         "avatarUrl",
db-1        |         "avatarMimeType",
db-1        |         "avatarSize",
db-1        |         "avatarScale",
db-1        |         "avatarOffsetX",
db-1        |         "avatarOffsetY"
db-1        |       FROM users
db-1        |       WHERE id = $1 AND "bannedAt" IS NULL
db-1        |       LIMIT 1
db-1        |     
db-1        | 2026-06-06 22:38:07.846 UTC [12755] ERROR:  column "bannedAt" does not exist at character 235
db-1        | 2026-06-06 22:38:07.846 UTC [12755] STATEMENT:  
db-1        |       SELECT
db-1        |         id,
db-1        |         email,
db-1        |         role,
db-1        |         "displayName",
db-1        |         "avatarUrl",
db-1        |         "avatarMimeType",
db-1        |         "avatarSize",
db-1        |         "avatarScale",
db-1        |         "avatarOffsetX",
db-1        |         "avatarOffsetY"
db-1        |       FROM users
db-1        |       WHERE id = $1 AND "bannedAt" IS NULL
db-1        |       LIMIT 1
db-1        |     
db-1        | 2026-06-06 22:38:07.979 UTC [12757] ERROR:  column "bannedAt" does not exist at character 235
db-1        | 2026-06-06 22:38:07.979 UTC [12757] STATEMENT:  
db-1        |       SELECT
db-1        |         id,
db-1        |         email,
db-1        |         role,
db-1        |         "displayName",
db-1        |         "avatarUrl",
db-1        |         "avatarMimeType",
db-1        |         "avatarSize",
db-1        |         "avatarScale",
db-1        |         "avatarOffsetX",
db-1        |         "avatarOffsetY"
db-1        |       FROM users
db-1        |       WHERE id = $1 AND "bannedAt" IS NULL
db-1        |       LIMIT 1
db-1        |     
db-1        | 2026-06-06 22:38:08.185 UTC [12756] ERROR:  column "bannedAt" does not exist at character 235
db-1        | 2026-06-06 22:38:08.185 UTC [12756] STATEMENT:  
db-1        |       SELECT
db-1        |         id,
db-1        |         email,
db-1        |         role,
db-1        |         "displayName",
db-1        |         "avatarUrl",
db-1        |         "avatarMimeType",
db-1        |         "avatarSize",
db-1        |         "avatarScale",
db-1        |         "avatarOffsetX",
db-1        |         "avatarOffsetY"
db-1        |       FROM users
db-1        |       WHERE id = $1 AND "bannedAt" IS NULL
db-1        |       LIMIT 1
db-1        |     
db-1        | 2026-06-06 22:38:08.322 UTC [12758] ERROR:  column "bannedAt" does not exist at character 235
db-1        | 2026-06-06 22:38:08.322 UTC [12758] STATEMENT:  
db-1        |       SELECT
db-1        |         id,
db-1        |         email,
db-1        |         role,
db-1        |         "displayName",
db-1        |         "avatarUrl",
db-1        |         "avatarMimeType",
db-1        |         "avatarSize",
db-1        |         "avatarScale",
db-1        |         "avatarOffsetX",
db-1        |         "avatarOffsetY"
db-1        |       FROM users
db-1        |       WHERE id = $1 AND "bannedAt" IS NULL
db-1        |       LIMIT 1
db-1        |     
db-1        | 2026-06-06 22:38:08.343 UTC [12759] ERROR:  column "bannedAt" does not exist at character 235
db-1        | 2026-06-06 22:38:08.343 UTC [12759] STATEMENT:  
db-1        |       SELECT
db-1        |         id,
db-1        |         email,
db-1        |         role,
db-1        |         "displayName",
db-1        |         "avatarUrl",
db-1        |         "avatarMimeType",
db-1        |         "avatarSize",
db-1        |         "avatarScale",
db-1        |         "avatarOffsetX",
db-1        |         "avatarOffsetY"
db-1        |       FROM users
db-1        |       WHERE id = $1 AND "bannedAt" IS NULL
db-1        |       LIMIT 1
db-1        |     
db-1        | 2026-06-06 22:38:08.543 UTC [12760] ERROR:  column "bannedAt" does not exist at character 235
db-1        | 2026-06-06 22:38:08.543 UTC [12760] STATEMENT:  
db-1        |       SELECT
db-1        |         id,
db-1        |         email,
db-1        |         role,
db-1        |         "displayName",
db-1        |         "avatarUrl",
db-1        |         "avatarMimeType",
db-1        |         "avatarSize",
db-1        |         "avatarScale",
db-1        |         "avatarOffsetX",
db-1        |         "avatarOffsetY"
db-1        |       FROM users
db-1        |       WHERE id = $1 AND "bannedAt" IS NULL
db-1        |       LIMIT 1
db-1        |     
db-1        | 2026-06-06 22:38:08.586 UTC [12768] ERROR:  column "bannedAt" does not exist at character 235
db-1        | 2026-06-06 22:38:08.586 UTC [12768] STATEMENT:  
db-1        |       SELECT
db-1        |         id,
db-1        |         email,
db-1        |         role,
db-1        |         "displayName",
db-1        |         "avatarUrl",
db-1        |         "avatarMimeType",
db-1        |         "avatarSize",
db-1        |         "avatarScale",
db-1        |         "avatarOffsetX",
db-1        |         "avatarOffsetY"
db-1        |       FROM users
db-1        |       WHERE id = $1 AND "bannedAt" IS NULL
db-1        |       LIMIT 1
db-1        |     
db-1        | 2026-06-06 22:38:14.501 UTC [12769] ERROR:  column "bannedAt" does not exist at character 235
db-1        | 2026-06-06 22:38:14.501 UTC [12769] STATEMENT:  
db-1        |       SELECT
db-1        |         id,
db-1        |         email,
db-1        |         role,
db-1        |         "displayName",
db-1        |         "avatarUrl",
db-1        |         "avatarMimeType",
db-1        |         "avatarSize",
db-1        |         "avatarScale",
db-1        |         "avatarOffsetX",
db-1        |         "avatarOffsetY"
db-1        |       FROM users
db-1        |       WHERE id = $1 AND "bannedAt" IS NULL
db-1        |       LIMIT 1
db-1        |     
db-1        | 2026-06-06 22:39:25.983 UTC [12825] ERROR:  relation "app_settings" does not exist at character 60
db-1        | 2026-06-06 22:39:25.983 UTC [12825] STATEMENT:  
db-1        |                       SELECT value
db-1        |                       FROM app_settings
db-1        |                       WHERE key = $1
db-1        |                       LIMIT 1
db-1        |                       
web-1       | 
web-1       | > web@0.1.0 prisma:generate
web-1       | > prisma generate
web-1       | 
web-1       | Loaded Prisma config from prisma.config.ts.
web-1       | 
web-1       | Prisma schema loaded from prisma/schema.prisma.
web-1       | 
web-1       | ✔ Generated Prisma Client (7.8.0) to ./src/generated/prisma in 229ms
web-1       | 
web-1       | 
web-1       | > web@0.1.0 dev
web-1       | > next dev --hostname 0.0.0.0
web-1       | 
web-1       | ▲ Next.js 16.2.6 (Turbopack)
web-1       | - Local:         http://localhost:3000
web-1       | - Network:       http://0.0.0.0:3000
web-1       | ✓ Ready in 611ms
web-1       | 


