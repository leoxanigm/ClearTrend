# Module Health, Status, Backups et Disaster Recovery

## Statut

- Type : module minor
- Valeur : 1 point
- État : implémenté et validé en environnement Docker
- Exigence du sujet : health checks, page de statut, sauvegardes
  automatisées et procédure de reprise après incident

Ce module surveille les services principaux de ClearTrend, expose leur état sur
une page publique, sauvegarde automatiquement PostgreSQL et fournit une
procédure testable de restauration.

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

Les responsabilités sont séparées :

- `/api/health/live` vérifie uniquement que le serveur web répond.
- `/api/health` vérifie l'état global de l'application.
- `/status` présente cet état à un utilisateur.
- Le service Docker `backup` exécute les sauvegardes PostgreSQL.
- Les commandes `restore-check` et `restore` couvrent la reprise.

Cette séparation est importante : une panne de l'analyse ne doit pas rendre la
page de statut inaccessible.

## Health checks

### Liveness du web

Endpoint :

```text
GET /api/health/live
```

Réponse attendue :

```json
{
  "status": "ok",
  "service": "web",
  "timestamp": "2026-06-07T17:23:22.565Z"
}
```

Cet endpoint ne contacte ni PostgreSQL ni FastAPI. Docker l'utilise pour savoir
si le conteneur web est vivant.

### État global

Endpoint :

```text
GET /api/health
```

La route effectue deux contrôles en parallèle :

- PostgreSQL avec une requête Prisma `SELECT 1`.
- FastAPI avec un appel vers `${ANALYSIS_URL}/health`, limité à 2 secondes.

Réponse nominale :

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

Le dernier cas est volontaire dans le code actuel. Pour une évaluation normale,
`ANALYSIS_URL` doit être configuré ; un service d'analyse non configuré ne doit
pas être présenté comme un fonctionnement complet.

### Healthchecks Docker

Docker Compose surveille :

- `db` avec `pg_isready`.
- `analysis` avec son endpoint FastAPI `/health`.
- `web` avec `/api/health/live`.

Le web attend que PostgreSQL soit sain et que le conteneur d'analyse soit
demarré. Il n'attend pas que l'analyse soit saine, ce qui permet à `/status`
d'afficher un état dégradé pendant le démarrage ou une panne.

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

- l'état global ;
- l'état du web ;
- l'état de PostgreSQL ;
- l'état du service d'analyse ;
- l'heure du dernier contrôle.

La page interroge `/api/health` toutes les 15 secondes et propose aussi un
bouton d'actualisation. Elle est disponible en anglais, français et espagnol.

## Sauvegardes automatiques

Le service Docker `backup` utilise l'image `postgres:17-alpine`.

Au démarrage, il :

1. attend que PostgreSQL soit sain ;
2. exécute immédiatement `pg_dump` ;
3. enregistre le dump dans `backups/` ;
4. supprime les dumps plus anciens que la rétention configurée ;
5. attend avant de recommencer.

Nom d'un fichier :

```text
backups/transcendence_20260607T171804Z.sql
```

Le timestamp est en UTC.

La création est atomique : le dump est d'abord écrit dans un fichier `.tmp`,
puis renommé uniquement si `pg_dump` se termine correctement. Un dump partiel
ne doit donc pas apparaître comme une sauvegarde valide.

Les fichiers sont créés avec des permissions restrictives via `umask 077`.
Ils sont ignorés par Git.

### Données sauvegardées

La sauvegarde contient la base PostgreSQL :

- utilisateurs et profils ;
- watchlists ;
- paramètres ;
- clés API ;
- analyses, rapports et autres tables Prisma.

Les CSV du service d'analyse ne sont pas sauvegardés. Ils sont considérés comme
un cache régénérable depuis les sources de données.

## Variables importantes

Variables présentes dans `.env` :

| Variable | Valeur par défaut | Rôle |
|---|---|---|
| `POSTGRES_USER` | `transcendence` | Utilisateur PostgreSQL |
| `POSTGRES_PASSWORD` | `transcendence` | Mot de passe PostgreSQL |
| `POSTGRES_DB` | `transcendence` | Base sauvegardée et restaurée |
| `DATABASE_URL` | URL PostgreSQL Docker | Connexion Prisma |
| `ANALYSIS_URL` | `http://analysis:8000` | Adresse interne de FastAPI |
| `BACKUP_INTERVAL_SECONDS` | `86400` | Intervalle entre deux backups, soit 24 h |
| `BACKUP_RETENTION_DAYS` | `7` | Durée de conservation des dumps |

Variables internes aux scripts :

| Variable | Valeur par défaut | Rôle |
|---|---|---|
| `POSTGRES_HOST` | `db` | Nom du service PostgreSQL |
| `BACKUP_DIR` | `/backups` | Dossier cible dans le conteneur |

Exemple pour une sauvegarde toutes les heures avec trois jours de rétention :

```env
BACKUP_INTERVAL_SECONDS=3600
BACKUP_RETENTION_DAYS=3
```

Il faut recréer le service `backup` après une modification de `.env` :

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --force-recreate backup
```

## Commandes utiles

### Démarrer le projet

```sh
make dev
```

Le service `backup` est inclus dans `make dev` et `make up`.

### Vérifier les services

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

### Creer un backup immédiat

```sh
make backup
```

Vérifier le fichier :

```sh
ls -lh backups/
```

### Tester un dump sans toucher à la base courante

```sh
make restore-check file=backups/transcendence_YYYYMMDDTHHMMSSZ.sql
```

Cette commande :

1. crée une base temporaire ;
2. restaure le dump ;
3. vérifie qu'au moins une table publique existe ;
4. supprime la base temporaire.

Une réponse valide ressemble à :

```text
Restore check passed: 11 public tables restored from /backups/...
```

## Procédure de disaster recovery

Attention : `make restore` remplace la base PostgreSQL courante. Toujours
exécuter `restore-check` avant.

### Étapes

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

- arrête temporairement `web` et `analysis` ;
- supprime la base courante ;
- recréé une base vide ;
- restaure le dump avec arrêt à la première erreur SQL ;
- redémarre `analysis` et `web`, même si la restauration echoue.

4. Vérifier le retour du système :

```sh
make health
make ps
```

5. Ouvrir :

```text
http://localhost:3000/status
```

## Test du mode dégradé

Ce scénario prouve que la page de statut reste accessible pendant une panne de
l'analyse.

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml stop analysis
curl -i http://localhost:3000/api/health/live
curl -i http://localhost:3000/api/health
curl -i http://localhost:3000/status
```

Résultat attendu :

- `/api/health/live` retourne `200`.
- `/api/health` retourne `503` avec `analysis: "error"`.
- `/status` retourne `200` et affiche l'analyse indisponible.

Redémarrer ensuite le service :

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml start analysis
```

Après son préchargement, `/api/health` doit revenir à `200`.

## RPO et RTO

Avec les valeurs par défaut :

- RPO cible : 24 heures maximum de données perdues.
- RTO estimé : quelques minutes pour cette base de taille projet.

Le RPO dépend directement de `BACKUP_INTERVAL_SECONDS`. Une sauvegarde toutes
les heures réduit le RPO à environ une heure, mais augmente le nombre d'écritures
et l'espace disque utilisé.

## Test réalisé

Le 7 juin 2026 :

- les trois services ont retourné un état nominal ;
- l'arrêt de FastAPI a produit un `503` global sans rendre `/status`
  inaccessible ;
- le retour de FastAPI a ramené l'état global à `200` ;
- un dump PostgreSQL de 22 Ko a été créé ;
- le dump a été restauré dans une base temporaire ;
- 11 tables publiques ont été retrouvées.

## Fichiers principaux

| Fichier | Rôle |
|---|---|
| `web/src/app/api/health/route.ts` | Health check global |
| `web/src/app/api/health/live/route.ts` | Liveness du web |
| `web/src/app/status/` | Page publique de statut |
| `analysis/src/main.py` | Endpoint FastAPI `/health` |
| `docker-compose.yml` | Healthchecks et service `backup` |
| `scripts/backup-db.sh` | Création d'un dump |
| `scripts/backup-loop.sh` | Planification des dumps |
| `scripts/restore-check.sh` | Test non destructif d'un dump |
| `Makefile` | Commandes utilisateur |
| `.env.example` | Configuration documentée |

## Limites connues

Cette implémentation est suffisante pour le module du sujet, mais elle ne doit
pas être présentée comme une stratégie de production complète :

- les dumps restent sur la même machine que le projet ;
- ils ne sont pas chiffrés ;
- aucune copie distante ou hors site n'est effectuée ;
- aucune alerte n'est envoyée en cas d'échec ;
- le service `backup` n'est pas inclus dans `/api/health` ;
- le test automatique vérifie les tables, pas le contenu métier de chaque table.

Pour une vraie production, il faudrait ajouter un stockage distant chiffré, une
rotation externe, des alertes et des exercices réguliers de restauration.

## Parcours de démonstration rapide

1. Ouvrir `/status` et montrer les trois services opérationnels.
2. Exécuter `make backup`.
3. Montrer le nouveau fichier dans `backups/`.
4. Exécuter `make restore-check file=...`.
5. Montrer le message confirmant les tables restaurées.
6. Arrêter `analysis` et montrer le `503` global avec `/status` toujours
   accessible.
7. Redémarrer `analysis` et montrer le retour à l'état opérationnel.
