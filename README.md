# Générateur de porte-clés STL

Application web pour générer des porte-clés imprimables en 3D (STL), avec QR code et logo d'entreprise optionnels, contour, trou d'attache réglable et aperçu 3D en temps réel.

## Fonctionnalités

- Formes : rectangle arrondi, cercle, hexagone, étiquette (pilule)
- Trou d'attache réglable (diamètre, position)
- Contour (bourrelet) optionnel autour de la plaque
- QR code (texte/URL) en relief ou gravé, avec zone de silence et niveau de correction d'erreur
- Logo d'entreprise (image PNG/JPG/SVG) en relief ou gravé, converti automatiquement en pixels
- Aperçu 3D interactif en temps réel (rotation, zoom)
- Export STL (fichier unique) ou export multi-pièces (ZIP avec base + relief) pour l'impression multicolore

## Démarrage

Prérequis : [Node.js](https://nodejs.org/) 18+.

```bash
npm install
npm run dev
```

Puis ouvrir l'URL locale affichée (par défaut `http://localhost:5173`).

## Build de production

```bash
npm run build
```

Génère un dossier `dist/` statique, déployable sur n'importe quel hébergeur (GitHub Pages, Netlify, etc.). Un workflow GitHub Actions (`.github/workflows/deploy.yml`) est fourni pour publier automatiquement sur GitHub Pages à chaque push sur `main`.

## Notes techniques

- React + TypeScript + Vite
- Rendu 3D : three.js / @react-three/fiber / @react-three/drei
- Booléens (gravure) : three-bvh-csg
- QR code : qrcode-generator
- Tout se passe côté navigateur, aucun serveur ni compte requis.
