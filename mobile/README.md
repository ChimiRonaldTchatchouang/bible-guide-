# Guide du chrétien — application mobile

Application Expo (SDK 57, Expo Router) : lecture du jour, thèmes de vie, passages avec histoire
contextuelle, enseignement et passages parallèles (Louis Segond 1910), favoris. Fonctionne **hors ligne** :
le contenu est embarqué dans `src/data/content.json`.

## Lancer en développement

```bash
cd mobile
npm install
npx expo start          # scanner le QR code avec Expo Go
```

## Obtenir l'APK installable (expo.dev)

### Premier build — une seule fois, depuis votre ordinateur

```bash
git clone https://github.com/ChimiRonaldTchatchouang/bible-guide-.git
cd bible-guide-/mobile
npm install
npx eas-cli@latest login                                  # compte expo.dev
npx eas-cli@latest build -p android --profile preview
```

Répondez **Oui** quand EAS propose de créer le projet et de générer la clé de signature Android (keystore).
À la fin (10 à 20 min), EAS affiche un lien et un QR code : ouvrez-le sur le téléphone pour installer l'APK.

Puis enregistrez l'identifiant du projet ajouté dans `app.json` :

```bash
git add app.json && git commit -m "Lien du projet expo.dev" && git push
```

### Builds suivants — automatiques

1. Sur expo.dev : **Account settings → Access tokens → Create token**.
2. Sur GitHub : **Settings → Secrets and variables → Actions → New repository secret**,
   nom `EXPO_TOKEN`, valeur = le jeton.

Ensuite, chaque push sur `main` qui touche `mobile/` relance un build APK (onglet *Actions*, ou
bouton *Run workflow*). Les APK apparaissent sur expo.dev, rubrique *Builds* du projet.

## Mettre à jour le contenu

Le contenu vient du backend (`backend/`). Après avoir ajouté ou modifié des groupes :

```bash
cd backend && npm run export:mobile    # régénère mobile/src/data/content.json
```

## Visuels

`npm run assets` régénère l'icône, les icônes adaptatives Android et l'écran de démarrage
(`scripts/generate-assets.py`, nécessite Python + Pillow).
