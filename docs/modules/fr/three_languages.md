# Module 3 Languages

## Statut

- Type : module minor
- Valeur : 1 point
- État : implémenté et validé
- Bibliothèque : `next-intl` (Internationalization (i18n))
- Langues : anglais (`en`), français (`fr`) et espagnol (`es`)

Le sujet demande :

- un système d'internationalisation ;
- au moins trois traductions complètes ;
- un sélecteur de langue dans l'interface ;
- des textes utilisateur traduisibles.

ClearTrend utilise trois dictionnaires de même structure et résout la langue
pour chaque requête Next.js.

## Architecture i18n

Le cycle de résolution est le suivant :

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

Les locales supportées et la locale par défaut sont centralisées dans
`web/src/i18n/locales.ts`.

La configuration `web/src/i18n/request.ts` :

1. lit le cookie `cleartrend-locale` ;
2. vérifie qu'il vaut `en`, `fr` ou `es` ;
3. sinon, analyse l'en-tête HTTP `Accept-Language` ;
4. extrait la langue principale de valeurs telles que `fr-FR` ou `es-ES` ;
5. utilise l'anglais lorsqu'aucune langue n'est supportée ;
6. charge dynamiquement le dictionnaire JSON correspondant.

## Intégration Next.js

Implémentation :
[web/src/app/layout.tsx](../../../web/src/app/layout.tsx)

Le layout racine récupère la locale et les messages côté serveur avec :

```text
getLocale()
getMessages()
```

`getLocale()` retourne la locale résolue pour la requête courante, par exemple
`fr`. `getMessages()` retourne le dictionnaire JSON correspondant déjà chargé
par la configuration `i18n/request.ts`.

Il fournit ensuite les traductions aux composants client avec
`NextIntlClientProvider`.

Par exemple, si le dictionnaire français contient :

```json
{
  "dashboard": {
    "title": "Vue d'ensemble"
  }
}
```

Le provider rend ce dictionnaire accessible à tous ses composants enfants :

```tsx
<NextIntlClientProvider messages={messages}>
  <Dashboard />
</NextIntlClientProvider>
```

Le composant peut alors récupérer le texte avec :

```tsx
function Dashboard() {
  const t = useTranslations("dashboard");

  return <h1>{t("title")}</h1>;
}
```

Le résultat affiché est `Vue d'ensemble`.

L'attribut HTML est également adapté :

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

1. le composant écrit le cookie `cleartrend-locale` ;
2. le cookie est conservé pendant un an ;
3. `SameSite=Lax` limite son envoi dans certains contextes tiers ;
4. `router.refresh()` recharge les composants serveur de la route courante ;
5. la nouvelle locale et le nouveau dictionnaire sont utilisés.

Le changement ne modifie pas l'URL. Un utilisateur reste donc sur la même page,
avec le même asset et la même période.

Ce choix simplifie les routes existantes et évite des variantes
`/fr/dashboard`, `/en/dashboard` et `/es/dashboard`. En contrepartie, une URL ne
permet pas d'imposer une langue particulière à son destinataire.

## Dictionnaires

Les fichiers sont :

```text
web/langages/en.json
web/langages/fr.json
web/langages/es.json
```

Chaque dictionnaire contient actuellement :

- 17 espaces de noms principaux ;
- 442 messages ;
- exactement les mêmes clés.

Les espaces de noms séparent les domaines de l'interface, notamment :

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

Les variables sont injectées avec les mécanismes de `next-intl`, par exemple
pour un prix, un nombre de messages ou un nom d'asset.

## Écrans couverts

Les traductions sont utilisées dans :

- connexion et inscription ;
- boutons OAuth ;
- dashboard ;
- watchlist et tris ;
- graphique, filtres, exports et métadonnées ;
- analyse IA ;
- paramètres du profil ;
- import/export de watchlist ;
- recherche avancée ;
- documentation API ;
- gestion de clé API ;
- administration ;
- page analyste ;
- page de statut ;
- conditions d'utilisation et confidentialité ;
- footer ;
- sélecteur de thème.

Les formats de nombres et de dates s'appuient aussi sur `Intl.NumberFormat`,
`Intl.DateTimeFormat` et `Intl.RelativeTimeFormat` dans les composants
financiers.

## Choix techniques

### `next-intl`

`next-intl` a été choisi car il fonctionne avec l'App Router de Next.js et peut
être utilisé dans les composants serveur comme dans les composants client.

Cela évite de maintenir deux mécanismes différents pour les pages rendues sur le
serveur et les interactions du navigateur.

### Dictionnaires JSON

Les dictionnaires JSON sont faciles à comparer, versionner et relire sans
connaître React. Une clé stable représente le sens du texte plutôt que sa
position visuelle.

### Cookie plutôt que stockage local

Le serveur doit connaître la langue avant de rendre la page. Un cookie est
envoyé avec la requête HTTP, contrairement à `localStorage`, accessible
uniquement après le chargement du JavaScript.

Le cookie n'est pas `HttpOnly` car `LanguageSelect` doit pouvoir le modifier
depuis le navigateur. Il ne contient aucune information sensible.

## Fichiers principaux

| Fichier | Rôle |
|---|---|
| `web/src/i18n/locales.ts` | Liste des locales, valeur par défaut et lecture de `Accept-Language` |
| `web/src/i18n/request.ts` | Résolution de la locale et chargement du dictionnaire |
| `web/src/app/layout.tsx` | Provider global et attribut HTML `lang` |
| `web/src/components/ui/LanguageSelect.tsx` | Sélecteur, cookie et rafraîchissement |
| `web/langages/en.json` | Traductions anglaises |
| `web/langages/fr.json` | Traductions françaises |
| `web/langages/es.json` | Traductions espagnoles |

Tous les composants qui appellent `useTranslations` ou `getTranslations`
participent également au module.

## Vérification automatique des clés

La commande suivante compte les messages et compare les clés :

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

Résultat attendu :

```text
en 442 messages
fr 442 messages
es 442 messages
```

La vérification TypeScript et ESLint complète ce contrôle :

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml \
  exec -T web npm run lint

docker compose -f docker-compose.yml -f docker-compose.dev.yml \
  exec -T web npx tsc --noEmit
```

## Test manuel

1. Supprimer le cookie `cleartrend-locale`.
2. Configurer le navigateur en français et ouvrir la page de connexion.
3. Vérifier que le français est sélectionné automatiquement.
4. Choisir l'espagnol depuis le sélecteur.
5. Naviguer vers le dashboard.
6. Vérifier le dashboard, la watchlist, le graphique et le profil.
7. Recharger la page et vérifier que l'espagnol est conservé.
8. Choisir l'anglais depuis le menu utilisateur.
9. Tester les textes longs sur une largeur mobile.

## Limites

- Les traductions sont LTR ; le support RTL constitue un module distinct.
- La langue n'apparaît pas dans l'URL et une URL partagée ne transporte donc
  pas le choix de locale.
- La page interne `/ui-showcase` contient volontairement des exemples en
  anglais et en français ; elle n'appartient pas au parcours produit.
- Certaines valeurs invariantes restent identiques dans toutes les langues,
  comme `A-Z`, `ADMIN`, les symboles boursiers et les noms Google/GitHub/42.
- Les messages techniques des API et les logs serveur sont principalement en
  anglais. L'interface traduit les erreurs attendues lorsqu'elles sont montrées
  à l'utilisateur.
- Les métadonnées globales du navigateur utilisent le nom de produit
  `ClearTrend` et une description anglaise non localisée.
- La parité des clés est vérifiée, mais il n'existe pas de contrôle automatisé
  de la qualité linguistique des traductions.

Le module garantit trois langues complètes pour les écrans principaux et une
architecture permettant d'ajouter une nouvelle locale sans modifier les
composants fonctionnels.
