# Le Grand Tournoi du Cube

Un site pour apprendre à Camille à résoudre le Rubik's Cube **avec des histoires**, sans formules (pas de `R U R' U'`).

## L'univers
- Le cube est un **stade**, chaque couleur est une **équipe d'animaux** :
  Lions (jaune), Ours polaires (blanc), Grenouilles (vert), Dauphins (bleu), Tigres (orange), Renards (rouge).
- Les centres sont les **capitaines** (ils ne bougent jamais), les arêtes sont les **duos**, les coins sont les **trios**.
- **Coach Panda** 🐼 raconte les histoires. Chaque entraînement réussi rapporte une médaille.

## Les entraînements
| # | Nom | Étape de la méthode débutant |
|---|-----|------------------------------|
| 0 | Bienvenue au stade | Découvrir le cube et les gestes |
| 1 | L'échauffement | La pâquerette |
| 2 | Le grand plongeon | La croix blanche |
| 3 | L'ascenseur des trios | Les coins blancs (« Monte, ouvre, descend, ferme ») |
| 4 | Les visiteurs du 2e étage | La 2e couronne (« S'éloigne, ascenseur, on le suit, ascenseur ») |
| 5 | Le cri du Lion | La croix jaune (« Porte, ascenseur, porte retour ») |
| 6 | La ronde des Lions | Les bords jaunes (« Monte, glisse, descend, glisse, monte, glisse-glisse, descend ») |
| 7 | La grande finale | Placer les coins jaunes (« ping-pong ») puis les tourner (cube retourné + ascenseur) |

## Mon cube (photos)
Page « Mon cube » : 6 photos (une par face) → le site lit les couleurs (`js/photo.js`), on corrige au doigt si besoin,
puis `js/solver.js` calcule la solution **avec les gestes des entraînements** (pâquerette, plongeons, ascenseurs…)
et le coach guide Camille geste par geste sur **son** cube. Rien ne quitte la tablette.

Le cube photographié est ensuite **suivi geste par geste** (photos + liste des gestes faits depuis, gardés sur la tablette) :
- Le dernier écran « À toi de jouer » de chaque entraînement montre **son** cube, tenu comme dans ses mains.
  Elle fait chaque geste sur le vrai cube et appuie sur le même bouton ; le site vérifie le but de l'étape.
- 💡 *Aide du coach* : le prochain geste raconté, calculé sur son cube (`Solver.hint`).
- Cube pas encore prêt pour l'étape : le coach l'aide d'abord à finir l'étape d'avant.
- Étape déjà faite : « Mélange juste ce qu'il faut » (`Solver.practice`) ramène le cube au début de l'étape.
- Si le vrai cube ne ressemble plus à l'écran : « 📸 Mon vrai cube est différent » → nouvelles photos.
Les réglages de chaque exercice (boutons, but) sont dans `MINE`, à la fin de `js/content.js`.

## La voix du coach
Le site joue des phrases enregistrées (`audio/*.mp3` + `audio/manifest.json`). S'il en manque une, il utilise la plus belle
voix française de l'iPad (télécharger « Audrey Premium » dans Réglages › Accessibilité › Contenu énoncé › Voix).

Enregistrer toutes les phrases avec une voix IA (à relancer après chaque modification des textes : seules les nouvelles
phrases sont enregistrées) :
```bash
OPENAI_API_KEY=sk-... node tools/generate-voice.js
```
Options : `--dry-run` (compter sans rien envoyer), `--force` (tout réenregistrer, par exemple après un changement de voix),
`--provider=elevenlabs` (avec `ELEVENLABS_API_KEY` et `ELEVENLABS_VOICE_ID`), `OPENAI_VOICE=cedar` (la voix par défaut est `marin`).
Le manifeste ajoute la voix à l'adresse de chaque fichier (`…mp3?v=marin`) : après un changement de voix, l'iPad ne rejoue pas l'ancienne.

## Modifier les histoires
Tout le texte est dans [`js/content.js`](js/content.js). Chaque écran a un `title`, un `text` et une `scene`
(ce que montre le cube 3D). Les gestes du coach (« La droite monte »…) sont dans `SAY`, au même endroit.

## Lancer le site
```bash
python3 -m http.server 8765
```
puis ouvrir http://localhost:8765

## Mettre en ligne sur un serveur (et l'installer comme une app sur l'iPad)
Le site est un simple dossier de fichiers statiques : pas de base de données ni de programme à faire tourner.

1. Sur le serveur : `git clone https://github.com/fyrex-FR/rubiks.git /var/www/rubiks`
2. Le servir **en HTTPS** (obligatoire pour l'installation et le mode hors ligne). Exemple nginx :
   ```nginx
   server {
     server_name cube.mon-domaine.fr;
     root /var/www/rubiks;
     index index.html;
     # toujours vérifier la dernière version de ces deux fichiers
     location = /sw.js { add_header Cache-Control "no-cache"; }
     location = /audio/manifest.json { add_header Cache-Control "no-cache"; }
     # les outils et le dépôt git n'ont rien à faire en ligne
     location ~ ^/(tools|dist|\.git)/ { deny all; }
   }
   ```
   (+ le certificat, par exemple avec `certbot --nginx`). Si `manifest.webmanifest` n'est pas servi en
   `application/manifest+json`, ajouter `application/manifest+json webmanifest;` dans `mime.types`.
3. Sur l'iPad : ouvrir l'adresse dans **Safari** › Partager › **« Sur l'écran d'accueil »**.
   L'app s'ouvre en plein écran, avec son icône. Après la 1re ouverture avec Internet, le site et toutes les voix
   (~37 Mo) sont gardés sur l'iPad : **ça marche hors ligne**. « Pour les parents », en bas de l'accueil, indique
   combien de voix sont déjà gardées.
4. Mettre à jour : `git pull` sur le serveur. L'app prend la nouvelle version toute seule la prochaine fois
   que l'iPad a Internet (le site est toujours redemandé en ligne d'abord, la copie gardée ne sert que hors ligne).

⚠️ Sur iPad, l'app installée a sa propre mémoire : les médailles et le cube photographié dans Safari
ne passent pas dans l'app (et inversement).

## Publier sur claude.ai
`node tools/build-artifact.js` fabrique `dist/artifact.html` (tout en un seul fichier).

## Fichiers
- `js/cube.js` : la logique du cube (positions, rotations), sans 3D
- `js/cube3d.js` : l'affichage 3D (Three.js), les animations et les flèches
- `js/content.js` : les histoires
- `js/app.js` : les pages, le lecteur de démos, le quiz, les médailles, « Mon cube »
- `js/solver.js` : résout n'importe quel cube avec la méthode des histoires
- `js/photo.js` : lecture des couleurs sur les photos
- `js/speech.js`, `js/voice.js` : la voix (fichiers enregistrés, sinon voix de la tablette)
- `tools/generate-voice.js` : enregistre les phrases avec une voix IA
- `tools/speech-texts.js` : la liste de toutes les phrases du coach (pour les enregistrer)
- `tools/make-icons.py` : fabrique les icônes de l'app (`icons/`)
- `manifest.webmanifest`, `sw.js` : l'app pour l'écran d'accueil et le mode hors ligne
- `audio/` : les voix enregistrées (`manifest.json` = phrase → fichier, `voices.json` = quelle voix a enregistré quoi)
