# Module Custom Design System

## Statut

- Type : module minor
- Valeur : 1 point
- État : implémenté et validé
- Démonstration : `/ui-showcase`

Le sujet demande un design system realise pour le projet avec :

- une palette de couleurs cohérente ;
- une typographie cohérente ;
- un système d'icônes ;
- au moins dix composants réutilisables.

ClearTrend fournit une bibliothèque interne de composants React, des tokens de
thème clair/sombre et une page de démonstration accessible directement par son
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
  LanguageSelect, UserAvatar, formulaires et écrans
```

Les composants utilisent les éléments HTML natifs lorsque cela est possible.
Par exemple, `Button` reste un vrai bouton, `SelectField` un vrai `select` et
`DropdownMenu` s'appuie sur `details/summary`.

Ce choix conserve les comportements clavier et navigateur de base, limite les
dépendances externes et rend les composants faciles à lire.

## Palette et thèmes

Les couleurs principales sont déclarées comme variables CSS :

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

Deux palettes complètes sont disponibles :

- thème clair dans `:root` ;
- thème sombre dans `:root[data-theme="dark"]`.

Sans choix utilisateur, `prefers-color-scheme` reprend le thème du système. Le
composant `ThemeSwitch` enregistre ensuite le choix dans
`localStorage` sous la clé `cleartrend-theme`.

La page `/ui-showcase` affiche les tokens sous forme d'échantillons afin de
controler rapidement leur rendu dans les deux thèmes.

## Typographie

Le projet utilise la pile sans-serif fournie par Tailwind et le navigateur,
sans charger de police distante. Les composants héritent de la typographie
globale avec `font: inherit`.

La hiérarchie repose sur :

- des tailles distinctes pour titres, valeurs, labels et aide ;
- des graisses cohérentes pour les actions et données importantes ;
- `letter-spacing: 0` pour conserver une lecture régulière ;
- des textes secondaires reliés au token `--app-muted`.

L'absence de police distante accelere le chargement et évite un changement de
mise en page pendant son téléchargement.

## Composants réutilisables

### Primitives

| Composant | Rôle principal |
|---|---|
| `Avatar` | Image circulaire ou fallback textuel |
| `Badge` | État court avec tons default, accent, success, warning et danger |
| `Button` | Bouton primary, outline, plain, sidebar ou tab |
| `Card` | Surface encadree avec padding optionnel |
| `DropdownMenu` | Menu générique base sur `details/summary` |
| `IconButton` | Bouton carre avec label accessible, tailles et état presse |
| `MetricTile` | Carte de statistique avec label, valeur, description et ton |
| `Modal` | Backdrop et panneau dialog/form/section |
| `SegmentedControl` | Selection exclusive composee de boutons onglets |
| `SelectField` | Champ select générique type et labelle |
| `TextInput` | Champ input avec label et classes configurables |
| `ThemeSwitch` | Bascule clair/sombre persistante |
| `Toast` | Message temporaire info, success, warning ou error |
| `Tooltip` | Aide au survol et au focus clavier |

### Compositions

| Composant ou service | Composition |
|---|---|
| `LanguageSelect` | `SelectField`, cookie de locale et rafraîchissement Next.js |
| `NotificationProvider` | Contexte React, file de notifications et rendu de `Toast` |

Le minimum de dix composants est donc depasse sans compter les composants
métier tels que le graphique, la watchlist ou le formulaire de profil.

## Réutilisation dans l'application

Le design system n'est pas limité à la showcase :

- la page de connexion utilise `Card`, `Button`, `TextInput`,
  `SegmentedControl` et `LanguageSelect` ;
- le dashboard utilise `Badge`, `Button`, `DropdownMenu`, `MetricTile`,
  `Tooltip`, `ThemeSwitch` et `LanguageSelect` ;
- le graphique utilise `Button`, `IconButton`, `SegmentedControl` et
  `Tooltip` ;
- les paramètres du profil utilisent `Modal`, `TextInput`, `Button`,
  `IconButton` et les notifications ;
- la recherche utilise les champs et boutons génériques ;
- l'administration réutilise `Button` et `SelectField` ;
- `UserAvatar` compose le composant générique `Avatar`.

Le fichier `components/ui/index.ts` permet aussi d'importer plusieurs primitives
depuis une seule entrée.

## Système d'icônes et assets

Le projet utilise plusieurs familles d'icônes :

- SVG officiels pour Google, GitHub et 42 School ;
- deux variantes bitmap du logo ClearTrend pour les thèmes clair et sombre ;
- petites icônes SVG internes pour le thème ;
- symboles CSS pour fermer, ajouter, retirer et ouvrir le menu mobile ;
- étoile de favori et pastille IA dans la watchlist.

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
- un contrôle segmente ;
- les boutons d'icônes ;
- les champs de formulaire ;
- les badges ;
- les cartes de metriques ;
- l'avatar ;
- le menu deroulant ;
- le tooltip ;
- une notification ;
- une modale ;
- le changement de thème.

Cette page n'est pas liée dans la navigation produit. Elle sert de catalogue
visuel et de support de vérification pendant le développement.

## Accessibilité intégrée

Les primitives fournissent plusieurs bases communes :

- vrais éléments `button`, `input`, `select`, `label`, `details` et `summary` ;
- `aria-label` obligatoire pour `IconButton` ;
- `aria-pressed` pour les états binaires ;
- `role="dialog"` et `aria-modal` pour `Modal` ;
- `role="status"` ou `role="alert"` pour `Toast` ;
- region `aria-live` pour les notifications ;
- tooltip visible au survol et au `focus-visible` ;
- classe `sr-only` pour les labels conservés uniquement pour les lecteurs
  d'écran.

Ces éléments améliorent la base sémantique, mais le module ne revendique pas à
lui seul une conformité WCAG 2.1 AA complète.

## Fichiers principaux

| Fichier | Rôle |
|---|---|
| `web/src/components/ui/` | Composants React réutilisables |
| `web/src/components/ui/ui.css` | Styles des primitives, formulaires, thèmes, sélecteurs et notifications |
| `web/src/components/ui/index.ts` | Point d'export groupe |
| `web/src/components/ui/cx.ts` | Assemblage simple des classes conditionnelles |
| `web/src/app/globals.css` | Tokens de couleurs, structure des pages et surcharges propres aux écrans |
| `web/src/app/ui-showcase/page.tsx` | Route de démonstration |
| `web/src/app/ui-showcase/UiShowcaseClient.tsx` | Catalogue interactif |
| `web/public/` | Logos et icônes OAuth |

## Vérification

### Vérification manuelle

1. Ouvrir `/ui-showcase`.
2. Controler chaque composant dans le thème clair.
3. Basculer vers le thème sombre.
4. Réduire la largeur de la fenêtre.
5. Tester les boutons, le select, le menu, le tooltip, le toast et la modale.
6. Parcourir les contrôles au clavier avec `Tab`.
7. Vérifier ensuite leur réutilisation sur `/login` et `/dashboard`.

### Vérification technique

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml \
  exec -T web npm run lint
```

ESLint analyse la qualité du code et signale certaines erreurs ou mauvaises
pratiques.

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml \
  exec -T web npx tsc --noEmit
```

TypeScript vérifie les types sans generer de fichier.

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml \
  exec -T web npm run build
```

Le build compile l'application Next.js comme pour la production et détecte les
erreurs qui empêcheraient son déploiement.

## Limites

- Il n'existe pas de tests visuels automatisés ou de snapshots des composants.
- Le système d'icônes n'utilise pas une bibliothèque unique : il combine assets,
  SVG internes, caractères et formes CSS.
- La typographie repose sur la pile sans-serif du système, sans famille de
  police de marque dédiée.

Ces limites concernent surtout l'industrialisation du design system. Les
tokens, les thèmes, le catalogue et plus de dix composants réutilisables sont
déjà utilisés par les écrans du produit.
