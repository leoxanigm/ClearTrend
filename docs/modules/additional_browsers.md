# Module Additional Browsers

## Statut

- Type : module minor
- Valeur : 1 point
- État : implémenté et validé manuellement
- Navigateurs : Chrome, Firefox et Microsoft Edge

Le sujet demande une compatibilité complète avec au moins deux navigateurs
additionnels, une interface cohérente et la documentation des limites
spécifiques.

Chrome sert de navigateur de référence. Firefox et Edge constituent les deux
navigateurs additionnels vérifiés pour ClearTrend.

## Périmètre vérifié

Les parcours suivants ont été contrôlés sur les trois navigateurs :

1. ouverture de la page de connexion ;
2. inscription et connexion ;
3. affichage du dashboard ;
4. navigation et tri dans la watchlist ;
5. changement d'asset et de période ;
6. affichage de la courbe et des bougies ;
7. ouverture et modification des paramètres du profil ;
8. changement de thème ;
9. changement de langue ;
10. affichage responsive des vues principales.

Le résultat fonctionnel est identique : les contrôles restent utilisables, les
données sont chargées et les informations principales ne se chevauchent pas.

## Choix techniques favorisant la compatibilité

Le frontend repose principalement sur des standards Web largement supportés :

- React et Next.js pour le rendu ;
- HTML natif pour les boutons, champs, listes, détails et formulaires ;
- Flexbox et CSS Grid pour les layouts ;
- variables CSS pour les couleurs et les thèmes ;
- SVG pour les graphiques financiers ;
- `fetch`, `URL`, `Intl`, cookies, `localStorage` et `sessionStorage` pour les
  fonctions navigateur ;
- media queries pour le responsive.

Le graphique n'utilise ni plugin navigateur ni rendu propriétaire. Les courbes,
axes et bougies sont des éléments SVG standards, ce qui donne un comportement
proche entre Chromium et Firefox.

Les champs de date, listes déroulantes et contrôles de fichier restent des
éléments natifs. Leur apparence peut varier légèrement selon le navigateur, mais
leur fonction et leurs labels restent identiques.

## Éléments spécifiques aux navigateurs

Quelques styles sont volontairement progressifs :

- `::-webkit-scrollbar` personnalise la barre de la watchlist dans Chrome et
  Edge ;
- Firefox conserve sa barre native ou utilise `scrollbar-width` lorsqu'il est
  défini ;
- `::-webkit-details-marker` masque le marqueur natif dans les navigateurs
  Chromium, tandis que la règle standard `summary::marker` couvre Firefox ;
- `color-mix()`, `aspect-ratio`, `100svh` et `100dvh` supposent une version
  récente du navigateur.

Ces différences concernent la présentation fine. Elles ne bloquent pas les
actions utilisateur.

## Fichiers principalement concernés

| Fichier | Rôle |
|---|---|
| `web/src/app/globals.css` | Responsive, layouts et ajustements propres aux moteurs de rendu |
| `web/src/components/ui/ui.css` | Styles des composants génériques |
| `web/src/components/AssetChart.tsx` | Graphique SVG et adaptation mobile |
| `web/src/components/DashboardClient.tsx` | Structure et interactions du dashboard |
| `web/src/components/WatchlistNav.tsx` | Navigation, tri et zone scrollable |
| `web/src/components/ProfileSettingsDialog.tsx` | Formulaires, fichiers et interactions pointer |
| `web/src/components/ui/ThemeSwitch.tsx` | Thème système et persistance locale |
| `web/src/components/ui/LanguageSelect.tsx` | Cookie de langue et rafraîchissement |

Le module concerne en pratique l'ensemble du frontend : une modification de
CSS, de formulaire ou d'interaction doit être recontrôlée sur les trois
navigateurs.

## Procédure de vérification

1. Démarrer l'application avec `make dev`.
2. Ouvrir `http://localhost:3000` dans Chrome, Firefox et Edge.
3. Utiliser le même compte de test dans chaque navigateur.
4. Exécuter les parcours du périmètre vérifié.
5. Tester au minimum une largeur desktop et une largeur mobile.
6. Contrôler la console navigateur pendant le chargement du dashboard.
7. Vérifier que les textes longs en français et espagnol restent lisibles.

Pour l'environnement HTTPS local, le certificat est auto-signé. L'avertissement
de sécurité affiché par le navigateur est attendu et ne correspond pas à une
incompatibilité frontend.

## Limites

- Les versions exactes des navigateurs utilisés lors des contrôles manuels ne
  sont pas enregistrées dans le dépôt.
- L'apparence des champs natifs, calendriers, sélecteurs de fichiers et barres
  de défilement peut varier légèrement.
- Les extensions, protections anti-tracking et politiques de cookies propres au
  poste utilisateur peuvent affecter OAuth ou le presse-papiers sans constituer
  une erreur de rendu ClearTrend.

Ces limites doivent être prises en compte lors d'une évolution importante du
frontend. La compatibilité revendiquée par ce module concerne uniquement Chrome, Firefox
et Edge sur leurs versions desktop récentes.
