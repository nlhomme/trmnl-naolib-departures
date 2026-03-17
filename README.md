# Naolib - Départs à proximité – Plugin TRMNL

Affiche en temps réel les prochains départs depuis l'arrêt Naolib (TAN) le plus proche de n'importe quel emplacement à Nantes.

## Aperçu

Un aperçu de ce plugin est disponible via [https://trmnl.com/recipes/256931/demo](https://trmnl.com/recipes/256931/demo)

## Fonctionnement

1. Un Cloudflare Worker (`worker.js`) sert de proxy : il récupère les arrêts à proximité et leurs horaires de départ en temps réel depuis l'API TAN, puis renvoie les données combinées au format `merge_variables` de TRMNL.
2. TRMNL interroge l'URL du Worker avec vos coordonnées et affiche le tableau des départs via les templates Liquid du dossier `views/`.
3. L'affichage se rafraîchit toutes les minutes.

## Architecture

```text
TRMNL interroge → Cloudflare Worker?lat=...&lng=...
                   → TAN /arrets.json (arrêts à proximité)
                   → TAN /tempsattente.json (départs)
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

L'API TAN utilise une **virgule** comme séparateur décimal (format français). Remplacez les points par des virgules :

| Format standard | Format API TAN |
| --- | --- |
| `47.21661` | `47,21661` |
| `-1.556754` | `-1,556754` |

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
| `worker.js` | Cloudflare Worker — récupère les arrêts et départs depuis l'API TAN |
| `wrangler.toml` | Configuration de déploiement du Worker |
| `views/full.liquid` | Template Liquid — vue plein écran |
| `views/half-horizontal.liquid` | Template Liquid — vue demi-écran horizontal |
| `views/half-vertical.liquid` | Template Liquid — vue demi-écran vertical |
| `views/quadrant.liquid` | Template Liquid — vue quart d'écran |
| `settings.yml` | Référence des paramètres du plugin (non synchronisé avec TRMNL) |

## API

Ce plugin utilise l'[API open data TAN](https://open.tan.fr/ewp/). Aucune clé API n'est nécessaire.

- Arrêts à proximité : `https://open.tan.fr/ewp/arrets.json/{lat}/{lng}`
- Prochains départs : `https://open.tan.fr/ewp/tempsattente.json/{codeLieu}`

## Remerciements

Un grand merci à Nantes Métropole pour la mise à disposition des données ouvertes des transports Naolib.</p>

Merci aux équipes de [TRMNL](https://trmnl.com) pour la création de leurs appareils génials.

Merci également à Steve Karmeinsky ([@stevekennedyuk](https://github.com/stevekennedyuk)) pour son plugin sur le statut des transports de Londres ([trmnl-tfl-status](https://github.com/stevekennedyuk/trmnl-tfl-status)) qui m'a inspiré ce projet.</p>

Merci à Anthropic pour avoir conçu Claude Code, grâce à qui la création du Worker js fut une question de secondes.</p>

Enfin, merci à Mario du support TRMNL pour ses conseils et pour avoir fixé mon code juste avant la publication du plugin.

## License

[MIT](LICENSE)
