 # It Was Not About
 Générateur de YouTube Shorts basé sur l'intelligence artificielle

 ## Structure du projet
 ```
 It_was_not_about/
 ├── backend/                # Code Python et scripts de génération
 │   ├── scripts/            # Scripts de génération (montage, TTS, sous-titres...)
 │   ├── data/               # Fichiers de données (sample.md, listes de vidéos...)
 │   ├── libs/               # Bibliothèques ou modules locaux (ex: higgs-audio)
 │   ├── tests/              # Tests unitaires
 │   └── requirements.txt    # Dépendances Python
 ├── frontend/               # Application web (HTML, JS, CSS, Tailwind)
 ├── assets/                 # Ressources statiques
 │   ├── audio/              # Sons ambiants, TTS
 │   ├── video/              # Clips vidéos pour le montage
 │   └── fonts/              # Polices (impact.ttf)
 ├── output/                 # Fichiers générés
 │   ├── audio/              # Fichiers audio finaux
 │   └── video/              # Vidéos rendues (avec sous-titres)
 ├── docs/                   # Documentation et ressources (figures, blogs)
 ├── IWNAenv/                # environement python
 ├── .gitignore
 └── .env
 ```

 ## Backend (Python)
 1. Génération d'histoires à partir de `backend/data/sample.md` via l'API Google Gemini (`gemini-2.5-flash`).
 2. Synthèse vocale TTS via OpenAI (`gpt-4o-mini-tts`) et concaténation en un seul WAV.
 3. Montage vidéo : sélection et découpe de clips de `assets/video` pour correspondre à la durée audio.
 4. Ajout des sous-titres dynamiques avec Whisper Timestamped.

 ## Frontend (Web)
 Interface en temps réel pour suivre chaque étape de la génération :
 - Bouton 3D interactif
 - Affichage de l'étape et de son statut
 - Aperçu des médias générés (audio et vidéo)
 - Journal de type terminal

 ## Installation et exécution
 1. Cloner le projet et accéder au dossier :
     ```bash
     git clone <repo_url> && cd It_was_not_about
     ```
 2. Créer et renseigner vos clés d'API :
     - Copier `.env.example` en `.env` et remplir `GOOGLE_API_KEY`/`GEMINI_API_KEY` et `OPENAI_API_KEY`.
 3. Installer les dépendances Python (Python 3.10+ recommandé) :
     ```bash
     pip install -r backend/requirements.txt
     ```
 4. Vérifier les assets vidéo dans `assets/video` et la police `assets/fonts/impact.ttf`.
 5. Exécuter le pipeline de génération :
     ```bash
     python backend/scripts/run_pipeline.py
     ```
 6. (Optionnel) Démarrer le frontend :
     ```bash
     cd frontend
     npm install && npm run dev
     ```
le temps des vidéos ensemble est égale au temps du fichier audio
    
    on cobine toutes les vidéos ensembles
    on ajoute le son de généré avec kororo
    on sélectionne un son ambiant au hasard parmi ceux disponible dans le dossier background
    on l'ajoute a la vidéo
    on render la vidéo

4 ajouter les sous titres
    on utilise Whisper (whisper_timestamped) pour ajouter des sous titres à la vidéo.



frontend (html, js, css, tailwind)

le but est de voir en temps réel tout ce qui se passe dans le backend
    a la page d'acceuil, il y'a un gros bouton en 3D. une sorte d'orbe avec des couleurs en gradiant et des particules a l'intérieur qui intérragissent au passage de la souris
    a l'intérieur de l'orbe un bouton imprimer de l'argent (emoji liasse de billet)
    quand on clique sur le bouton une animation fait tourbilloner la balle et la fait passer sur le coté gauche.
    en haut a droite il y'a le nom de l'étape en cours.
    plus bas il y'a les étapes qui s'affiche comme ca 0-0-0-0-0 (les 0 etant juste des petits cercles)
    si l'étape est terminé, le cercle sera vert
    encore d'exécution bleu qui clignote
    pas encore fait gris. 
    si il y'a une erreur rouje avec l'erreur affiché en rouje
    un peu plus bas, vers le centre, on affichera les médias
    ce sera un div dans le quel on pourra scroller
    a chaque média créer (petit audio .wav, quand une vidéo est sélectionner)
    en bas a droite il y'aura une simulation de ce qui se passe dans le terminale.

    une fois la vidéo générer on l'affichera après une animation qui fera monter toute la page vers le haut.
    mais on pourra toujours scroller vers pour voir l'historique
    il y'aura un boutton pour la télécharger.

    il y'aura un bouton parametre qui nous permettra de changer les clé d'API.