#!/usr/bin/env python3
"""
Script pipeline orchestrant les étapes : TTS, montage vidéo et ajout de sous-titres.
"""
import os
import subprocess

def main():
    # Définir les chemins du projet
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.normpath(os.path.join(script_dir, '..', '..'))
    data_dir = os.path.join(project_root, 'backend', 'data')
    audio_dir = os.path.join(project_root, 'output', 'audio')
    video_dir = os.path.join(project_root, 'output', 'video')

    # Créer les répertoires de sortie si besoin
    os.makedirs(audio_dir, exist_ok=True)
    os.makedirs(video_dir, exist_ok=True)

    # Étape 0 : Récupération des histoires depuis Reddit
    print("=== Étape 0: Récupération des histoires depuis Reddit ===")
    reddit_script = os.path.join(script_dir, 'fetch_reddit_stories.py')
    reddit_stories_md = os.path.join(data_dir, 'reddit_stories.md')
    # Try to fetch stories from Reddit, but continue with sample stories if it fails
    try:
        # Fetch 1 story from r/stories
        subprocess.run(['python', reddit_script, reddit_stories_md, '--limit', '1'], check=True)
        generated_md = reddit_stories_md
    except subprocess.CalledProcessError as e:
        print(f"Warning: Could not fetch stories from Reddit. Using sample stories instead. Error: {e}")
        generated_md = os.path.join(data_dir, 'sample.md')

    # Étape 1 : Synthèse vocale
    print("=== Étape 1: Synthèse vocale (TTS) ===")
    tts_script = os.path.join(script_dir, 'texttospeech_vibevoice.py')
    sample_md = generated_md  # Utiliser l'histoire générée
    output_audio = os.path.join(audio_dir, 'story_complet.wav')
    subprocess.run(['python', tts_script, sample_md, output_audio, '--speaker', 'Alice'], check=True)

    # Étape 2 : Montage vidéo
    print("=== Étape 2: Montage vidéo ===")
    montage_script = os.path.join(script_dir, 'montage.py')
    video_list = os.path.join(data_dir, 'video_list.txt')
    # Si la liste de vidéos n'existe pas, l'initialiser à partir de assets/video
    if not os.path.exists(video_list) or os.path.getsize(video_list) == 0:
        assets_videos_dir = os.path.join(project_root, 'assets', 'video')
        files = [f for f in os.listdir(assets_videos_dir) if f.lower().endswith(('.mp4', '.mov', '.mkv'))]
        files.sort()
        with open(video_list, 'w', encoding='utf-8') as vf:
            for f in files:
                vf.write(f+"\n")
    input_audio = output_audio
    output_video = os.path.join(video_dir, 'output.mp4')
    subprocess.run(['python', montage_script, input_audio, video_list, output_video], check=True)

    # Étape 3 : Ajout des sous-titres
    print("=== Étape 3: Ajout des sous-titres ===")
    caption_script = os.path.join(script_dir, 'add_caption.py')
    output_captioned = os.path.join(video_dir, 'output_captioned.mp4')
    subprocess.run(['python', caption_script, output_video, output_captioned], check=True)

    print("Pipeline terminé ! Fichiers disponibles dans output/")

if __name__ == '__main__':
    main()
