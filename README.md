# Naolib - Départs à proximité – Plugin TRMNL

Affiche en temps réel les prochains départs depuis l'arrêt Naolib (TAN) le plus proche de n'importe quel emplacement à Nantes.

## Aperçu

Un aperçu de ce plugin est disponible via [https://trmnl.com/recipes/256931/demo](https://trmnl.com/recipes/256931/demo)

## Fonctionnement

1. Un Cloudflare Worker (`worker.js`) sert de proxy : il détermine l'arrêt Naolib le plus proche de vos coordonnées, récupère ses prochains départs en temps réel depuis l'API SIRI de Nantes Métropole, puis renvoie les données combinées au format `merge_variables` de TRMNL.
2. TRMNL interroge l'URL du Worker avec vos coordonnées et affiche le tableau des départs via les templates Liquid du dossier `views/`.
3. L'affichage se rafraîchit toutes les minutes.

## Architecture

```text
TRMNL interroge → Cloudflare Worker?lat=...&lng=...
                   → arrêt le plus proche cherché dans stops.js (index GTFS embarqué)
                   → POST SIRI StopMonitoring (un sous-ensemble par quai de l'arrêt)
                   → renvoie { merge_variables: { stop, departures, refreshed_at } }
TRMNL affiche views/*.liquid avec {{ merge_variables.* }}
```

## Installation

### 1. Déployer le Cloudflare Worker

Vous avez besoin d'un [compte Cloudflare](https://dash.cloudflare.com/sign-up) (le plan gratuit suffit).

```bash
npm install -g wrangler
wrangler login
wrangler deploy
```

L'URL du Worker s'affichera après le déploiement (ex. `https://naolib-worker.votre-sous-domaine.workers.dev`).

> Si vous ne pouvez pas héberger le Worker vous-même, envoyez un email à `adverbe_upsilon2z@icloud.com` pour obtenir une URL de polling prête à l'emploi.

### 2. Trouver vos coordonnées

Utilisez n'importe quel outil cartographique (ex. Google Maps → clic droit → copier les coordonnées) pour obtenir la latitude et la longitude du lieu que vous souhaitez surveiller.

Le point et la virgule décimale sont tous les deux acceptés : `47.21661` comme `47,21661`. (L'ancienne API TAN imposait la virgule ; les configurations existantes continuent donc de fonctionner.)

### 3. Installer le plugin

Installer le plugin depuis le store communautaire TRMNL ([lien](https://trmnl.com/recipes/256931)), puis renseigner les paramètres :

- **Stratégie** : Polling
- **URL de polling** : L'URL de votre Worker avec les coordonnées, ex. :

  ```text
  https://naolib-worker.votre-sous-domaine.workers.dev/?lat=47,21661&lng=-1,556754
  ```

- **Intervalle de rafraîchissement** : 5 minutes (malheureusement on ne peut pas mettre moins)

### 4. Coller le template

Copiez le contenu de chaque fichier du dossier `views/` dans le champ correspondant de l'éditeur de plugin TRMNL :

- `views/full.liquid` → champ **Full**
- `views/half-horizontal.liquid` → champ **Half (Horizontal)**
- `views/half-vertical.liquid` → champ **Half (Vertical)**
- `views/quadrant.liquid` → champ **Quadrant**

## Affichage

- **Badge carré arrondi** = ligne de tramway
- **Badge en forme de pilule** = ligne de bus
- **Point plein** = données en temps réel
- **Point creux** = horaire théorique uniquement
- Temps d'attente affiché en minutes (ex. `5mn`, `proche`)

## Fichiers

| Fichier | Description |
| --- | --- |
| `worker.js` | Cloudflare Worker — cherche l'arrêt le plus proche et récupère les départs via SIRI |
| `stops.js` | Index des arrêts Naolib (nom, coordonnées, quais) généré depuis le GTFS |
| `build-stops.mjs` | Régénère `stops.js` depuis le GTFS publié par Nantes Métropole |
| `test.mjs` | Vérifications du Worker (`node test.mjs`) |
| `test-fixture.xml` | Réponse SIRI réelle utilisée par les tests |
| `wrangler.toml` | Configuration de déploiement du Worker |
| `views/full.liquid` | Template Liquid — vue plein écran |
| `views/half-horizontal.liquid` | Template Liquid — vue demi-écran horizontal |
| `views/half-vertical.liquid` | Template Liquid — vue demi-écran vertical |
| `views/quadrant.liquid` | Template Liquid — vue quart d'écran |
| `settings.yml` | Référence des paramètres du plugin (non synchronisé avec TRMNL) |

## API

L'ancienne API `open.tan.fr` a été supprimée. Le plugin utilise désormais les [services temps réel SIRI de Nantes Métropole](https://data.nantesmetropole.fr/explore/dataset/244400404_services_temps_reel_transports_commun_naolib_nantes_metropole_siri/information/). Aucune clé API n'est nécessaire.

- Départs : `POST https://api.okina.fr/gateway/sem/realtime/anshar/services` avec un corps XML `StopMonitoringRequest`

Deux limites de l'accès libre (sans clé) façonnent le Worker :

- **1 requête toutes les 30 secondes.** Tous les quais d'un arrêt sont donc demandés dans un seul POST. Gardez l'intervalle de rafraîchissement TRMNL bien au-dessus de 30 s.
- **SIRI uniquement, pas de SIRI Lite** (le JSON REST demande une clé authentifiée), et SIRI n'offre aucune recherche géographique.

C'est pourquoi les arrêts sont embarqués dans `stops.js`, généré depuis le [GTFS Naolib](https://data.nantesmetropole.fr/explore/dataset/244400404_transports_commun_naolib_nantes_metropole_gtfs/information/). Le GTFS étant renouvelé chaque mois, régénérez l'index quand des arrêts changent :

```bash
node build-stops.mjs
```

## Remerciements

Un grand merci à Nantes Métropole pour la mise à disposition des données ouvertes des transports Naolib.</p>

Merci aux équipes de [TRMNL](https://trmnl.com) pour la création de leurs appareils génials.

Merci également à Steve Karmeinsky ([@stevekennedyuk](https://github.com/stevekennedyuk)) pour son plugin sur le statut des transports de Londres ([trmnl-tfl-status](https://github.com/stevekennedyuk/trmnl-tfl-status)) qui m'a inspiré ce projet.</p>

Merci à Anthropic pour avoir conçu Claude Code, grâce à qui la création du Worker js fut une question de secondes.</p>

Enfin, merci à Mario du support TRMNL pour ses conseils et pour avoir fixé mon code juste avant la publication du plugin.
