import os
import random
import argparse
import time
import subprocess
import tempfile
from moviepy import VideoFileClip, AudioFileClip, concatenate_videoclips, ImageClip, CompositeAudioClip, concatenate_audioclips

try:
    from moviepy.audio.fx.volumex import volumex  # type: ignore
except ImportError:
    volumex = None  # si volumex indisponible, on n’appliquera pas de mix

def validate_video_file(video_path):
    """Verify a video file is readable before processing"""
    try:
        with VideoFileClip(video_path) as test_clip:
            if test_clip.duration <= 0:
                return False
        return True
    except Exception:
        return False

def create_random_clip(audio_path, video_list_path, output_path):
    """Create random video montage synchronized to audio"""
    try:
        start_time = time.time()
        print(f"Starting video creation with audio: {audio_path}")

        # Load audio, speed it up by 1.35× with ffmpeg et validate
        # Création d'un fichier temporaire pour audio accéléré
        tmp_audio = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
        tmp_audio.close()
        subprocess.run([
            'ffmpeg', '-y', '-i', audio_path,
            '-filter:a', 'atempo=1.35', tmp_audio.name
        ], check=True)
        audio = AudioFileClip(tmp_audio.name)
        audio_duration = audio.duration
        print(f"Audio duration: {audio_duration:.2f} seconds")

        # Read and validate video list
        with open(video_list_path, 'r') as f:
            raw_list = [line.strip() for line in f if line.strip()]

        # Résoudre chemins relatifs vers assets/video
        base_assets = os.path.normpath(os.path.join(os.path.dirname(__file__), '../../assets/video'))
        video_files = []
        for p in raw_list:
            if os.path.isabs(p):
                video_files.append(p)
            else:
                # Préfère assets/video
                candidate = os.path.join(base_assets, p)
                video_files.append(candidate if os.path.exists(candidate) else p)
        print(f"Found {len(video_files)} videos in list")

        # Filter valid videos
        valid_videos = [v for v in video_files if validate_video_file(v)]
        print(f"{len(valid_videos)} valid videos found")
        if not valid_videos:
            raise ValueError("No valid video files found")

        # Randomize video order
        random.shuffle(valid_videos)

        clips = []
        used_videos = set()
        current_duration = 0
        clip_count = 0

        # Process videos
        for video_file in valid_videos:
            if current_duration >= audio_duration:
                break

            if video_file in used_videos:
                continue

            try:
                clip = VideoFileClip(video_file)
                clip_duration = clip.duration
                remaining = audio_duration - current_duration

                # For the last clip, handle differently
                if current_duration + clip_duration >= audio_duration and remaining > 0:
                    # Take needed portion from beginning
                    subclip = clip.subclipped(0, remaining)
                    clips.append(subclip)
                    current_duration += remaining
                    print(f"Added final clip: {video_file} ({remaining:.2f}s)")
                else:
                    # Use full clip
                    clips.append(clip)
                    current_duration += clip_duration
                    print(f"Added clip: {video_file} ({clip_duration:.2f}s)")

                used_videos.add(video_file)
                clip_count += 1

            except Exception as e:
                print(f"Skipping {video_file} due to error: {str(e)}")
                continue

        # Handle insufficient duration
        if current_duration < audio_duration:
            print(f"Adding freeze frame to cover missing {audio_duration - current_duration:.2f}s")
            last_frame = clips[-1].get_frame(clips[-1].duration - 0.1)
            freeze = ImageClip(last_frame, duration=audio_duration - current_duration)
            clips.append(freeze)

        # Concatenate and export
        print(f"Concatenating {len(clips)} clips...")
        final = concatenate_videoclips(clips, method="compose")

        print("Adding audio track with background")
        # audio TTS
        tts_audio = audio
        # Chercher audio de fond
        bg_dir = os.path.normpath(os.path.join(os.path.dirname(__file__), '../../assets/audio'))
        bg_file = None
        if os.path.isdir(bg_dir):
            candidates = [f for f in os.listdir(bg_dir) if f.lower().endswith(('.mp3','.wav','.aac','.m4a','.ogg'))]
            if candidates:
                bg_file = os.path.join(bg_dir, random.choice(candidates))
        if bg_file:
            print(f"Using background audio: {os.path.basename(bg_file)}")
            bg_clip = AudioFileClip(bg_file)
            # Boucler et tronquer à la durée TTS
            loops = int(tts_audio.duration / bg_clip.duration) + 1
            bg_looped = concatenate_audioclips([bg_clip] * loops).subclipped(0, tts_audio.duration)
            # Ajuster le volume de fond
            if volumex:
                bg_looped = bg_looped.fx(volumex, 0.3)
            comp_audio = CompositeAudioClip([tts_audio, bg_looped])
            final = final.with_audio(comp_audio)
        else:
            final = final.with_audio(tts_audio)

        print("Rendering final video...")
        final.write_videofile(
            output_path,
            codec='libx264',
            audio_codec='aac',
            fps=24,
            threads=4,
            logger=None
        )

        total_time = time.time() - start_time
        print(f"Success! Created {output_path} in {total_time:.1f} seconds")

    except Exception as e:
        print(f"Fatal error: {str(e)}")
        raise
    finally:
        # Clean up resources
        if 'audio' in locals():
            audio.close()
        if 'final' in locals():
            final.close()
        if 'clips' in locals():
            for clip in clips:
                if hasattr(clip, 'close'):
                    clip.close()
        # Supprimer le fichier audio temporaire s'il existe
        try:
            if os.path.exists(tmp_audio.name):
                os.remove(tmp_audio.name)
        except Exception as e:
            print(f"Error removing temporary audio file: {e}")

if __name__ == "__main__":
    # Chemins par défaut
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.normpath(os.path.join(script_dir, '../data'))
    default_audio = os.path.normpath(os.path.join(script_dir, '../../output/audio/story_complet.wav'))
    default_video_list = os.path.normpath(os.path.join(data_dir, 'video_list.txt'))
    default_output = os.path.normpath(os.path.join(script_dir, '../../output/video/output.mp4'))
    parser = argparse.ArgumentParser(
        description="Créer un montage vidéo aléatoire synchronisé avec une piste audio"
    )
    parser.add_argument(
        "audio_file",
        nargs="?",
        default=default_audio,
        help="Fichier audio .wav"
    )
    parser.add_argument(
        "video_list",
        nargs="?",
        default=default_video_list,
        help="Fichier texte contenant la liste des vidéos"
    )
    parser.add_argument(
        "output_file",
        nargs="?",
        default=default_output,
        help="Fichier de sortie (ex: output.mp4)"
    )

    args = parser.parse_args()

    print(f"Using audio file: {args.audio_file}")
    print(f"Using video list: {args.video_list}")
    print(f"Output will be: {args.output_file}")

    create_random_clip(
        args.audio_file,
        args.video_list,
        args.output_file
    )
