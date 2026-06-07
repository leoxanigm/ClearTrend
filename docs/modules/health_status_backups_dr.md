# Module Health, Status, Backups et Disaster Recovery

## Statut

- Type : module minor
- Valeur : 1 point
- Etat : implemente et valide en environnement Docker
- Exigence du sujet : health checks, page de statut, sauvegardes
  automatisees et procedure de reprise apres incident

Ce module surveille les services principaux de ClearTrend, expose leur etat sur
une page publique, sauvegarde automatiquement PostgreSQL et fournit une
procedure testable de restauration.

## Architecture

```text
Navigateur
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

Service backup
   |
   +--> pg_dump --> backups/*.sql
```

Les responsabilites sont separees :

- `/api/health/live` verifie uniquement que le serveur web repond.
- `/api/health` verifie l'etat global de l'application.
- `/status` presente cet etat a un utilisateur.
- Le service Docker `backup` execute les sauvegardes PostgreSQL.
- Les commandes `restore-check` et `restore` couvrent la reprise.

Cette separation est importante : une panne de l'analyse ne doit pas rendre la
page de statut inaccessible.

## Health checks

### Liveness du web

Endpoint :

```text
GET /api/health/live
```

Reponse attendue :

```json
{
  "status": "ok",
  "service": "web",
  "timestamp": "2026-06-07T17:23:22.565Z"
}
```

Cet endpoint ne contacte ni PostgreSQL ni FastAPI. Docker l'utilise pour savoir
si le conteneur web est vivant.

### Etat global

Endpoint :

```text
GET /api/health
```

La route effectue deux controles en parallele :

- PostgreSQL avec une requete Prisma `SELECT 1`.
- FastAPI avec un appel vers `${ANALYSIS_URL}/health`, limite a 2 secondes.

Reponse nominale :

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

Codes HTTP :

| Situation | Code |
|---|---:|
| PostgreSQL et FastAPI disponibles | `200` |
| PostgreSQL indisponible | `503` |
| FastAPI indisponible ou trop lent | `503` |
| `ANALYSIS_URL` absent mais PostgreSQL disponible | `200` avec `analysis: "not_configured"` |

Le dernier cas est volontaire dans le code actuel. Pour une evaluation normale,
`ANALYSIS_URL` doit etre configure ; un service d'analyse non configure ne doit
pas etre presente comme un fonctionnement complet.

### Healthchecks Docker

Docker Compose surveille :

- `db` avec `pg_isready`.
- `analysis` avec son endpoint FastAPI `/health`.
- `web` avec `/api/health/live`.

Le web attend que PostgreSQL soit sain et que le conteneur d'analyse soit
demarre. Il n'attend pas que l'analyse soit saine, ce qui permet a `/status`
d'afficher un etat degrade pendant le demarrage ou une panne.

## Page de statut

La page publique est disponible ici :

```text
http://localhost:3000/status
```

En mode HTTPS :

```text
https://localhost/status
```

Elle affiche :

- l'etat global ;
- l'etat du web ;
- l'etat de PostgreSQL ;
- l'etat du service d'analyse ;
- l'heure du dernier controle.

La page interroge `/api/health` toutes les 15 secondes et propose aussi un
bouton d'actualisation. Elle est disponible en anglais, francais et espagnol.

## Sauvegardes automatiques

Le service Docker `backup` utilise l'image `postgres:17-alpine`.

Au demarrage, il :

1. attend que PostgreSQL soit sain ;
2. execute immediatement `pg_dump` ;
3. enregistre le dump dans `backups/` ;
4. supprime les dumps plus anciens que la retention configuree ;
5. attend avant de recommencer.

Nom d'un fichier :

```text
backups/transcendence_20260607T171804Z.sql
```

Le timestamp est en UTC.

La creation est atomique : le dump est d'abord ecrit dans un fichier `.tmp`,
puis renomme uniquement si `pg_dump` se termine correctement. Un dump partiel
ne doit donc pas apparaitre comme une sauvegarde valide.

Les fichiers sont crees avec des permissions restrictives via `umask 077`.
Ils sont ignores par Git.

### Donnees sauvegardees

La sauvegarde contient la base PostgreSQL :

- utilisateurs et profils ;
- watchlists ;
- parametres ;
- cles API ;
- analyses, rapports et autres tables Prisma.

Les CSV du service d'analyse ne sont pas sauvegardes. Ils sont consideres comme
un cache regenerable depuis les sources de donnees.

## Variables importantes

Variables presentes dans `.env` :

| Variable | Valeur par defaut | Role |
|---|---|---|
| `POSTGRES_USER` | `transcendence` | Utilisateur PostgreSQL |
| `POSTGRES_PASSWORD` | `transcendence` | Mot de passe PostgreSQL |
| `POSTGRES_DB` | `transcendence` | Base sauvegardee et restauree |
| `DATABASE_URL` | URL PostgreSQL Docker | Connexion Prisma |
| `ANALYSIS_URL` | `http://analysis:8000` | Adresse interne de FastAPI |
| `BACKUP_INTERVAL_SECONDS` | `86400` | Intervalle entre deux backups, soit 24 h |
| `BACKUP_RETENTION_DAYS` | `7` | Duree de conservation des dumps |

Variables internes aux scripts :

| Variable | Valeur par defaut | Role |
|---|---|---|
| `POSTGRES_HOST` | `db` | Nom du service PostgreSQL |
| `BACKUP_DIR` | `/backups` | Dossier cible dans le conteneur |

Exemple pour une sauvegarde toutes les heures avec trois jours de retention :

```env
BACKUP_INTERVAL_SECONDS=3600
BACKUP_RETENTION_DAYS=3
```

Il faut recreer le service `backup` apres une modification de `.env` :

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --force-recreate backup
```

## Commandes utiles

### Demarrer le projet

```sh
make dev
```

Le service `backup` est inclus dans `make dev` et `make up`.

### Verifier les services

```sh
make ps
make health
```

Tests directs :

```sh
curl -i http://localhost:3000/api/health/live
curl -i http://localhost:3000/api/health
curl -i http://localhost:8000/health
```

Voir les logs :

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs backup
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs analysis
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs web
```

### Creer un backup immediat

```sh
make backup
```

Verifier le fichier :

```sh
ls -lh backups/
```

### Tester un dump sans toucher a la base courante

```sh
make restore-check file=backups/transcendence_YYYYMMDDTHHMMSSZ.sql
```

Cette commande :

1. cree une base temporaire ;
2. restaure le dump ;
3. verifie qu'au moins une table publique existe ;
4. supprime la base temporaire.

Une reponse valide ressemble a :

```text
Restore check passed: 11 public tables restored from /backups/...
```

## Procedure de disaster recovery

Attention : `make restore` remplace la base PostgreSQL courante. Toujours
executer `restore-check` avant.

### Etapes

1. Lister les dumps disponibles :

```sh
ls -lh backups/
```

2. Tester le dump choisi :

```sh
make restore-check file=backups/transcendence_YYYYMMDDTHHMMSSZ.sql
```

3. Restaurer la base :

```sh
make restore file=backups/transcendence_YYYYMMDDTHHMMSSZ.sql
```

La commande de restauration :

- arrete temporairement `web` et `analysis` ;
- supprime la base courante ;
- recree une base vide ;
- restaure le dump avec arret a la premiere erreur SQL ;
- redemarre `analysis` et `web`, meme si la restauration echoue.

4. Verifier le retour du systeme :

```sh
make health
make ps
```

5. Ouvrir :

```text
http://localhost:3000/status
```

## Test du mode degrade

Ce scenario prouve que la page de statut reste accessible pendant une panne de
l'analyse.

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml stop analysis
curl -i http://localhost:3000/api/health/live
curl -i http://localhost:3000/api/health
curl -i http://localhost:3000/status
```

Resultat attendu :

- `/api/health/live` retourne `200`.
- `/api/health` retourne `503` avec `analysis: "error"`.
- `/status` retourne `200` et affiche l'analyse indisponible.

Redemarrer ensuite le service :

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml start analysis
```

Apres son prechargement, `/api/health` doit revenir a `200`.

## RPO et RTO

Avec les valeurs par defaut :

- RPO cible : 24 heures maximum de donnees perdues.
- RTO estime : quelques minutes pour cette base de taille projet.

Le RPO depend directement de `BACKUP_INTERVAL_SECONDS`. Une sauvegarde toutes
les heures reduit le RPO a environ une heure, mais augmente le nombre d'ecritures
et l'espace disque utilise.

## Test realise

Le 7 juin 2026 :

- les trois services ont retourne un etat nominal ;
- l'arret de FastAPI a produit un `503` global sans rendre `/status`
  inaccessible ;
- le retour de FastAPI a ramene l'etat global a `200` ;
- un dump PostgreSQL de 22 Ko a ete cree ;
- le dump a ete restaure dans une base temporaire ;
- 11 tables publiques ont ete retrouvees.

## Fichiers principaux

| Fichier | Role |
|---|---|
| `web/src/app/api/health/route.ts` | Health check global |
| `web/src/app/api/health/live/route.ts` | Liveness du web |
| `web/src/app/status/` | Page publique de statut |
| `analysis/src/main.py` | Endpoint FastAPI `/health` |
| `docker-compose.yml` | Healthchecks et service `backup` |
| `scripts/backup-db.sh` | Creation d'un dump |
| `scripts/backup-loop.sh` | Planification des dumps |
| `scripts/restore-check.sh` | Test non destructif d'un dump |
| `Makefile` | Commandes utilisateur |
| `.env.example` | Configuration documentee |

## Limites connues

Cette implementation est suffisante pour le module du sujet, mais elle ne doit
pas etre presentee comme une strategie de production complete :

- les dumps restent sur la meme machine que le projet ;
- ils ne sont pas chiffres ;
- aucune copie distante ou hors site n'est effectuee ;
- aucune alerte n'est envoyee en cas d'echec ;
- le service `backup` n'est pas inclus dans `/api/health` ;
- le test automatique verifie les tables, pas le contenu metier de chaque table.

Pour une vraie production, il faudrait ajouter un stockage distant chiffre, une
rotation externe, des alertes et des exercices reguliers de restauration.

## Parcours de demonstration rapide

1. Ouvrir `/status` et montrer les trois services operationnels.
2. Executer `make backup`.
3. Montrer le nouveau fichier dans `backups/`.
4. Executer `make restore-check file=...`.
5. Montrer le message confirmant les tables restaurees.
6. Arreter `analysis` et montrer le `503` global avec `/status` toujours
   accessible.
7. Redemarrer `analysis` et montrer le retour a l'etat operationnel.

