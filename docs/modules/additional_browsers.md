# Module Additional Browsers

## Statut

- Type : module minor
- Valeur : 1 point
- Etat : implemente et valide manuellement
- Navigateurs : Chrome, Firefox et Microsoft Edge

Le sujet demande une compatibilite complete avec au moins deux navigateurs
additionnels, une interface coherente et la documentation des limites
specifiques.

Chrome sert de navigateur de reference. Firefox et Edge constituent les deux
navigateurs additionnels verifies pour ClearTrend.

## Perimetre verifie

Les parcours suivants ont ete controles sur les trois navigateurs :

1. ouverture de la page de connexion ;
2. inscription et connexion ;
3. affichage du dashboard ;
4. navigation et tri dans la watchlist ;
5. changement d'asset et de periode ;
6. affichage de la courbe et des bougies ;
7. ouverture et modification des parametres du profil ;
8. changement de theme ;
9. changement de langue ;
10. affichage responsive des vues principales.

Le resultat fonctionnel est identique : les controles restent utilisables, les
donnees sont chargees et les informations principales ne se chevauchent pas.

## Choix techniques favorisant la compatibilite

Le frontend repose principalement sur des standards Web largement supportes :

- React et Next.js pour le rendu ;
- HTML natif pour les boutons, champs, listes, details et formulaires ;
- Flexbox et CSS Grid pour les layouts ;
- variables CSS pour les couleurs et les themes ;
- SVG pour les graphiques financiers ;
- `fetch`, `URL`, `Intl`, cookies, `localStorage` et `sessionStorage` pour les
  fonctions navigateur ;
- media queries pour le responsive.

Le graphique n'utilise ni plugin navigateur ni rendu proprietaire. Les courbes,
axes et bougies sont des elements SVG standards, ce qui donne un comportement
proche entre Chromium et Firefox.

Les champs de date, listes deroulantes et controles de fichier restent des
elements natifs. Leur apparence peut varier legerement selon le navigateur, mais
leur fonction et leurs labels restent identiques.

## Elements specifiques aux navigateurs

Quelques styles sont volontairement progressifs :

- `::-webkit-scrollbar` personnalise la barre de la watchlist dans Chrome et
  Edge ;
- Firefox conserve sa barre native ou utilise `scrollbar-width` lorsqu'il est
  defini ;
- `::-webkit-details-marker` masque le marqueur natif dans les navigateurs
  Chromium, tandis que la regle standard `summary::marker` couvre Firefox ;
- `color-mix()`, `aspect-ratio`, `100svh` et `100dvh` supposent une version
  recente du navigateur.

Ces differences concernent la presentation fine. Elles ne bloquent pas les
actions utilisateur.

## Fichiers principalement concernes

| Fichier | Role |
|---|---|
| `web/src/app/globals.css` | Responsive, layouts et ajustements propres aux moteurs de rendu |
| `web/src/components/ui/ui.css` | Styles des composants generiques |
| `web/src/components/AssetChart.tsx` | Graphique SVG et adaptation mobile |
| `web/src/components/DashboardClient.tsx` | Structure et interactions du dashboard |
| `web/src/components/WatchlistNav.tsx` | Navigation, tri et zone scrollable |
| `web/src/components/ProfileSettingsDialog.tsx` | Formulaires, fichiers et interactions pointer |
| `web/src/components/ui/ThemeSwitch.tsx` | Theme systeme et persistance locale |
| `web/src/components/ui/LanguageSelect.tsx` | Cookie de langue et rafraichissement |

Le module concerne en pratique l'ensemble du frontend : une modification de
CSS, de formulaire ou d'interaction doit etre recontrolee sur les trois
navigateurs.

## Procedure de verification

1. Demarrer l'application avec `make dev`.
2. Ouvrir `http://localhost:3000` dans Chrome, Firefox et Edge.
3. Utiliser le meme compte de test dans chaque navigateur.
4. Executer les parcours du perimetre verifie.
5. Tester au minimum une largeur desktop et une largeur mobile.
6. Controler la console navigateur pendant le chargement du dashboard.
7. Verifier que les textes longs en francais et espagnol restent lisibles.

Pour l'environnement HTTPS local, le certificat est auto-signe. L'avertissement
de securite affiche par le navigateur est attendu et ne correspond pas a une
incompatibilite frontend.

## Limites

- Les versions exactes des navigateurs utilises lors des controles manuels ne
  sont pas enregistrees dans le depot.
- L'apparence des champs natifs, calendriers, selecteurs de fichiers et barres
  de defilement peut varier legerement.
- Les extensions, protections anti-tracking et politiques de cookies propres au
  poste utilisateur peuvent affecter OAuth ou le presse-papiers sans constituer
  une erreur de rendu ClearTrend.

Ces limites doivent etre prises en compte lors d'une evolution importante du
frontend. La compatibilite revendiquee par ce module concerne uniquement Chrome, Firefox
et Edge sur leurs versions desktop recentes.
