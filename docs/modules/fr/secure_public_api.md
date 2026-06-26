# API publique sécurisée

## Statut

- Type : module major
- Valeur : 2 points
- État : implémenté
- Documentation web : `/api-docs`
- Paramètres de clé API : `/settings/api`
- Script de test : `tests/api/public-api-tests.sh`

## Exigences du sujet

Le sujet demande :

- une API publique qui interagit avec la base de données ;
- une authentification avec clé API sécurisée ;
- du rate limiting ;
- une documentation ;
- au moins cinq endpoints ;
- la prise en charge de `GET`, `POST`, `PUT` et `DELETE`.

ClearTrend implémente ces exigences avec des routes API Next.js authentifiées,
des clés API stockées en base PostgreSQL, des limites de requêtes par compte et
une documentation web internationalisée.

## Correspondance avec les exigences

| Exigence | Implémentation ClearTrend |
|---|---|
| API publique | Les routes Next.js sous `/api` peuvent être appelées par des clients externes |
| Interaction base de données | Les routes watchlist, recherche, clé API, utilisateur et paramètre admin utilisent PostgreSQL |
| Clé API sécurisée | Les clés API aléatoires sont stockées uniquement sous forme de hash SHA-256 |
| Rate limiting | 120 requêtes authentifiées par minute et par compte |
| Documentation | `/api-docs` fournit les instructions d'authentification et exemples curl |
| Au moins cinq endpoints | Plus de cinq routes authentifiées et vingt opérations méthode/chemin |
| Méthodes HTTP requises | `GET`, `POST`, `PUT` et `DELETE` sont implémentées |
| Sécurité administration | Les routes admin vérifient aussi le rôle `ADMIN` |

## Architecture

```text
Client externe
      |
      | Requête HTTPS
      | Authorization: Bearer <api_key>
      | ou X-API-Key: <api_key>
      v
Route API Next.js
      |
      v
Validation d'identité API
      |
      +-- hasher la clé API fournie
      +-- chercher la clé correspondante dans PostgreSQL
      +-- refuser les clés révoquées
      +-- refuser les utilisateurs bannis
      +-- mettre à jour lastUsedAt
      |
      v
Rate limiter
      |
      +-- 120 requêtes par minute
      +-- bucket par compte pour les clés API
      +-- HTTP 429 en cas de dépassement
      |
      v
Autorisation de route et validation d'entrée
      |
      +-- route authentifiée standard
      +-- vérification optionnelle du rôle ADMIN
      |
      v
PostgreSQL ou service analysis interne
```

Le navigateur et les clients externes accèdent uniquement au backend Next.js.
Les adresses internes du service d'analyse et les identifiants base de données
ne sont jamais exposés.

## Cycle de vie d'une clé API

Fichiers concernés :

- `web/src/app/api/account/api-key/route.ts`
- `web/src/components/ApiKeySettingsClient.tsx`
- `web/src/lib/api-auth.ts`
- `web/prisma/schema.prisma`

Un utilisateur authentifié peut créer une clé API depuis `/settings/api`.

La clé générée utilise :

```text
ct_<32 random bytes encoded as base64url>
```

Le secret complet est retourné une seule fois. La base stocke :

- l'identifiant de l'utilisateur propriétaire ;
- un hash SHA-256 de la clé ;
- un préfixe court d'affichage ;
- sa date de création ;
- sa date de dernière utilisation ;
- une date de révocation optionnelle.

La clé en clair n'est pas stockée. Lorsqu'un client soumet une clé, le backend
la hashe et cherche le hash correspondant.

Supprimer la clé API la retire de la base et empêche immédiatement toute
authentification ultérieure avec cette clé.

## Authentification

Les clés API peuvent être fournies avec l'un ou l'autre header :

```http
Authorization: Bearer ct_example
```

ou :

```http
X-API-Key: ct_example
```

Les mêmes routes API acceptent une session navigateur afin que l'interface
ClearTrend puisse réutiliser l'API backend.

L'authentification retourne :

- `401 Unauthorized` lorsqu'aucune session ou clé API valide n'existe ;
- `404 Not Found` lorsque le profil associé n'existe plus ;
- `403 Forbidden` lorsqu'un utilisateur valide tente une opération réservée à
  l'administration.

Les utilisateurs avec `bannedAt` défini sont refusés même si leur clé API est
valide par ailleurs.

## Rate Limiting

Fichiers concernés :

- `web/src/lib/api-auth.ts`
- `web/src/lib/rate-limit.ts`

Les appels API authentifiés sont limités à :

```text
120 requêtes par 60 secondes et par compte
```

Les requêtes par clé API utilisent l'identifiant utilisateur authentifié comme
identifiant de bucket. Les requêtes par session navigateur utilisent
l'identifiant utilisateur et l'adresse IP cliente.

Lorsque la limite est dépassée, l'API retourne :

```http
HTTP/1.1 429 Too Many Requests
Retry-After: <seconds>
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 0
X-RateLimit-Reset: <Unix timestamp>
Content-Type: application/json
```

Exemple de body :

```json
{
  "error": "Rate limit exceeded."
}
```

Le limiteur actuel est stocké en mémoire du processus Next.js. C'est adapté au
conteneur `web` unique du projet. Un déploiement horizontal demanderait un
limiteur partagé comme Redis ou PostgreSQL.

## Endpoints base de données principaux

Ces cinq opérations satisfont directement les exigences minimales d'endpoint et
de méthodes HTTP :

| Méthode | Chemin | Objectif |
|---|---|---|
| `GET` | `/api/assets/watchlist` | Lire la watchlist de l'utilisateur authentifié |
| `POST` | `/api/assets/watchlist` | Ajouter un symbole |
| `PUT` | `/api/assets/watchlist` | Remplacer toute la watchlist |
| `DELETE` | `/api/assets/watchlist` | Retirer un symbole ou vider la watchlist |
| `GET` | `/api/search` | Chercher dans les assets et analyses stockés en base |

Les routes watchlist lisent et mettent à jour le champ `favoriteSymbols` de
l'utilisateur authentifié dans PostgreSQL. La route de recherche utilise des
requêtes Prisma, des filtres, du tri, de la pagination et des limites bornées.

## Surface complète des endpoints

### Santé publique

| Méthode | Chemin | Autorisation |
|---|---|---|
| `GET` | `/api/health` | Publique |

### Watchlist

| Méthode | Chemin | Objectif |
|---|---|---|
| `GET` | `/api/assets/watchlist` | Lire la watchlist |
| `POST` | `/api/assets/watchlist` | Ajouter un symbole |
| `PUT` | `/api/assets/watchlist` | Remplacer tous les symboles |
| `PATCH` | `/api/assets/watchlist` | Changer un état favori |
| `DELETE` | `/api/assets/watchlist` | Retirer un symbole ou tout vider |
| `GET` | `/api/assets/watchlist/file` | Exporter un fichier JSON versionné |
| `POST` | `/api/assets/watchlist/file` | Valider et importer un fichier JSON |

### Recherche et données de marché

| Méthode | Chemin | Objectif |
|---|---|---|
| `GET` | `/api/search` | Recherche base avec filtres et pagination |
| `GET` | `/api/assets/search` | Recherche des symboles de marché disponibles |
| `GET` | `/api/assets/candles` | Retourne les bougies OHLCV |
| `GET` | `/api/assets/candles/meta` | Retourne les métadonnées du cache de bougies |
| `GET` | `/api/assets/performance` | Retourne la performance de plusieurs symboles |
| `GET` | `/api/ml/analyse` | Retourne l'analyse de tendance ML |

### API administrateur

| Méthode | Chemin | Objectif |
|---|---|---|
| `GET` | `/api/admin/ping` | Vérifier l'accès administrateur |
| `GET` | `/api/admin/settings/finance-refresh-rate` | Lire la fréquence de rafraîchissement |
| `POST` | `/api/admin/settings/finance-refresh-rate` | Créer ou mettre à jour le réglage |
| `PUT` | `/api/admin/settings/finance-refresh-rate` | Remplacer le réglage |
| `PATCH` | `/api/admin/settings/finance-refresh-rate` | Mettre à jour le réglage |
| `DELETE` | `/api/admin/settings/finance-refresh-rate` | Le supprimer et restaurer la valeur par défaut |

Les endpoints administrateur acceptent les clés API mais exigent que
l'utilisateur propriétaire ait le rôle `ADMIN`. La clé API valide d'un
utilisateur standard reçoit `403 Forbidden`.

## Validation des entrées

Exemples de validation serveur :

- les symboles sont normalisés et comparés à un pattern restreint ;
- les tableaux de watchlist ont une taille maximale bornée ;
- les requêtes de recherche et tailles de page sont bornées ;
- les plages de graphique sont limitées aux valeurs supportées ;
- les horizons ML acceptent uniquement `1D`, `1W` et `1M` ;
- les fréquences de rafraîchissement finance acceptent uniquement `60`, `300`
  ou `900` secondes ;
- les fichiers de watchlist importés exigent le MIME, la taille, le format et
  la version attendus ;
- le JSON malformé retourne une erreur client contrôlée.

Les requêtes base de données utilisent Prisma ou des requêtes template taggées
paramétrées. L'entrée utilisateur n'est pas concaténée dans des chaînes SQL.

## Réponses d'erreur

Les erreurs API utilisent une structure JSON cohérente :

```json
{
  "error": "Description of the error."
}
```

Statuts de réponse courants :

| Statut | Signification |
|---|---|
| `200` | Requête terminée |
| `201` | Ressource ou entrée watchlist créée |
| `400` | Entrée invalide |
| `401` | Authentification manquante ou invalide |
| `403` | Rôle insuffisant |
| `404` | Utilisateur ou ressource introuvable |
| `409` | Ressource en conflit |
| `415` | Type de contenu non supporté |
| `429` | Rate limit dépassé |
| `502` | Le service analysis interne a échoué |
| `503` | Service requis indisponible |

## Documentation web

Fichiers concernés :

- `web/src/app/api-docs/page.tsx`
- `web/langages/en.json`
- `web/langages/fr.json`
- `web/langages/es.json`

La page `/api-docs` inclut :

- headers d'authentification supportés ;
- limite de requêtes ;
- comportement des erreurs ;
- toutes les opérations de l'API publique ;
- niveau d'autorisation requis ;
- bodies de requête ;
- exemples d'upload multipart ;
- exemples curl exécutables.

La documentation est disponible en anglais, français et espagnol via le système
de langue de l'application.

## Tests automatisés

Le script de test API couvre :

- refus d'une clé API manquante ;
- refus d'une clé API invalide ;
- watchlist `GET`, `POST`, `PUT`, `PATCH` et `DELETE` ;
- export et import de fichier watchlist ;
- recherche base et marché ;
- bougies et métadonnées de bougies ;
- performance d'assets ;
- analyse ML ;
- autorisation administrateur ;
- réglage finance `GET`, `POST`, `PUT`, `PATCH` et `DELETE` ;
- bodies de requête invalides ;
- vérification optionnelle du rate limit.

Lancer avec :

```bash
API_KEY=ct_user_key \
ADMIN_API_KEY=ct_admin_key \
BASE_URL=https://localhost \
tests/api/public-api-tests.sh
```

Pour exiger la réussite des endpoints dépendants de l'analyse :

```bash
STRICT_EXTERNAL=1 \
API_KEY=ct_user_key \
ADMIN_API_KEY=ct_admin_key \
BASE_URL=https://localhost \
tests/api/public-api-tests.sh
```

Pour vérifier que les requêtes répétées finissent par retourner `429` :

```bash
RUN_RATE_LIMIT_TEST=1 \
API_KEY=ct_user_key \
ADMIN_API_KEY=ct_admin_key \
BASE_URL=https://localhost \
tests/api/public-api-tests.sh
```

Le test modifie la watchlist de l'utilisateur sélectionné et le réglage finance
administrateur. Il termine en vidant la watchlist de test et en restaurant la
fréquence de rafraîchissement finance par défaut.

## Démonstration d'évaluation

Une démonstration évaluateur complète peut suivre ces étapes :

1. Se connecter et ouvrir `/settings/api`.
2. Créer une clé API et montrer que le secret n'apparaît qu'une seule fois.
3. Appeler `GET /api/assets/watchlist` sans clé et montrer `401`.
4. Appeler le même endpoint avec la clé et montrer `200`.
5. Démontrer `POST`, `PUT` et `DELETE` sur la watchlist.
6. Ouvrir `/api-docs` et montrer les endpoints documentés.
7. Utiliser une clé standard sur `/api/admin/ping` et montrer `403`.
8. Utiliser une clé administrateur et montrer `200`.
9. Lancer le test de rate limit et montrer `429` avec les headers de limite.
10. Supprimer la clé API et montrer qu'elle ne peut plus authentifier.

## Fichiers principaux d'implémentation

- `web/src/lib/api-auth.ts`
- `web/src/lib/rate-limit.ts`
- `web/src/lib/admin-auth.ts`
- `web/src/app/api/account/api-key/route.ts`
- `web/src/app/api/assets/watchlist/route.ts`
- `web/src/app/api/assets/watchlist/file/route.ts`
- `web/src/app/api/search/route.ts`
- `web/src/app/api/assets/search/route.ts`
- `web/src/app/api/assets/candles/route.ts`
- `web/src/app/api/assets/candles/meta/route.ts`
- `web/src/app/api/assets/performance/route.ts`
- `web/src/app/api/ml/analyse/route.ts`
- `web/src/app/api/admin/ping/route.ts`
- `web/src/app/api/admin/settings/finance-refresh-rate/route.ts`
- `web/src/app/api-docs/page.tsx`
- `web/prisma/schema.prisma`
- `tests/api/public-api-tests.sh`

## Conclusion

ClearTrend fournit une API publique documentée avec interaction base de
données, clés API générées cryptographiquement, stockage des clés hashées,
propriété par compte, administration sensible aux rôles, validation serveur,
rate limiting et une surface d'endpoints supérieure au minimum requis.

L'implémentation satisfait donc le module major API publique sécurisée.
