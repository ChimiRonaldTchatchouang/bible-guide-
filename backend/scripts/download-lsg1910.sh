#!/bin/sh
# Télécharge la Bible Louis Segond 1910 « à parallèles » (domaine public, format USFM)
# depuis https://github.com/BibleCorps/FRA-B-LSG1910-PD-UBS dans data/lsg1910.
set -e
DEST="$(dirname "$0")/../data/lsg1910"
if [ -d "$DEST/.git" ]; then
  echo "Mise à jour de $DEST…"
  git -C "$DEST" pull --ff-only
else
  mkdir -p "$(dirname "$DEST")"
  git clone --depth 1 https://github.com/BibleCorps/FRA-B-LSG1910-PD-UBS "$DEST"
fi
echo "✔ Texte prêt dans $DEST/p.sfm — lancez maintenant : npm run bible:import"
