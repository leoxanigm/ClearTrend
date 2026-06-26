# Recherche avancée

## Statut

- Type : module minor
- Valeur : 1 point
- État : implémenté
- Page applicative : `/search`
- Endpoint API : `GET /api/search`

## Exigences du sujet

Le sujet demande une fonctionnalité de recherche avancée avec :

- filtres ;
- tri ;
- pagination.

ClearTrend fournit une page de recherche protégée pour les assets et les
analyses ML stockés en base. Les utilisateurs peuvent combiner recherche
textuelle, type d'entité, sentiment, plage de dates, clé de tri et direction de
tri. Les résultats sont paginés par le backend et rendus sous forme de liens
vers l'asset correspondant dans le dashboard.

## Correspondance avec les exigences

| Exigence | Implémentation ClearTrend |
|---|---|
| Recherche avancée | Recherche insensible à la casse sur les champs des assets et des analyses |
| Filtres | Type d'entité, sentiment, date de début, date de fin et requête libre |
| Tri | Date de création, nom ou symbole |
| Direction du tri | Ascendant ou descendant |
| Pagination | `page` et `limit` côté serveur avec Prisma `skip` et `take` |
| Nombre de résultats | Une requête de comptage séparée retourne les totaux et métadonnées de page |
| Accès protégé | Session navigateur ou clé API sécurisée requise |
| Interface responsive | Les contrôles et résultats utilisent le design system applicatif |

## Architecture

```text
Utilisateur authentifié
      |
      | ouvre /search
      v
Page serveur Next.js
      |
      | vérifie la session navigateur
      v
SearchClient
      |
      | GET /api/search?...filters
      v
API de recherche Next.js
      |
      +-- authentifier et appliquer le rate limit
      +-- normaliser les paramètres de requête
      +-- construire les filtres et tris Prisma
      +-- compter les lignes correspondantes
      +-- charger une page de résultats
      v
PostgreSQL
      |
      v
SearchResponse normalisée
      |
      v
Cartes de résultats et contrôles de pagination
```

Le navigateur ne construit pas de requêtes base de données. Il envoie un
ensemble borné de paramètres, et le backend traduit ces paramètres en filtres
et objets de tri Prisma.

## Parcours utilisateur

Fichiers concernés :

- `web/src/app/search/page.tsx`
- `web/src/components/SearchClient.tsx`
- `web/src/components/DashboardClient.tsx`

L'utilisateur ouvre la recherche avancée depuis la navigation de l'application.
La page serveur `/search` vérifie qu'un utilisateur est connecté et redirige
les utilisateurs non authentifiés vers `/login`.

Depuis la page de recherche, l'utilisateur peut :

1. saisir une requête textuelle ;
2. sélectionner les assets ou les analyses ;
3. choisir un champ de tri ;
4. choisir un ordre ascendant ou descendant ;
5. filtrer les analyses par sentiment ;
6. sélectionner une date de début et de fin ;
7. réinitialiser tous les filtres ;
8. naviguer entre les pages de résultats ;
9. ouvrir un résultat dans le dashboard.

Modifier un contrôle de recherche remet la page courante à 1. Cela empêche un
ancien numéro de page élevé, auparavant valide, de produire une page vide après
réduction de l'ensemble de résultats.

## Paramètres de recherche

L'API accepte les paramètres de requête suivants :

| Paramètre | Valeurs | Défaut | Comportement |
|---|---|---|---|
| `q` | Texte jusqu'à 80 caractères | Vide | Correspondance partielle insensible à la casse |
| `type` | `assets`, `analyses` | `assets` | Sélectionne le groupe d'entités en base |
| `sort` | `createdAt`, `name`, `symbol` | `createdAt` | Sélectionne le champ de tri |
| `direction` | `asc`, `desc` | `desc` | Sélectionne la direction du tri |
| `dateFrom` | `YYYY-MM-DD` | Aucune | Inclut les enregistrements depuis le début du jour |
| `dateTo` | `YYYY-MM-DD` | Aucune | Inclut les enregistrements jusqu'à la fin du jour |
| `sentiment` | `BULLISH`, `NEUTRAL`, `BEARISH` | Aucun | Filtre les labels de tendance d'analyse |
| `page` | Entier positif | `1` | Sélectionne la page de résultats |
| `limit` | Entier positif, maximum 50 | `10` | Définit le nombre de résultats par page |

Exemple de requête :

```http
GET /api/search?q=AAPL&type=analyses&sentiment=BULLISH&sort=createdAt&direction=desc&page=1&limit=10
```

Exemple avec une clé API :

```bash
curl \
  -H "Authorization: Bearer $CLEARTREND_API_KEY" \
  "https://localhost/api/search?q=AAPL&type=analyses&sentiment=BULLISH&sort=createdAt&direction=desc&page=1&limit=10"
```

## Recherche d'assets

Fonction backend concernée :

- `searchAssets` dans `web/src/app/api/search/route.ts`

La recherche textuelle d'assets applique une correspondance partielle insensible
à la casse sur :

- `symbol` ;
- `name`.

Les assets peuvent être filtrés par date de création et triés par :

- date de création ;
- symbole ;
- nom.

La réponse inclut des métadonnées utiles comme le symbole et le dernier prix
stocké. Chaque résultat renvoie vers :

```text
/dashboard?symbol=<symbol>
```

## Recherche d'analyses

Fonction backend concernée :

- `searchAnalyses` dans `web/src/app/api/search/route.ts`

La recherche textuelle d'analyses applique une correspondance partielle
insensible à la casse sur :

- le résumé d'analyse ;
- l'horizon d'analyse ;
- le symbole de l'asset lié ;
- le nom de l'asset lié.

Les analyses peuvent aussi être filtrées par :

- date de création ;
- label de tendance : `BULLISH`, `NEUTRAL` ou `BEARISH`.

Les résultats d'analyse incluent l'asset lié et exposent des métadonnées
normalisées :

- score de confiance ;
- score émotionnel ;
- score technique ;
- recommandation ;
- label de tendance.

La requête Prisma inclut l'asset lié dans la même opération, ce qui évite une
requête base de données séparée pour chaque résultat affiché.

## Tri

Fonctions backend concernées :

- `getAssetOrderBy` ;
- `getAnalysisOrderBy`.

L'interface expose trois clés de tri :

| Clé de tri | Tri des assets | Tri des analyses |
|---|---|---|
| `createdAt` | Date de création de l'asset | Date de création de l'analyse |
| `name` | Nom de l'asset | Nom de l'asset lié |
| `symbol` | Symbole de l'asset | Symbole de l'asset lié |

Chaque clé prend en charge l'ordre ascendant et descendant. Les clés et
directions inconnues retombent sur des valeurs par défaut sûres au lieu d'être
insérées dans une requête.

## Pagination

Fichiers concernés :

- `web/src/app/api/search/route.ts`
- `web/src/lib/search-types.ts`
- `web/src/components/SearchClient.tsx`

La pagination est effectuée dans PostgreSQL via Prisma :

```text
skip = (page - 1) * limit
take = limit
```

Le backend lance les requêtes de comptage et de résultats en parallèle avec
`Promise.all`. Il retourne :

- page courante ;
- taille de page ;
- nombre total d'enregistrements correspondants ;
- nombre total de pages ;
- présence d'une page précédente ;
- présence d'une page suivante.

L'interface désactive Précédent et Suivant lorsque la navigation est
indisponible ou qu'une requête est en cours.

## Cycle de requête

Le frontend construit une URL de requête depuis l'état complet et contrôlé des
filtres. Un changement de filtre démarre automatiquement une nouvelle recherche.

Chaque requête utilise un `AbortController`. Lorsque l'utilisateur modifie un
autre filtre avant la fin de la réponse courante, l'ancienne requête est
annulée. Cela empêche une réponse obsolète de remplacer des résultats plus
récents.

Les requêtes de recherche utilisent `cache: 'no-store'`, afin que les
changements de filtres retournent l'état le plus récent de la base.

L'implémentation envoie actuellement une requête à chaque changement du champ
texte. La requête précédente est annulée, mais l'entrée texte n'est pas
debouncée. Cela n'affecte pas les exigences du module et la limite de requêtes
API borne toujours l'usage authentifié.

## Normalisation des entrées et sécurité

Fichiers concernés :

- `web/src/app/api/search/route.ts`
- `web/src/lib/api-auth.ts`

Le backend protège la surface de requête en :

- limitant les requêtes texte à 80 caractères ;
- acceptant uniquement les types d'entités connus ;
- acceptant uniquement les clés de tri connues ;
- acceptant uniquement les directions `asc` ou `desc` ;
- remplaçant les pages invalides par la page 1 ;
- utilisant une taille de page par défaut de 10 ;
- limitant la taille de page à 50 ;
- convertissant les filtres de date en timestamps début/fin bornés ;
- acceptant uniquement les labels de tendance d'analyse connus ;
- construisant des objets Prisma au lieu de concaténer des chaînes SQL.

L'endpoint appelle `getApiUserProfile`, donc les requêtes exigent soit une
session navigateur valide, soit une clé API. Le rate limiter API partagé
s'applique aussi avant que la requête de recherche atteigne PostgreSQL.

## Contrat de réponse

Les types de réponse partagés sont définis dans :

- `web/src/lib/search-types.ts`

La réponse comporte trois sections :

```json
{
  "filters": {
    "q": "AAPL",
    "type": "assets",
    "sort": "createdAt",
    "direction": "desc",
    "page": 1,
    "limit": 10,
    "dateFrom": null,
    "dateTo": null,
    "sentiment": null
  },
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1,
    "hasPreviousPage": false,
    "hasNextPage": false
  },
  "results": []
}
```

Les assets et analyses sont convertis dans une forme unique
`SearchResultItem`. L'UI peut ainsi rendre les deux types d'entités avec le
même composant de résultat tout en conservant les valeurs propres à chaque
entité dans `metadata`.

## États d'interface

La page fournit des états dédiés pour :

- chargement ;
- échec de requête ;
- aucun résultat ;
- nombres de résultats au singulier et au pluriel ;
- page courante et nombre total de pages ;
- pages précédente ou suivante indisponibles.

Les résultats sont affichés sous forme de cartes réutilisables. Les résultats
navigables utilisent des liens, ce qui conserve les comportements navigateur
normaux comme l'ouverture d'un résultat dans un autre onglet.

## Internationalisation

Espaces de noms de traduction concernés :

- `searchPage` dans `web/langages/en.json` ;
- `searchPage` dans `web/langages/fr.json` ;
- `searchPage` dans `web/langages/es.json`.

Les labels de recherche, noms d'entités, options de tri, directions, valeurs de
sentiment, boutons, états de résultat, textes de pagination et erreurs sont
traduits en anglais, français et espagnol.

## Tests

Le script de test de l'API publique exerce l'endpoint de recherche authentifié :

```bash
API_KEY=ct_user_key \
ADMIN_API_KEY=ct_admin_key \
BASE_URL=https://localhost \
tests/api/public-api-tests.sh
```

Une vérification manuelle ciblée peut utiliser :

```bash
curl \
  -H "Authorization: Bearer $CLEARTREND_API_KEY" \
  "https://localhost/api/search?q=AAPL&type=assets&sort=symbol&direction=asc&page=1&limit=10"
```

Vérifications manuelles recommandées :

1. Chercher des assets par symbole partiel.
2. Chercher des assets par nom partiel.
3. Passer des assets aux analyses.
4. Filtrer les analyses par chaque sentiment.
5. Appliquer des dates de début et de fin.
6. Trier par date, nom et symbole dans les deux directions.
7. Naviguer vers l'avant et l'arrière sur plusieurs pages.
8. Réinitialiser tous les filtres et vérifier que la page revient à 1.
9. Ouvrir un résultat et vérifier que le dashboard sélectionne son asset.
10. Répéter une requête sans authentification et vérifier `401 Unauthorized`.

## Démonstration d'évaluation

Une démonstration évaluateur peut suivre ces étapes :

1. Se connecter et ouvrir `/search` depuis Recherche avancée.
2. Saisir un symbole partiel et montrer les résultats en base correspondants.
3. Changer le type d'entité vers les analyses.
4. Appliquer un filtre de sentiment et de plage de dates.
5. Modifier la clé et la direction de tri.
6. Naviguer entre les pages de résultats.
7. Ouvrir un résultat d'analyse dans le dashboard.
8. Montrer la réponse `/api/search` et ses métadonnées de pagination.
9. Expliquer Prisma `count`, `skip`, `take`, les filtres et le tri.
10. Montrer que les valeurs enum invalides retombent sur des valeurs sûres et
    que la taille de page est plafonnée.

## Fichiers principaux d'implémentation

- `web/src/app/search/page.tsx`
- `web/src/components/SearchClient.tsx`
- `web/src/app/api/search/route.ts`
- `web/src/lib/search-types.ts`
- `web/src/lib/api-auth.ts`
- `web/src/lib/prisma.ts`
- `web/src/components/ui/TextInput.tsx`
- `web/src/components/ui/SelectField.tsx`
- `web/src/components/ui/Button.tsx`
- `web/langages/en.json`
- `web/langages/fr.json`
- `web/langages/es.json`
- `tests/api/public-api-tests.sh`

## Périmètre actuel

Les types d'entités implémentés sont les assets et les analyses.

L'implémentation de ce module fournit plusieurs filtres fonctionnels, un tri
configurable et une pagination serveur complète sur deux types d'entités en
base liés entre eux.

## Conclusion

ClearTrend implémente la recherche avancée comme un parcours utilisateur
complet plutôt que comme un simple champ texte. La recherche combine plusieurs
filtres, un tri en base, une pagination serveur bornée, des résultats
normalisés et un accès protégé par clé API.

L'implémentation satisfait donc le module minor Recherche avancée.
