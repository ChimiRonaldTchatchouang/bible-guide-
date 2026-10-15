# Guide du chrétien

Application mobile de lecture biblique par thèmes de vie (pardon, mariage, foi, entrepreneuriat, protection…),
basée sur la Bible Louis Segond 1910 à parallèles.

## Backend (`backend/`)

Node.js · Express · TypeScript · PostgreSQL · Drizzle ORM

```bash
cd backend
cp .env.example .env          # puis adapter DATABASE_URL et les secrets JWT
npm install
npm run db:migrate            # crée les tables et la liste des 66 livres
npm run bible:download        # récupère la Segond 1910 (domaine public, USFM)
npm run bible:import          # importe versets, sections et passages parallèles
npm run seed                  # thèmes de vie + premiers groupes publiés + plan annuel
npm run admin:create -- --email vous@exemple.com --password "********"
npm run dev                   # API sur http://localhost:4000/api/v1
```

Autres scripts : `npm run plan:generate` (répartir les groupes sur 365 jours),
`npm run export:mobile` (mettre à jour le contenu hors ligne de l'app).

## Application mobile (`mobile/`)

Expo SDK 57 · Expo Router · écran de démarrage · fonctionne hors ligne.
Lecture du jour, thèmes de vie, fiche passage (contexte, texte, enseignement, parallèles), favoris.

Installation de l'APK via expo.dev : voir [mobile/README.md](mobile/README.md).
