# Arena Evolution

Jeu d'arène multijoueur (PvP + PvE) en Node.js + WebSocket + Canvas.

    npm install
    npm start   # http://localhost:3000

Sauvegardes : data/saves.json (sur Render, disque éphémère sans disque persistant).

## Base de données
Définissez `DATABASE_URL` (Postgres, ex. Neon) pour persister les comptes. Sans elle, `data/saves.json` est utilisé.
