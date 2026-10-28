# R1-BOY 3000

Multitool rétro à phosphore vert pour le **Rabbit R1**, façon terminal de poignet post-apo.
Web app ("creation" R1) en Vanilla JS + Vite, écran 240×282.

## Onglets

| Onglet | Sous-onglets |
|---|---|
| **STAT** | STATUT (mascotte, niveau, pas, batterie) · QUÊTES (to-do avec XP) · PERKS (succès) |
| **INV** | OUTILS (lampe torche, minuteur) · CAPTEURS (boussole, niveau à bulle, compteur Geiger) |
| **DATA** | MÉTÉO (Open-Meteo, UV = « RAD ») · CONFIG (couleur, sons, podomètre, IPTV, radio perso) |
| **MAP** | CARTE LOCALE (OSM teintée phosphore, lieux découverts = XP) |
| **RADIO** | STATIONS (radio-browser.info + oscilloscope) · TV (IPTV M3U / HLS) |

## Commandes

| R1 | PC (dev) | Action |
|---|---|---|
| Molette | ↑ ↓ / molette souris | Naviguer dans la liste |
| Clic bouton latéral | Entrée | Valider |
| Appui long | Échap | Retour / mode onglets (la molette change d'onglet) |
| Écran tactile | Souris | Onglets, sous-onglets et lignes cliquables |

## Développement

```bash
npm install
npm run dev      # http://localhost:5173 (écran affiché en x2 sur PC)
npm run build    # sortie dans dist/
```

## Installer sur le R1

1. Héberger `dist/` en **https** (GitHub Pages via `.github/workflows/deploy.yml`, Netlify, etc.).
2. Générer le QR : `npm run qr -- https://votre-site/r1-boy/` → `install-qr.png`.
3. Scanner le QR avec le R1 pour ajouter la creation.

## Notes

- Seuls les flux **https** sont utilisables (radio et TV), la page étant servie en https.
- L'oscilloscope affiche le vrai signal quand la station autorise CORS, sinon une onde simulée.
- La playlist IPTV par défaut est la liste publique iptv-org (chaînes françaises en libre accès) ; modifiable dans DATA › CONFIG.
- Style original inspiré des terminaux rétro-futuristes ; aucun logo ni asset de licence n'est utilisé.
