# Module 3 Languages

## Statut

- Type : module minor
- Valeur : 1 point
- Etat : implemente et valide
- Bibliotheque : `next-intl` (Internationalization (i18n))
- Langues : anglais (`en`), francais (`fr`) et espagnol (`es`)

Le sujet demande :

- un systeme d'internationalisation ;
- au moins trois traductions completes ;
- un selecteur de langue dans l'interface ;
- des textes utilisateur traduisibles.

ClearTrend utilise trois dictionnaires de meme structure et resout la langue
pour chaque requete Next.js.

## Architecture i18n

Le cycle de resolution est le suivant :

```text
Requete navigateur
      |
      +--> cookie cleartrend-locale valide ?
      |        |
      |        +--> oui : utiliser ce choix
      |
      +--> sinon : lire Accept-Language
      |
      +--> aucune langue supportee : anglais
               |
               v
Chargement de web/langages/{locale}.json
               |
               v
NextIntlClientProvider
               |
               v
Pages serveur et composants client
```

Les locales supportees et la locale par defaut sont centralisees dans
`web/src/i18n/locales.ts`.

La configuration `web/src/i18n/request.ts` :

1. lit le cookie `cleartrend-locale` ;
2. verifie qu'il vaut `en`, `fr` ou `es` ;
3. sinon, analyse l'en-tete HTTP `Accept-Language` ;
4. extrait la langue principale de valeurs telles que `fr-FR` ou `es-ES` ;
5. utilise l'anglais lorsqu'aucune langue n'est supportee ;
6. charge dynamiquement le dictionnaire JSON correspondant.

## Integration Next.js

Implementation :
[web/src/app/layout.tsx](../../web/src/app/layout.tsx)

Le layout racine recupere la locale et les messages cote serveur avec :

```text
getLocale()
getMessages()
```

`getLocale()` retourne la locale resolue pour la requete courante, par exemple
`fr`. `getMessages()` retourne le dictionnaire JSON correspondant deja charge
par la configuration `i18n/request.ts`.

Il fournit ensuite les traductions aux composants client avec
`NextIntlClientProvider`.

Par exemple, si le dictionnaire francais contient :

```json
{
  "dashboard": {
    "title": "Vue d'ensemble"
  }
}
```

Le provider rend ce dictionnaire accessible a tous ses composants enfants :

```tsx
<NextIntlClientProvider messages={messages}>
  <Dashboard />
</NextIntlClientProvider>
```

Le composant peut alors recuperer le texte avec :

```tsx
function Dashboard() {
  const t = useTranslations("dashboard");

  return <h1>{t("title")}</h1>;
}
```

Le resultat affiche est `Vue d'ensemble`.

L'attribut HTML est egalement adapte :

```html
<html lang="fr">
```

Cela informe le navigateur et les technologies d'assistance de la langue
active.

Les composants serveur et interactifs utilisent `getTranslations`.

## Changement de langue

Le composant `LanguageSelect` est disponible :

- sur la page de connexion ;
- dans le menu utilisateur du dashboard.

Lors d'un changement :

1. le composant ecrit le cookie `cleartrend-locale` ;
2. le cookie est conserve pendant un an ;
3. `SameSite=Lax` limite son envoi dans certains contextes tiers ;
4. `router.refresh()` recharge les composants serveur de la route courante ;
5. la nouvelle locale et le nouveau dictionnaire sont utilises.

Le changement ne modifie pas l'URL. Un utilisateur reste donc sur la meme page,
avec le meme asset et la meme periode.

Ce choix simplifie les routes existantes et evite des variantes
`/fr/dashboard`, `/en/dashboard` et `/es/dashboard`. En contrepartie, une URL ne
permet pas d'imposer une langue particuliere a son destinataire.

## Dictionnaires

Les fichiers sont :

```text
web/langages/en.json
web/langages/fr.json
web/langages/es.json
```

Chaque dictionnaire contient actuellement :

- 17 espaces de noms principaux ;
- 399 messages ;
- exactement les memes cles.

Les espaces de noms separent les domaines de l'interface, notamment :

- `common` ;
- `login` et `oauth` ;
- `dashboard`, `watchlist` et `chart` ;
- `profile` ;
- `language` et `theme` ;
- `searchPage` ;
- `apiDocsPage` et `apiKeyPage` ;
- `adminPage` et `analystPage` ;
- `statusPage` ;
- `legal` et `footer`.

Les variables sont injectees avec les mecanismes de `next-intl`, par exemple
pour un prix, un nombre de messages ou un nom d'asset.

## Ecrans couverts

Les traductions sont utilisees dans :

- connexion et inscription ;
- boutons OAuth ;
- dashboard ;
- watchlist et tris ;
- graphique, filtres, exports et metadonnees ;
- analyse IA ;
- parametres du profil ;
- import/export de watchlist ;
- recherche avancee ;
- documentation API ;
- gestion de cle API ;
- administration ;
- page analyste ;
- page de statut ;
- conditions d'utilisation et confidentialite ;
- footer ;
- selecteur de theme.

Les formats de nombres et de dates s'appuient aussi sur `Intl.NumberFormat`,
`Intl.DateTimeFormat` et `Intl.RelativeTimeFormat` dans les composants
financiers.

## Choix techniques

### `next-intl`

`next-intl` a ete choisi car il fonctionne avec l'App Router de Next.js et peut
etre utilise dans les composants serveur comme dans les composants client.

Cela evite de maintenir deux mecanismes differents pour les pages rendues sur le
serveur et les interactions du navigateur.

### Dictionnaires JSON

Les dictionnaires JSON sont faciles a comparer, versionner et relire sans
connaitre React. Une cle stable represente le sens du texte plutot que sa
position visuelle.

### Cookie plutot que stockage local

Le serveur doit connaitre la langue avant de rendre la page. Un cookie est
envoye avec la requete HTTP, contrairement a `localStorage`, accessible
uniquement apres le chargement du JavaScript.

Le cookie n'est pas `HttpOnly` car `LanguageSelect` doit pouvoir le modifier
depuis le navigateur. Il ne contient aucune information sensible.

## Fichiers principaux

| Fichier | Role |
|---|---|
| `web/src/i18n/locales.ts` | Liste des locales, valeur par defaut et lecture de `Accept-Language` |
| `web/src/i18n/request.ts` | Resolution de la locale et chargement du dictionnaire |
| `web/src/app/layout.tsx` | Provider global et attribut HTML `lang` |
| `web/src/components/ui/LanguageSelect.tsx` | Selecteur, cookie et rafraichissement |
| `web/langages/en.json` | Traductions anglaises |
| `web/langages/fr.json` | Traductions francaises |
| `web/langages/es.json` | Traductions espagnoles |

Tous les composants qui appellent `useTranslations` ou `getTranslations`
participent egalement au module.

## Verification automatique des cles

La commande suivante compte les messages et compare les cles :

```bash
python3 - <<'PY'
import json
from pathlib import Path

def flatten(value, prefix=""):
    result = {}
    for key, child in value.items():
        path = f"{prefix}.{key}" if prefix else key
        if isinstance(child, dict):
            result.update(flatten(child, path))
        else:
            result[path] = child
    return result

root = Path("web/langages")
dictionaries = {
    locale: flatten(json.loads((root / f"{locale}.json").read_text()))
    for locale in ("en", "fr", "es")
}

reference = set(dictionaries["en"])
for locale, messages in dictionaries.items():
    keys = set(messages)
    assert keys == reference, (
        locale,
        sorted(reference - keys),
        sorted(keys - reference),
    )
    print(locale, len(messages), "messages")
PY
```

Resultat attendu :

```text
en 399 messages
fr 399 messages
es 399 messages
```

La verification TypeScript et ESLint complete ce controle :

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml \
  exec -T web npm run lint

docker compose -f docker-compose.yml -f docker-compose.dev.yml \
  exec -T web npx tsc --noEmit
```

## Test manuel

1. Supprimer le cookie `cleartrend-locale`.
2. Configurer le navigateur en francais et ouvrir la page de connexion.
3. Verifier que le francais est selectionne automatiquement.
4. Choisir l'espagnol depuis le selecteur.
5. Naviguer vers le dashboard.
6. Verifier le dashboard, la watchlist, le graphique et le profil.
7. Recharger la page et verifier que l'espagnol est conserve.
8. Choisir l'anglais depuis le menu utilisateur.
9. Tester les textes longs sur une largeur mobile.

## Limites

- Les traductions sont LTR ; le support RTL constitue un module distinct.
- La langue n'apparait pas dans l'URL et une URL partagee ne transporte donc
  pas le choix de locale.
- La page interne `/ui-showcase` contient volontairement des exemples en
  anglais et en francais ; elle n'appartient pas au parcours produit.
- Certaines valeurs invariantes restent identiques dans toutes les langues,
  comme `A-Z`, `ADMIN`, les symboles boursiers et les noms Google/GitHub/42.
- Les messages techniques des API et les logs serveur sont principalement en
  anglais. L'interface traduit les erreurs attendues lorsqu'elles sont montrees
  a l'utilisateur.
- Les metadonnees globales du navigateur utilisent le nom de produit
  `ClearTrend` et une description anglaise non localisee.
- La parite des cles est verifiee, mais il n'existe pas de controle automatise
  de la qualite linguistique des traductions.

Le module garantit trois langues completes pour les ecrans principaux et une
architecture permettant d'ajouter une nouvelle locale sans modifier les
composants fonctionnels.
