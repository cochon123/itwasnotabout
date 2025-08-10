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

    # Étape 0 : Génération de l'histoire
    print("=== Étape 0: Génération de l'histoire ===")
    gen_script = os.path.join(script_dir, 'generate_story.py')
    input_sample = os.path.join(data_dir, 'sample.md')
    generated_md = os.path.join(data_dir, 'generated_story.md')
    subprocess.run(['python', gen_script, input_sample, generated_md, '--model', 'gemini-2.5-flash'], check=True)

    # Étape 1 : Synthèse vocale
    print("=== Étape 1: Synthèse vocale (TTS) ===")
    tts_script = os.path.join(script_dir, 'texttospeech.py')
    sample_md = generated_md  # Utiliser l'histoire générée
    output_audio = os.path.join(audio_dir, 'story_complet.wav')
    # Utiliser Higgs par défaut; basculer sur OpenAI via variable d'env IWNA_TTS_BACKEND
    tts_backend = os.getenv('IWNA_TTS_BACKEND', 'higgs')
    subprocess.run(['python', tts_script, sample_md, output_audio, '--backend', tts_backend], check=True)

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
