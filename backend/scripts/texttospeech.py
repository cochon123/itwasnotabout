#!/usr/bin/env python3
"""
Synthèse vocale TTS avec Higgs Audio v2. Lit un fichier markdown/texte et génère un WAV unique.
"""
import argparse
import os
import sys
# Ajouter le package local higgs-audio au chemin si nécessaire
base_dir = os.path.normpath(os.path.join(os.path.dirname(__file__), '..'))
higgs_lib = os.path.join(base_dir, 'libs', 'higgs-audio')
if os.path.isdir(higgs_lib) and higgs_lib not in sys.path:
	sys.path.insert(0, higgs_lib)
import tempfile
import shutil
import re
from moviepy import AudioFileClip
from tqdm import tqdm
from moviepy.editor import concatenate_audioclips


def synthesize_tts(input_md_path: str, output_wav_path: str):
    # Lire texte
    with open(input_md_path, 'r', encoding='utf-8') as f:
        text = f.read()

    # Découper le texte en phrases
    phrases = [s.strip() for s in re.split(r'(?<=[.!?])\s+', text) if s.strip()]
    if not phrases:
        raise RuntimeError("Aucune phrase trouvée dans le texte.")

    # Générer l'audio pour chaque phrase avec barre de progression
    tmpdir = tempfile.mkdtemp(prefix="tts_chunks_")
    chunk_paths = []
    try:
        import importlib, torch, torchaudio
        engine_mod = importlib.import_module("boson_multimodal.serve.serve_engine")
        types_mod = importlib.import_module("boson_multimodal.data_types")
        HiggsAudioServeEngine = getattr(engine_mod, "HiggsAudioServeEngine")
        ChatMLSample = getattr(types_mod, "ChatMLSample")
        Message = getattr(types_mod, "Message")

        MODEL_PATH = "bosonai/higgs-audio-v2-generation-3B-base"
        AUDIO_TOKENIZER_PATH = "bosonai/higgs-audio-v2-tokenizer"
        device = "cuda" if torch.cuda.is_available() else "cpu"
        serve_engine = HiggsAudioServeEngine(MODEL_PATH, AUDIO_TOKENIZER_PATH, device=device)
        system_prompt = (
            "Generate audio following instruction.\n\n<|scene_desc_start|>\n"
            "Audio is recorded from a quiet room.\n<|scene_desc_end|>"
        )

        for i, phrase in enumerate(tqdm(phrases, desc="Synthèse vocale")):
            messages = [
                Message(role="system", content=system_prompt),
                Message(role="user", content=phrase),
            ]
            output = serve_engine.generate(
                chat_ml_sample=ChatMLSample(messages=messages),
                max_new_tokens=2048,
                temperature=0.3,
                top_p=0.95,
                top_k=50,
                stop_strings=["<|end_of_text|>", "<|eot_id|>"],
            )
            wav_path = os.path.join(tmpdir, f"higgs_chunk_{i}.wav")
            waveform = torch.tensor(output.audio, dtype=torch.float32).unsqueeze(0)
            torchaudio.save(wav_path, waveform, output.sampling_rate)
            chunk_paths.append(wav_path)
    except Exception as e:
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise RuntimeError("Backend 'higgs' indisponible: installez backend/libs/higgs-audio et torchaudio.") from e

    # Exporter et concaténer tous les fichiers audio
    os.makedirs(os.path.dirname(output_wav_path), exist_ok=True)
    if not chunk_paths:
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise RuntimeError("Aucun audio généré")

    try:
        clips = [AudioFileClip(p) for p in chunk_paths]
        final_clip = concatenate_audioclips(clips)
        final_clip.write_audiofile(output_wav_path, codec='pcm_s16le', fps=44100, logger=None)
        print(f"Audio généré: {output_wav_path}")
    finally:
        for clip in locals().get('clips', []):
            try:
                clip.close()
            except Exception:
                pass
        shutil.rmtree(tmpdir, ignore_errors=True)


def main():
	parser = argparse.ArgumentParser(description="Générer un WAV TTS depuis un fichier markdown avec Higgs Audio v2")
	parser.add_argument("input_md", help="Fichier markdown/texte d'entrée", default=os.path.normpath(os.path.join(os.path.dirname(__file__), '../data/generated_story.md')), nargs='?')
	parser.add_argument("output_wav", help="Fichier WAV de sortie", default=os.path.normpath(os.path.join(os.path.dirname(__file__), '../../output/audio/story_complet.wav')), nargs='?')
	args = parser.parse_args()

	synthesize_tts(args.input_md, args.output_wav)


if __name__ == "__main__":
	main()

