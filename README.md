# Naolib - Départs à proximité – Plugin TRMNL

Affiche en temps réel les prochains départs depuis l'arrêt Naolib (TAN) le plus proche de n'importe quel emplacement à Nantes.

## Aperçu

Un aperçu de ce plugin est disponible via [https://trmnl.com/recipes/256931/demo](https://trmnl.com/recipes/256931/demo)

## Fonctionnement

1. Un Cloudflare Worker (`worker.js`) sert de proxy : il détermine l'arrêt Naolib le plus proche de vos coordonnées, récupère ses prochains départs en temps réel depuis l'API SIRI de Nantes Métropole, puis renvoie les données combinées au format `merge_variables` de TRMNL.
2. TRMNL interroge l'URL du Worker avec vos coordonnées et affiche le tableau des départs via les templates Liquid du dossier `views/`.
3. L'affichage se rafraîchit selon l'intervalle configuré dans TRMNL (5 minutes au minimum).

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

> ⚠️ **Important :** Vérifiez qu'aucun **Cron Trigger** n'est configuré sur le Worker. Dans le tableau de bord Cloudflare → Workers & Pages → `naolib-worker` → Settings → Triggers, supprimez tout déclencheur cron s'il y en a. Ce Worker ne répond qu'aux requêtes HTTP (polling TRMNL) et ne possède pas de fonction `scheduled()` — un cron actif provoquerait des erreurs.

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
| `.github/workflows/refresh-stops.yml` | Régénère et redéploie l'index des arrêts chaque semaine |
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

C'est pourquoi les arrêts sont embarqués dans `stops.js`, généré depuis le [GTFS Naolib](https://data.nantesmetropole.fr/explore/dataset/244400404_transports_commun_naolib_nantes_metropole_gtfs/information/).

### Maintenir l'index à jour

Le GTFS est réédité environ une fois par mois. Quand l'identifiant d'un quai change, SIRI renvoie une réponse vide plutôt qu'une erreur : un index périmé affiche donc « aucun départ », ce qui est indiscernable d'un arrêt calme à 2 h du matin.

`.github/workflows/refresh-stops.yml` régénère l'index chaque lundi et, **uniquement si `stops.js` a changé**, lance les tests, committe et redéploie. Une régénération sans changement amont est identique au bit près : les semaines calmes ne produisent donc ni commit ni déploiement.

Deux garde-fous, le job tournant sans surveillance :

- `build-stops.mjs` refuse d'écrire un index de moins de 900 arrêts (1044 aujourd'hui) : un téléchargement tronqué ne peut pas écraser un index valide.
- `node test.mjs` doit passer avant le déploiement.

Pour que le job fonctionne :

- il doit se trouver sur la **branche par défaut** (GitHub n'exécute les déclencheurs `schedule` que depuis celle-ci) ;
- le secret **`CLOUDFLARE_API_TOKEN`** doit être défini dans Settings → Secrets and variables → Actions (l'authentification OAuth locale de wrangler n'existe pas en CI). Créez-le avec le modèle *Edit Cloudflare Workers*.

`workflow_dispatch` permet de déclencher un run manuellement. En local :

```bash
node build-stops.mjs && git diff --stat stops.js
```

## Remerciements

Un grand merci à Nantes Métropole pour la mise à disposition des données ouvertes des transports Naolib.</p>

Merci aux équipes de [TRMNL](https://trmnl.com) pour la création de leurs appareils génials.

Merci également à Steve Karmeinsky ([@stevekennedyuk](https://github.com/stevekennedyuk)) pour son plugin sur le statut des transports de Londres ([trmnl-tfl-status](https://github.com/stevekennedyuk/trmnl-tfl-status)) qui m'a inspiré ce projet.</p>

Merci à Anthropic pour avoir conçu Claude Code, grâce à qui la création du Worker js fut une question de secondes.</p>

Enfin, merci à Mario du support TRMNL pour ses conseils et pour avoir fixé mon code juste avant la publication du plugin.
