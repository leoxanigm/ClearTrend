# Module File Upload Management

## Statut

- Type : module minor
- Valeur : 1 point
- État : implémenté et validé
- Périmètre : avatar utilisateur, import/export JSON des favoris et export du
  graphique en CSV/JSON

Le sujet demande :

- plusieurs types de fichiers ;
- validation client et serveur du type, de la taille et du format ;
- stockage sécurisé avec contrôle d'accès ;
- aperçu lorsque cela est pertinent ;
- progression des uploads ;
- suppression des fichiers uploades.

ClearTrend couvre ces exigences avec deux parcours d'upload complémentaires :

1. gestion d'une image d'avatar ;
2. import et export d'une watchlist JSON.

Le module comprend aussi un troisième parcours de fichier, uniquement en
téléchargement : l'export des données visibles du dashboard en CSV ou JSON.

## Architecture générale

Les deux parcours utilisent la même règle de sécurité :

```text
Validation rapide dans le navigateur
                |
                v
Endpoint Next.js authentifie
                |
                v
Validation complete cote serveur
                |
                +--> avatar : traitement et stockage prive
                |
                +--> JSON : lecture, fusion en base, aucun stockage du fichier
```

La validation client ameliore l'experience utilisateur, mais elle n'est jamais
considérée comme une protection suffisante. Toutes les contraintes importantes
sont appliquées à nouveau par le backend.

L'export du dashboard ne suit pas ce pipeline d'upload : il transforme dans le
navigateur des données déjà chargees et ne transmet aucun fichier au serveur.

## Partie 1 - Avatar

### Parcours utilisateur

Code associé : [`ProfileSettingsDialog`](../../../web/src/components/ProfileSettingsDialog.tsx#L94)

Depuis les paramètres du profil, l'utilisateur peut :

- sélectionner une image JPEG, PNG ou WebP ;
- voir un aperçu immédiat ;
- zoomer dans l'image ;
- deplacer l'image horizontalement et verticalement ;
- enregistrer le cadrage ;
- remplacer l'avatar ;
- supprimer l'avatar.

Le zoom et le déplacement restent pilotés par :

- `avatarScale` ;
- `avatarOffsetX` ;
- `avatarOffsetY`.

### Validation client

Code associé : [`handleFileChange`](../../../web/src/components/ProfileSettingsDialog.tsx#L281)

Le navigateur vérifie avant l'envoi :

- le MIME JPEG, PNG ou WebP ;
- la taille maximale de 5 Mo ;
- la presence d'un fichier.

Un aperçu local est créé avec `URL.createObjectURL`. Le formulaire utilise
`XMLHttpRequest` pour afficher la progression réelle de l'upload.

### Traitement serveur avec Sharp

Code associé : [`processAvatarImage`](../../../web/src/lib/avatar-images.ts#L35)

Le serveur ne se contente pas de l'extension ou des premiers octets. Sharp
décode reellement l'image.

Pipeline :

```text
JPEG / PNG / WebP
        |
        +--> taille maximale : 5 Mo
        +--> format annonce = format decode
        +--> minimum : 64 x 64 pixels
        +--> maximum : 25 millions de pixels en entree
        +--> refus des images animees
        +--> correction de l'orientation EXIF
        +--> redimensionnement maximal : 1024 x 1024
        +--> conservation du ratio
        +--> aucune augmentation des petites images
        +--> conversion WebP, qualite 82
        +--> suppression des metadonnees
```

Toutes les nouvelles images sont stockées en WebP. Cela limite les formats
servis par l'application et retire notamment les métadonnées EXIF ou GPS.

Sharp normalise l'image complète, mais n'applique pas destructivement le
recadrage choisi par l'utilisateur. Le zoom et les offsets sont enregistrés en
base, puis appliques en CSS par `UserAvatar`. L'utilisateur peut donc modifier
son cadrage plus tard sans réencoder plusieurs fois l'image.

### Pourquoi Sharp

Une vérification du MIME ou de l'extension ne prouve pas qu'un fichier contient
une image valide. Sharp décode les octets avec une bibliothèque spécialisée et
permet dans un seul pipeline :

- de comparer le format réel au MIME annonce ;
- de limiter le nombre de pixels avant traitement ;
- de corriger l'orientation ;
- de redimensionner sans déformer ;
- de supprimer les métadonnées ;
- de produire un format unique.

Le format WebP a été retenu pour réduire la taille de stockage tout en gardant
une qualité suffisante pour un avatar.

### Stockage privé

Code associé : [`ensureAvatarDirectory`](../../../web/src/lib/avatar-storage.ts#L16)

Les avatars sont stockes hors du dossier `public/` de Next.js :

```text
/app/uploads/avatars
```

Next.js ne peut donc pas les servir automatiquement comme des ressources
publiques. Leur lecture doit obligatoirement passer par l'API authentifiée.

Dans Docker, ce dossier est relié au volume persistant :

```text
avatar_uploads
```

Le conteneur web peut être recréé sans supprimer les avatars. Les fichiers
restent séparés de l'image Docker et du code source.

Permissions appliquées :

- dossier `0700` : seul le propriétaire du processus peut lire, ecrire et
  parcourir le dossier ;
- fichier `0600` : seul le propriétaire peut lire ou modifier l'avatar.

Chaque fichier utilise un nom non prévisible contenant l'identifiant utilisateur
et un UUID aléatoire :

```text
<user-id>-<random-uuid>.webp
```

L'identifiant facilite l'association technique au compte. L'UUID évite les
collisions de noms et permet de remplacer un avatar sans problème de cache.

### Contrôle d'accès

Code associé : [`GET /api/profile/avatar/[fileName]`](../../../web/src/app/api/profile/avatar/[fileName]/route.ts#L20)

Les fichiers ne sont pas accessibles par une URL publique directe. Ils sont
servis par :

```text
GET /api/profile/avatar/[fileName]
```

La route :

1. exige une session authentifiée ;
2. charge le profil courant ;
3. vérifie que le fichier demande est exactement l'avatar actif de ce profil ;
4. retourne `404` pour un autre nom ou un ancien avatar ;
5. sert le contenu avec `Content-Type: image/webp` et
   `X-Content-Type-Options: nosniff`.

Un utilisateur ne peut donc pas lire l'avatar privé d'un autre utilisateur en
devinant son nom.

Le header `Cache-Control: private, max-age=31536000, immutable` est compatible
avec ce fonctionnement : chaque remplacement génère un nom UUID différent. Le
navigateur peut donc conserver longtemps la réponse sans afficher une mauvaise
version de l'avatar.

### Remplacement et suppression

Code associé : [`PATCH /api/profile`](../../../web/src/app/api/profile/route.ts#L117)

Lors d'un remplacement :

1. le nouveau fichier est traité et écrit ;
2. la base est mise à jour ;
3. l'ancien fichier local est supprime.

Si la mise à jour de la base échoue, le nouveau fichier est supprimé pour éviter
un fichier orphelin.

L'avatar est egalement supprime :

- lorsque l'utilisateur clique sur `Remove` ;
- lorsque le compte utilisateur est supprime.

## Partie 2 - Watchlist JSON

### Objectif

Un utilisateur peut exporter ses symboles favoris puis transmettre le fichier à
un autre utilisateur. L'import ajoute les symboles reconnus aux favoris sans
effacer ceux déjà presents.

Cette fonctionnalite reste dans les paramètres du profil. Aucune page de gestion
de fichiers artificielle n'a été ajoutée.

### Format

Code associé : [`validateWatchlistFile`](../../../web/src/lib/watchlist-file.ts#L37)

Le format est volontairement petit et versionné :

```json
{
  "exportedAt": "2026-06-07T17:23:22.565Z",
  "format": "cleartrend-watchlist",
  "symbols": ["AAPL", "MSFT", "NVDA"],
  "version": 1
}
```

Champs obligatoires :

- `format` doit valoir `cleartrend-watchlist` ;
- `version` doit valoir `1` ;
- `symbols` doit être un tableau.

`exportedAt` est informatif.

### Pourquoi JSON

JSON correspond directement à une liste de symboles et permet d'ajouter des
champs sans ambiguite dans une future version. Les champs `format` et `version`
évitent d'interpreter par erreur un autre document JSON comme une watchlist
ClearTrend.

L'import fusionne les favoris au lieu de remplacer la liste existante. Cette
stratégie est plus sure pour un fichier transmis entre utilisateurs : un import
ne peut pas supprimer silencieusement les favoris déjà enregistrés.

### Export

Code associé : [`GET /api/assets/watchlist/file`](../../../web/src/app/api/assets/watchlist/file/route.ts#L29)

Endpoint :

```text
GET /api/assets/watchlist/file
```

La route :

- exige une session ou une identité API valide ;
- lit uniquement les favoris de l'utilisateur courant ;
- génère le JSON sans stocker de fichier serveur ;
- retourne un téléchargement privé sans cache.

Nom du fichier :

```text
cleartrend-watchlist-YYYY-MM-DD.json
```

### Validation client de l'import

Code associé : [`handleWatchlistFileChange`](../../../web/src/components/ProfileSettingsDialog.tsx#L327)

Avant l'upload, le navigateur vérifie :

- extension `.json` ;
- MIME `application/json` ;
- taille comprise entre 1 octet et 64 Ko ;
- JSON syntaxiquement valide ;
- format et version pris en charge ;
- tableau `symbols` present ;
- maximum 999 entrées ;
- syntaxe des symboles.

L'interface affiche un aperçu :

- nombre de symboles valides ;
- premiers symboles trouves ;
- nombre d'entrées invalides ignorées.

L'utilisateur confirme ensuite explicitement l'ajout aux favoris.

L'aperçu est construit localement avant l'envoi. Il permet de reperer un mauvais
fichier et de connaitre le nombre d'entrées invalides sans modifier la base.

### Progression

Code associé : [`handleWatchlistImport`](../../../web/src/components/ProfileSettingsDialog.tsx#L418)

L'import utilise `XMLHttpRequest` et `request.upload.progress`.

Une barre `progress` affiche le pourcentage d'octets transmis. Le bouton est
désactivé pendant l'envoi pour éviter les doubles imports.

### Validation serveur

Code associé : [`POST /api/assets/watchlist/file`](../../../web/src/app/api/assets/watchlist/file/route.ts#L52)

Endpoint :

```text
POST /api/assets/watchlist/file
Content-Type: multipart/form-data
```

Le serveur refait toutes les validations importantes. Il ne fait jamais
confiance à la validation du navigateur.

Il contrôle :

- authentification ;
- `multipart/form-data` ;
- nom en `.json` ;
- MIME `application/json` ;
- fichier non vide ;
- taille maximale de 64 Ko ;
- JSON valide ;
- format et version ;
- tableau et nombre d'entrées ;
- syntaxe et déduplication des symboles ;
- existence du symbole dans les tickers exposés par FastAPI.

Les symboles reconnus sont fusionnes avec les favoris existants. Les doublons
ne creent pas de nouvelle entrée et les symboles inconnus sont retournes comme
ignorés.

Le fichier JSON lui-même n'est pas conservé. Seuls les symboles valides sont
enregistrés dans la watchlist de l'utilisateur. Il n'existe donc aucun document
importé à protéger ou supprimer après le traitement.

Exemple de réponse :

```json
{
  "alreadyFavoriteSymbols": ["AAPL"],
  "favoriteSymbols": ["AAPL", "MSFT"],
  "ignoredSymbols": ["ZZZZZZ"],
  "importedSymbols": ["MSFT"],
  "invalidEntries": 1
}
```

## Partie 3 - Export du dashboard en CSV et JSON

### Objectif

Le graphique permet de telecharger les bougies actuellement visibles afin de les
ouvrir dans un tableur, les analyser avec un autre outil ou conserver un
instantané des données affichées.

Les boutons `Exporter CSV` et `Exporter JSON` utilisent exactement :

- l'actif sélectionné ;
- la plage active, par exemple `1D` ou `1M` ;
- les dates choisies par l'utilisateur ;
- les bougies restantes après ce filtrage.

Ils sont désactivés pendant le chargement, en cas d'erreur ou lorsqu'aucune
bougie n'est visible.

### Contenu exporte

Code associé : [`createChartCsvExport` et `createChartJsonExport`](../../../web/src/lib/chart-analytics.ts#L58)

Chaque bougie contient :

| Champ | Signification |
|---|---|
| `datetime` | Date et heure de la bougie |
| `open` | Prix d'ouverture |
| `high` | Prix le plus haut |
| `low` | Prix le plus bas |
| `close` | Prix de clôture |
| `volume` | Volume, lorsqu'il est disponible |
| `change_percent` / `changePercent` | Variation entre ouverture et clôture |

Le CSV ajoute `symbol` et `range` sur chaque ligne pour rester compréhensible
une fois ouvert seul dans un tableur.

Le JSON ajoute des métadonnées globales : symbole, plage, intervalle, source,
date de mise à jour, date d'export, format `cleartrend-chart` et version `1`.
Son format versionné permet d'identifier clairement un export ClearTrend.

### Génération du téléchargement

Code associé : [`downloadChartData`](../../../web/src/components/AssetChart.tsx#L864)

Le contenu est généré entièrement dans `AssetChart` :

```text
Bougies visibles
      |
      +--> conversion CSV ou JSON
      |
      +--> creation d'un Blob en memoire
      |
      +--> URL temporaire du navigateur
      |
      +--> telechargement puis liberation de l'URL
```

Aucun fichier n'est créé ou conservé sur le serveur. Il n'y a donc ni stockage
privé, ni contrôle d'accès supplémentaire : les données exportées sont celles
que l'utilisateur a déjà reçues pour afficher son dashboard.

Nom des fichiers :

```text
cleartrend-<symbol>-<range>-YYYY-MM-DD.csv
cleartrend-<symbol>-<range>-YYYY-MM-DD.json
```

## Variables et limites

### Avatar

| Règle | Valeur |
|---|---:|
| Taille fichier maximale | 5 Mo |
| Dimension minimale | 64 x 64 px |
| Pixels maximum en entrée | 25 000 000 |
| Dimension maximale en sortie | 1024 x 1024 px |
| Format de sortie | WebP |
| Qualité WebP | 82 |
| Dossier Docker | `/app/uploads/avatars` |
| Variable de dossier | `AVATAR_UPLOAD_DIR` |

### Watchlist JSON

| Règle | Valeur |
|---|---:|
| MIME | `application/json` |
| Extension | `.json` |
| Taille maximale | 64 Ko |
| Nombre maximal de symboles | 999 |
| Version | 1 |

### Export du dashboard

| Règle | Valeur |
|---|---:|
| Formats | CSV et JSON |
| Schéma JSON | `cleartrend-chart`, version 1 |
| Précision de la variation | 6 décimales maximum |
| Données exportées | Bougies visibles après filtrage |
| Stockage serveur | Aucun |

## Tests automatisés

Demarrer le projet en mode développement :

```sh
make dev
```

Lancer tous les tests du module :

```sh
make test-file-upload
```

La commande execute trois scénarios depuis `tests/scripts/`.

### Pipeline d'image

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml \
  exec -T web npm run test:avatar-images
```

Cas vérifiés :

- JPEG carre ;
- PNG panoramique ;
- WebP vertical ;
- JPEG 4000 x 4000 ;
- orientation EXIF ;
- suppression des métadonnées ;
- image trop petite ;
- limite de pixels dépassée ;
- MIME falsifié ;
- contenu non image.

### API avatar

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml \
  exec -T web npm run test:avatar-upload
```

Le test :

- crée un compte temporaire ;
- s'authentifie ;
- uploade une image panoramique avec zoom et offsets ;
- vérifie les valeurs de recadrage en base ;
- vérifie le refus sans session ;
- remplace l'image par un format vertical ;
- vérifie la suppression de l'ancien fichier ;
- teste une image trop petite, un MIME falsifié et un fichier trop lourd ;
- supprime l'avatar ;
- supprime le compte temporaire.

### API watchlist JSON

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml \
  exec -T web npm run test:watchlist-file
```

Le test :

- vérifie le refus sans authentification ;
- exporte une liste vide ;
- importe des symboles valides, dupliqués, invalides et inconnus ;
- vérifie la fusion des favoris ;
- réexporte la liste ;
- teste un second import idempotent ;
- refuse un mauvais MIME ;
- refuse un JSON casse ;
- refuse une version inconnue ;
- refuse un fichier supérieur à 64 Ko ;
- supprime le compte temporaire.

### Export CSV et JSON du dashboard

```sh
make test-analytics-dashboard
```

Le test vérifie :

- l'en-tête et les lignes du CSV ;
- les valeurs manquantes, comme un volume indisponible ;
- le calcul de la variation en pourcentage ;
- le format et la version du JSON ;
- les métadonnées du graphique ;
- le nom date des fichiers.

## Vérification manuelle

### Avatar

1. Ouvrir les paramètres du profil.
2. Choisir une image panoramique.
3. Deplacer l'image et changer le zoom.
4. Enregistrer et rouvrir le profil.
5. Vérifier que le cadrage est conservé.
6. Remplacer l'image par une image verticale.
7. Supprimer l'avatar.

### Watchlist JSON

1. Ajouter deux ou trois symboles aux favoris.
2. Ouvrir les paramètres du profil.
3. Cliquer sur `Exporter JSON`.
4. Retirer un favori.
5. Cliquer sur `Importer JSON`.
6. Vérifier l'aperçu et confirmer.
7. Vérifier le retour du favori dans la watchlist.

### Export du dashboard

1. Ouvrir un actif dans le dashboard.
2. Choisir une plage et, si nécessaire, limiter les dates.
3. Cliquer sur `Exporter CSV`, puis ouvrir le fichier dans un tableur.
4. Cliquer sur `Exporter JSON` et vérifier ses métadonnées et ses bougies.
5. Confirmer que les fichiers contiennent uniquement les données visibles.

## Fichiers principaux

| Fichier | Rôle |
|---|---|
| `web/src/lib/avatar-images.ts` | Pipeline Sharp |
| `web/src/lib/avatar-storage.ts` | Stockage et suppression privés |
| `web/src/lib/profile-rules.ts` | Limites du fichier et bornes du recadrage |
| `web/src/lib/profile-types.ts` | Contrat du profil et métadonnées de recadrage |
| `web/src/app/api/profile/route.ts` | Upload et metadata avatar |
| `web/src/app/api/profile/avatar/[fileName]/route.ts` | Lecture authentifiée |
| `web/src/components/ProfileSettingsDialog.tsx` | Aperçus, progression et actions |
| `web/src/components/UserAvatar.tsx` | Application visuelle du zoom et des offsets |
| `web/src/lib/watchlist-file.ts` | Format et validation JSON |
| `web/src/app/api/assets/watchlist/file/route.ts` | Import et export |
| `web/src/lib/assets.ts` | Lecture et fusion des favoris en base |
| `web/src/app/api/account/delete/route.ts` | Nettoyage de l'avatar à la suppression du compte |
| `web/src/lib/chart-analytics.ts` | Construction des contenus CSV/JSON et noms de fichiers |
| `web/src/components/AssetChart.tsx` | Déclenchement du téléchargement des bougies visibles |
| `docker-compose.yml` | Volume persistant `avatar_uploads` |
| `tests/scripts/` | Scénarios automatisés des trois parcours |

## Limites assumées

- Les symboles doivent exister dans le cache FastAPI au moment de l'import.
- Le recadrage est appliqué à l'affichage et non intégré dans le fichier WebP.
  Un autre consommateur du fichier brut ne retrouverait donc pas le même cadre.
- Le volume Docker est partagé par une seule instance web. Une architecture
  horizontale avec plusieurs serveurs nécessiterait un stockage objet commun.
- L'export du dashboard est un instantané des données déjà chargees. Il ne
  demande pas au backend un historique plus large que la plage visible.
- Le CSV est destiné à l'analyse tabulaire et ne conserve pas toutes les
  métadonnées globales disponibles dans le JSON.
