# Module Custom Design System

## Statut

- Type : module minor
- Valeur : 1 point
- Etat : implemente et valide
- Demonstration : `/ui-showcase`

Le sujet demande un design system realise pour le projet avec :

- une palette de couleurs coherente ;
- une typographie coherente ;
- un systeme d'icones ;
- au moins dix composants reutilisables.

ClearTrend fournit une bibliotheque interne de composants React, des tokens de
theme clair/sombre et une page de demonstration accessible directement par son
URL.

## Organisation

Le design system est organise en trois couches :

```text
Tokens visuels
  globals.css
      |
      v
Primitives generiques
  components/ui/*.tsx + components/ui/ui.css
      |
      v
Compositions applicatives
  LanguageSelect, UserAvatar, formulaires et ecrans
```

Les composants utilisent les elements HTML natifs lorsque cela est possible.
Par exemple, `Button` reste un vrai bouton, `SelectField` un vrai `select` et
`DropdownMenu` s'appuie sur `details/summary`.

Ce choix conserve les comportements clavier et navigateur de base, limite les
dependances externes et rend les composants faciles a lire.

## Palette et themes

Les couleurs principales sont declarees comme variables CSS :

| Token | Utilisation |
|---|---|
| `--app-background` | Arriere-plan principal |
| `--app-surface` | Cartes, modales et panneaux |
| `--app-panel` | Surface secondaire |
| `--app-border` | Bordures et separateurs |
| `--app-text` | Texte principal |
| `--app-muted` | Texte secondaire |
| `--app-accent` | Action ou information mise en avant |
| `--app-secondary` | Deuxieme couleur fonctionnelle |
| `--app-accent-contrast` | Texte place sur la couleur d'accent |

Deux palettes completes sont disponibles :

- theme clair dans `:root` ;
- theme sombre dans `:root[data-theme="dark"]`.

Sans choix utilisateur, `prefers-color-scheme` reprend le theme du systeme. Le
composant `ThemeSwitch` enregistre ensuite le choix dans
`localStorage` sous la cle `cleartrend-theme`.

La page `/ui-showcase` affiche les tokens sous forme d'echantillons afin de
controler rapidement leur rendu dans les deux themes.

## Typographie

Le projet utilise la pile sans-serif fournie par Tailwind et le navigateur,
sans charger de police distante. Les composants heritent de la typographie
globale avec `font: inherit`.

La hierarchie repose sur :

- des tailles distinctes pour titres, valeurs, labels et aide ;
- des graisses coherentes pour les actions et donnees importantes ;
- `letter-spacing: 0` pour conserver une lecture reguliere ;
- des textes secondaires relies au token `--app-muted`.

L'absence de police distante accelere le chargement et evite un changement de
mise en page pendant son telechargement.

## Composants reutilisables

### Primitives

| Composant | Role principal |
|---|---|
| `Avatar` | Image circulaire ou fallback textuel |
| `Badge` | Etat court avec tons default, accent, success, warning et danger |
| `Button` | Bouton primary, outline, plain, sidebar ou tab |
| `Card` | Surface encadree avec padding optionnel |
| `DropdownMenu` | Menu generique base sur `details/summary` |
| `IconButton` | Bouton carre avec label accessible, tailles et etat presse |
| `MetricTile` | Carte de statistique avec label, valeur, description et ton |
| `Modal` | Backdrop et panneau dialog/form/section |
| `SegmentedControl` | Selection exclusive composee de boutons onglets |
| `SelectField` | Champ select generique type et labelle |
| `TextInput` | Champ input avec label et classes configurables |
| `ThemeSwitch` | Bascule clair/sombre persistante |
| `Toast` | Message temporaire info, success, warning ou error |
| `Tooltip` | Aide au survol et au focus clavier |

### Compositions

| Composant ou service | Composition |
|---|---|
| `LanguageSelect` | `SelectField`, cookie de locale et rafraichissement Next.js |
| `NotificationProvider` | Contexte React, file de notifications et rendu de `Toast` |

Le minimum de dix composants est donc depasse sans compter les composants
metier tels que le graphique, la watchlist ou le formulaire de profil.

## Reutilisation dans l'application

Le design system n'est pas limite a la showcase :

- la page de connexion utilise `Card`, `Button`, `TextInput`,
  `SegmentedControl` et `LanguageSelect` ;
- le dashboard utilise `Badge`, `Button`, `DropdownMenu`, `MetricTile`,
  `Tooltip`, `ThemeSwitch` et `LanguageSelect` ;
- le graphique utilise `Button`, `IconButton`, `SegmentedControl` et
  `Tooltip` ;
- les parametres du profil utilisent `Modal`, `TextInput`, `Button`,
  `IconButton` et les notifications ;
- la recherche utilise les champs et boutons generiques ;
- l'administration reutilise `Button` et `SelectField` ;
- `UserAvatar` compose le composant generique `Avatar`.

Le fichier `components/ui/index.ts` permet aussi d'importer plusieurs primitives
depuis une seule entree.

## Systeme d'icones et assets

Le projet utilise plusieurs familles d'icones :

- SVG officiels pour Google, GitHub et 42 School ;
- deux variantes bitmap du logo ClearTrend pour les themes clair et sombre ;
- petites icones SVG internes pour le theme ;
- symboles CSS pour fermer, ajouter, retirer et ouvrir le menu mobile ;
- etoile de favori et pastille IA dans la watchlist.

Les boutons uniquement visuels utilisent un `aria-label` fourni par
`IconButton` ou directement par le composant appelant.

## Page UI Showcase

La route :

```text
/ui-showcase
```

presente :

- les couleurs de base ;
- les variantes de boutons ;
- un controle segmente ;
- les boutons d'icones ;
- les champs de formulaire ;
- les badges ;
- les cartes de metriques ;
- l'avatar ;
- le menu deroulant ;
- le tooltip ;
- une notification ;
- une modale ;
- le changement de theme.

Cette page n'est pas liee dans la navigation produit. Elle sert de catalogue
visuel et de support de verification pendant le developpement.

## Accessibilite integree

Les primitives fournissent plusieurs bases communes :

- vrais elements `button`, `input`, `select`, `label`, `details` et `summary` ;
- `aria-label` obligatoire pour `IconButton` ;
- `aria-pressed` pour les etats binaires ;
- `role="dialog"` et `aria-modal` pour `Modal` ;
- `role="status"` ou `role="alert"` pour `Toast` ;
- region `aria-live` pour les notifications ;
- tooltip visible au survol et au `focus-visible` ;
- classe `sr-only` pour les labels conserves uniquement pour les lecteurs
  d'ecran.

Ces elements ameliorent la base semantique, mais le module ne revendique pas a
lui seul une conformite WCAG 2.1 AA complete.

## Fichiers principaux

| Fichier | Role |
|---|---|
| `web/src/components/ui/` | Composants React reutilisables |
| `web/src/components/ui/ui.css` | Styles des primitives, formulaires, themes, selecteurs et notifications |
| `web/src/components/ui/index.ts` | Point d'export groupe |
| `web/src/components/ui/cx.ts` | Assemblage simple des classes conditionnelles |
| `web/src/app/globals.css` | Tokens de couleurs, structure des pages et surcharges propres aux ecrans |
| `web/src/app/ui-showcase/page.tsx` | Route de demonstration |
| `web/src/app/ui-showcase/UiShowcaseClient.tsx` | Catalogue interactif |
| `web/public/` | Logos et icones OAuth |

## Verification

### Verification manuelle

1. Ouvrir `/ui-showcase`.
2. Controler chaque composant dans le theme clair.
3. Basculer vers le theme sombre.
4. Reduire la largeur de la fenetre.
5. Tester les boutons, le select, le menu, le tooltip, le toast et la modale.
6. Parcourir les controles au clavier avec `Tab`.
7. Verifier ensuite leur reutilisation sur `/login` et `/dashboard`.

### Verification technique

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml \
  exec -T web npm run lint
```

ESLint analyse la qualite du code et signale certaines erreurs ou mauvaises
pratiques.

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml \
  exec -T web npx tsc --noEmit
```

TypeScript verifie les types sans generer de fichier.

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml \
  exec -T web npm run build
```

Le build compile l'application Next.js comme pour la production et detecte les
erreurs qui empecheraient son deploiement.

## Limites

- Il n'existe pas de tests visuels automatises ou de snapshots des composants.
- Le systeme d'icones n'utilise pas une bibliotheque unique : il combine assets,
  SVG internes, caracteres et formes CSS.
- La typographie repose sur la pile sans-serif du systeme, sans famille de
  police de marque dediee.

Ces limites concernent surtout l'industrialisation du design system. Les
tokens, les themes, le catalogue et plus de dix composants reutilisables sont
deja utilises par les ecrans du produit.
