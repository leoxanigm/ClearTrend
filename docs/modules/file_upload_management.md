# Module File Upload Management

## Statut

- Type : module minor
- Valeur : 1 point
- Etat : implemente et valide
- Perimetre : avatar utilisateur et import/export JSON des favoris

Le sujet demande :

- plusieurs types de fichiers ;
- validation client et serveur du type, de la taille et du format ;
- stockage securise avec controle d'acces ;
- apercu lorsque cela est pertinent ;
- progression des uploads ;
- suppression des fichiers uploades.

ClearTrend couvre ces exigences avec deux parcours complementaires :

1. gestion d'une image d'avatar ;
2. import et export d'une watchlist JSON.

## Partie 1 - Avatar

### Parcours utilisateur

Depuis les parametres du profil, l'utilisateur peut :

- selectionner une image JPEG, PNG ou WebP ;
- voir un apercu immediat ;
- zoomer dans l'image ;
- deplacer l'image horizontalement et verticalement ;
- enregistrer le cadrage ;
- remplacer l'avatar ;
- supprimer l'avatar.

Le zoom et le deplacement restent pilotes par :

- `avatarScale` ;
- `avatarOffsetX` ;
- `avatarOffsetY`.

L'integration de Sharp ne modifie donc pas le fonctionnement de l'editeur de
recadrage.

### Validation client

Le navigateur verifie avant l'envoi :

- le MIME JPEG, PNG ou WebP ;
- la taille maximale de 5 Mo ;
- la presence d'un fichier.

Un apercu local est cree avec `URL.createObjectURL`. Le formulaire utilise
`XMLHttpRequest` pour afficher la progression reelle de l'upload.

### Traitement serveur avec Sharp

Le serveur ne se contente pas de l'extension ou des premiers octets. Sharp
decode reellement l'image.

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

Toutes les nouvelles images sont stockees en WebP. Cela limite les formats
servis par l'application et retire notamment les metadonnees EXIF ou GPS.

### Stockage prive

Les nouveaux avatars ne sont plus enregistres dans `public/`.

Dans Docker :

```text
/app/uploads/avatars
```

Le dossier est monte dans le volume Docker :

```text
avatar_uploads
```

Le fichier reste donc disponible apres une recreation du conteneur web.

Permissions appliquees :

- dossier : `0700` ;
- fichier : `0600`.

Le nom contient l'identifiant utilisateur et un UUID aleatoire :

```text
<user-id>-<random-uuid>.webp
```

### Controle d'acces

Les fichiers ne sont pas accessibles par une URL publique directe. Ils sont
servis par :

```text
GET /api/profile/avatar/[fileName]
```

La route :

1. exige une session authentifiee ;
2. charge le profil courant ;
3. verifie que le fichier demande est exactement l'avatar actif de ce profil ;
4. retourne `404` pour un autre nom ou un ancien avatar ;
5. sert le contenu avec `Content-Type: image/webp` et
   `X-Content-Type-Options: nosniff`.

Un utilisateur ne peut donc pas lire l'avatar prive d'un autre utilisateur en
devinant son nom.

Les anciennes URLs locales sous `/uploads/avatars/` restent compatibles pendant
la transition. Un nouvel upload les remplace par le stockage prive.

### Remplacement et suppression

Lors d'un remplacement :

1. le nouveau fichier est traite et ecrit ;
2. la base est mise a jour ;
3. l'ancien fichier local est supprime.

Si la mise a jour de la base echoue, le nouveau fichier est supprime pour eviter
un fichier orphelin.

L'avatar est egalement supprime :

- lorsque l'utilisateur clique sur `Remove` ;
- lorsque le compte utilisateur est supprime.

## Partie 2 - Watchlist JSON

### Objectif

Un utilisateur peut exporter ses symboles favoris puis transmettre le fichier a
un autre utilisateur. L'import ajoute les symboles reconnus aux favoris sans
effacer ceux deja presents.

Cette fonctionnalite reste dans les parametres du profil. Aucune page de gestion
de fichiers artificielle n'a ete ajoutee.

### Format

Le format est volontairement petit et versionne :

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
- `symbols` doit etre un tableau.

`exportedAt` est informatif.

### Export

Endpoint :

```text
GET /api/assets/watchlist/file
```

La route :

- exige une session ou une identite API valide ;
- lit uniquement les favoris de l'utilisateur courant ;
- genere le JSON sans stocker de fichier serveur ;
- retourne un telechargement prive sans cache.

Nom du fichier :

```text
cleartrend-watchlist-YYYY-MM-DD.json
```

### Validation client de l'import

Avant l'upload, le navigateur verifie :

- extension `.json` ;
- MIME `application/json` ;
- taille comprise entre 1 octet et 64 Ko ;
- JSON syntaxiquement valide ;
- format et version pris en charge ;
- tableau `symbols` present ;
- maximum 999 entrees ;
- syntaxe des symboles.

L'interface affiche un apercu :

- nombre de symboles valides ;
- premiers symboles trouves ;
- nombre d'entrees invalides ignorees.

L'utilisateur confirme ensuite explicitement l'ajout aux favoris.

### Progression

L'import utilise `XMLHttpRequest` et `request.upload.progress`.

Une barre `progress` affiche le pourcentage d'octets transmis. Le bouton est
desactive pendant l'envoi pour eviter les doubles imports.

### Validation serveur

Endpoint :

```text
POST /api/assets/watchlist/file
Content-Type: multipart/form-data
```

Le serveur refait toutes les validations importantes. Il ne fait jamais
confiance a la validation du navigateur.

Il controle :

- authentification ;
- `multipart/form-data` ;
- nom en `.json` ;
- MIME `application/json` ;
- fichier non vide ;
- taille maximale de 64 Ko ;
- JSON valide ;
- format et version ;
- tableau et nombre d'entrees ;
- syntaxe et deduplication des symboles ;
- existence du symbole dans les tickers exposes par FastAPI.

Les symboles reconnus sont fusionnes avec les favoris existants. Les doublons
ne creent pas de nouvelle entree et les symboles inconnus sont retournes comme
ignores.

Exemple de reponse :

```json
{
  "alreadyFavoriteSymbols": ["AAPL"],
  "favoriteSymbols": ["AAPL", "MSFT"],
  "ignoredSymbols": ["ZZZZZZ"],
  "importedSymbols": ["MSFT"],
  "invalidEntries": 1
}
```

## Variables et limites

### Avatar

| Regle | Valeur |
|---|---:|
| Taille fichier maximale | 5 Mo |
| Dimension minimale | 64 x 64 px |
| Pixels maximum en entree | 25 000 000 |
| Dimension maximale en sortie | 1024 x 1024 px |
| Format de sortie | WebP |
| Qualite WebP | 82 |
| Dossier Docker | `/app/uploads/avatars` |
| Variable de dossier | `AVATAR_UPLOAD_DIR` |

### Watchlist JSON

| Regle | Valeur |
|---|---:|
| MIME | `application/json` |
| Extension | `.json` |
| Taille maximale | 64 Ko |
| Nombre maximal de symboles | 999 |
| Version | 1 |

## Tests automatises

Demarrer le projet en mode developpement :

```sh
make dev
```

Lancer tous les tests du module :

```sh
make test-file-upload
```

La commande execute trois scenarios depuis `tests/scripts/`.

### Pipeline d'image

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml \
  exec -T web npm run test:avatar-images
```

Cas verifies :

- JPEG carre ;
- PNG panoramique ;
- WebP vertical ;
- JPEG 4000 x 4000 ;
- orientation EXIF ;
- suppression des metadonnees ;
- image trop petite ;
- limite de pixels depassee ;
- MIME falsifie ;
- contenu non image.

### API avatar

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml \
  exec -T web npm run test:avatar-upload
```

Le test :

- cree un compte temporaire ;
- s'authentifie ;
- uploade une image panoramique avec zoom et offsets ;
- verifie les valeurs de recadrage en base ;
- verifie le refus sans session ;
- remplace l'image par un format vertical ;
- verifie la suppression de l'ancien fichier ;
- teste une image trop petite, un MIME falsifie et un fichier trop lourd ;
- supprime l'avatar ;
- supprime le compte temporaire.

### API watchlist JSON

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml \
  exec -T web npm run test:watchlist-file
```

Le test :

- verifie le refus sans authentification ;
- exporte une liste vide ;
- importe des symboles valides, dupliques, invalides et inconnus ;
- verifie la fusion des favoris ;
- reexporte la liste ;
- teste un second import idempotent ;
- refuse un mauvais MIME ;
- refuse un JSON casse ;
- refuse une version inconnue ;
- refuse un fichier superieur a 64 Ko ;
- supprime le compte temporaire.

## Verification manuelle

### Avatar

1. Ouvrir les parametres du profil.
2. Choisir une image panoramique.
3. Deplacer l'image et changer le zoom.
4. Enregistrer et rouvrir le profil.
5. Verifier que le cadrage est conserve.
6. Remplacer l'image par une image verticale.
7. Supprimer l'avatar.

### Watchlist JSON

1. Ajouter deux ou trois symboles aux favoris.
2. Ouvrir les parametres du profil.
3. Cliquer sur `Exporter JSON`.
4. Retirer un favori.
5. Cliquer sur `Importer JSON`.
6. Verifier l'apercu et confirmer.
7. Verifier le retour du favori dans la watchlist.

## Fichiers principaux

| Fichier | Role |
|---|---|
| `web/src/lib/avatar-images.ts` | Pipeline Sharp |
| `web/src/lib/avatar-storage.ts` | Stockage et suppression prives |
| `web/src/app/api/profile/route.ts` | Upload et metadata avatar |
| `web/src/app/api/profile/avatar/[fileName]/route.ts` | Lecture authentifiee |
| `web/src/components/ProfileSettingsDialog.tsx` | Apercus, progression et actions |
| `web/src/lib/watchlist-file.ts` | Format et validation JSON |
| `web/src/app/api/assets/watchlist/file/route.ts` | Import et export |
| `docker-compose.yml` | Volume persistant `avatar_uploads` |
| `tests/scripts/` | Scenarios automatises |

## Limites assumees

- Aucun partage public d'avatar ou de document n'est propose.
- Le JSON importe uniquement des favoris, pas des prix ou donnees financieres.
- Les JSON ne sont pas conserves sur le serveur apres traitement.
- Les symboles doivent exister dans le cache FastAPI au moment de l'import.
- Le stockage local Docker convient au projet, mais un stockage objet externe
  serait preferable pour une production distribuee.

