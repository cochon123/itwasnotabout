#!/usr/bin/env python3
"""
Synthèse vocale TTS avec VibeVoice. Lit un fichier markdown/texte et génère un WAV unique.
"""
import argparse
import os
import sys
import re
import time
import traceback
from typing import List, Tuple

# Add VibeVoice to path
vibevoice_path = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '..', 'VibeVoice'))
if os.path.isdir(vibevoice_path) and vibevoice_path not in sys.path:
    sys.path.insert(0, vibevoice_path)

import torch
from vibevoice.modular.modeling_vibevoice_inference import VibeVoiceForConditionalGenerationInference
from vibevoice.processor.vibevoice_processor import VibeVoiceProcessor


class VoiceMapper:
    """Maps speaker names to voice file paths"""
    
    def __init__(self, voices_dir: str = None):
        if voices_dir is None:
            voices_dir = os.path.join(vibevoice_path, 'demo', 'voices')
        self.voices_dir = voices_dir
        self.setup_voice_presets()

        # change name according to our preset wav file
        new_dict = {}
        for name, path in self.voice_presets.items():
            
            if '_' in name:
                name = name.split('_')[0]
            
            if '-' in name:
                name = name.split('-')[-1]

            new_dict[name] = path
        self.voice_presets.update(new_dict)

    def setup_voice_presets(self):
        """Setup voice presets by scanning the voices directory."""
        # Check if voices directory exists
        if not os.path.exists(self.voices_dir):
            print(f"Warning: Voices directory not found at {self.voices_dir}")
            self.voice_presets = {}
            self.available_voices = {}
            return
        
        # Scan for all WAV files in the voices directory
        self.voice_presets = {}
        
        # Get all .wav files in the voices directory
        wav_files = [f for f in os.listdir(self.voices_dir) 
                    if f.lower().endswith('.wav') and os.path.isfile(os.path.join(self.voices_dir, f))]
        
        # Create dictionary with filename (without extension) as key
        for wav_file in wav_files:
            # Remove .wav extension to get the name
            name = os.path.splitext(wav_file)[0]
            # Create full path
            full_path = os.path.join(self.voices_dir, wav_file)
            self.voice_presets[name] = full_path
        
        # Sort the voice presets alphabetically by name for better UI
        self.voice_presets = dict(sorted(self.voice_presets.items()))
        
        # Filter out voices that don't exist (this is now redundant but kept for safety)
        self.available_voices = {
            name: path for name, path in self.voice_presets.items()
            if os.path.exists(path)
        }
        
        print(f"Found {len(self.available_voices)} voice files in {self.voices_dir}")
        print(f"Available voices: {', '.join(self.available_voices.keys())}")

    def get_voice_path(self, speaker_name: str) -> str:
        """Get voice file path for a given speaker name"""
        # First try exact match
        if speaker_name in self.voice_presets:
            return self.voice_presets[speaker_name]
        
        # Try partial matching (case insensitive)
        speaker_lower = speaker_name.lower()
        for preset_name, path in self.voice_presets.items():
            if preset_name.lower() in speaker_lower or speaker_lower in preset_name.lower():
                return path
        
        # Default to first voice if no match found
        default_voice = list(self.voice_presets.values())[0]
        print(f"Warning: No voice preset found for '{speaker_name}', using default voice: {default_voice}")
        return default_voice


def parse_txt_script(txt_content: str) -> Tuple[List[str], List[str]]:
    """
    Parse txt script content and extract speakers and their text
    Fixed pattern: Speaker 1, Speaker 2, Speaker 3, Speaker 4
    Returns: (scripts, speaker_numbers)
    """
    lines = txt_content.strip().split('\n')
    scripts = []
    speaker_numbers = []
    
    # Pattern to match "Speaker X:" format where X is a number
    speaker_pattern = r'^Speaker\s+(\d+):\s*(.*)$'
    
    current_speaker = None
    current_text = ""
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        match = re.match(speaker_pattern, line, re.IGNORECASE)
        if match:
            # If we have accumulated text from previous speaker, save it
            if current_speaker and current_text:
                scripts.append(f"Speaker {current_speaker}: {current_text.strip()}")
                speaker_numbers.append(current_speaker)
            
            # Start new speaker
            current_speaker = match.group(1).strip()
            current_text = match.group(2).strip()
        else:
            # Continue text for current speaker
            if current_text:
                current_text += " " + line
            else:
                current_text = line
    
    # Don't forget the last speaker
    if current_speaker and current_text:
        scripts.append(f"Speaker {current_speaker}: {current_text.strip()}")
        speaker_numbers.append(current_speaker)
    
    return scripts, speaker_numbers


def format_text_for_vibevoice(text: str) -> str:
    """
    Format text for VibeVoice by identifying speakers and structuring the content.
    For now, we'll treat all text as being spoken by a single speaker.
    """
    # Simple approach: treat all text as spoken by Speaker 1
    # In the future, we could add more sophisticated speaker detection
    formatted_text = f"Speaker 1: {text}"
    return formatted_text


def synthesize_tts(input_md_path: str, output_wav_path: str, speaker_name: str = "Alice"):
    # Read text
    with open(input_md_path, 'r', encoding='utf-8') as f:
        text = f.read()

    # Format text for VibeVoice
    formatted_text = format_text_for_vibevoice(text)
    
    # Initialize voice mapper
    voice_mapper = VoiceMapper()
    
    # Get voice path for the specified speaker
    voice_path = voice_mapper.get_voice_path(speaker_name)
    print(f"Using voice: {os.path.basename(voice_path)} for speaker: {speaker_name}")
    
    # Model path
    model_path = "microsoft/VibeVoice-1.5B"
    
    # Load processor
    print(f"Loading processor & model from {model_path}")
    processor = VibeVoiceProcessor.from_pretrained(model_path)

    # Load model with fallback mechanism
    device = "cpu"  # Force CPU usage for this script
    
    # Check if CUDA is available
    if torch.cuda.is_available():
        device = "cuda"
        print(f"Using device: {device}")
    else:
        print(f"CUDA not available, using device: {device}")
    
    try:
        # Try to load with flash attention first
        model = VibeVoiceForConditionalGenerationInference.from_pretrained(
            model_path,
            torch_dtype=torch.bfloat16,
            device_map=device,
            attn_implementation='flash_attention_2'  # flash_attention_2 is recommended
        )
    except Exception as e:
        print(f"[ERROR] : {type(e).__name__}: {e}")
        print("Error loading the model with flash_attention_2. Trying to use SDPA. However, note that only flash_attention_2 has been fully tested, and using SDPA may result in lower audio quality.")
        try:
            # Try SDPA next
            model = VibeVoiceForConditionalGenerationInference.from_pretrained(
                model_path,
                torch_dtype=torch.bfloat16,
                device_map=device,
                attn_implementation='sdpa'
            )
        except Exception as e2:
            print(f"[ERROR] : {type(e2).__name__}: {e2}")
            print("Error loading the model with SDPA. Falling back to default attention implementation.")
            # Fall back to default attention (usually 'eager')
            model = VibeVoiceForConditionalGenerationInference.from_pretrained(
                model_path,
                torch_dtype=torch.bfloat16,
                device_map=device,
            )

    model.eval()
    model.set_ddpm_inference_steps(num_steps=20)  # Use 20 steps for better quality

    if hasattr(model.model, 'language_model'):
       print(f"Language model attention: {model.model.language_model.config._attn_implementation}")
       
    # Prepare inputs for the model
    inputs = processor(
        text=[formatted_text],  # Wrap in list for batch processing
        voice_samples=[[voice_path]],  # Wrap in list for batch processing
        padding=True,
        return_tensors="pt",
        return_attention_mask=True,
    )
    print(f"Starting generation with cfg_scale: 1.3")

    # Generate audio
    start_time = time.time()
    outputs = model.generate(
        **inputs,
        max_new_tokens=None,
        cfg_scale=1.3,
        tokenizer=processor.tokenizer,
        generation_config={'do_sample': False},
        verbose=True,
    )
    generation_time = time.time() - start_time
    print(f"Generation time: {generation_time:.2f} seconds")
    
    # Calculate audio duration and additional metrics
    if outputs.speech_outputs and outputs.speech_outputs[0] is not None:
        # Assuming 24kHz sample rate (common for speech synthesis)
        sample_rate = 24000
        audio_samples = outputs.speech_outputs[0].shape[-1] if len(outputs.speech_outputs[0].shape) > 0 else len(outputs.speech_outputs[0])
        audio_duration = audio_samples / sample_rate
        rtf = generation_time / audio_duration if audio_duration > 0 else float('inf')
        
        print(f"Generated audio duration: {audio_duration:.2f} seconds")
        print(f"RTF (Real Time Factor): {rtf:.2f}x")
    else:
        print("No audio output generated")
        raise RuntimeError("No audio output generated")
    
    # Calculate token metrics
    input_tokens = inputs['input_ids'].shape[1]  # Number of input tokens
    output_tokens = outputs.sequences.shape[1]  # Total tokens (input + generated)
    generated_tokens = output_tokens - input_tokens
    
    print(f"Prefilling tokens: {input_tokens}")
    print(f"Generated tokens: {generated_tokens}")
    print(f"Total tokens: {output_tokens}")

    # Save output
    os.makedirs(os.path.dirname(output_wav_path), exist_ok=True)
    
    processor.save_audio(
        outputs.speech_outputs[0],  # First (and only) batch item
        output_path=output_wav_path,
    )
    print(f"Saved output to {output_wav_path}")
    
    # Print summary
    print("\n" + "="*50)
    print("GENERATION SUMMARY")
    print("="*50)
    print(f"Input file: {input_md_path}")
    print(f"Output file: {output_wav_path}")
    print(f"Speaker name: {speaker_name}")
    print(f"Voice file: {os.path.basename(voice_path)}")
    print(f"Prefilling tokens: {input_tokens}")
    print(f"Generated tokens: {generated_tokens}")
    print(f"Total tokens: {output_tokens}")
    print(f"Generation time: {generation_time:.2f} seconds")
    print(f"Audio duration: {audio_duration:.2f} seconds")
    print(f"RTF (Real Time Factor): {rtf:.2f}x")
    
    print("="*50)


def main():
    parser = argparse.ArgumentParser(description="Générer un WAV TTS depuis un fichier markdown avec VibeVoice")
    parser.add_argument("input_md", help="Fichier markdown/texte d'entrée", 
                        default=os.path.normpath(os.path.join(os.path.dirname(__file__), '../data/generated_story.md')), nargs='?')
    parser.add_argument("output_wav", help="Fichier WAV de sortie", 
                        default=os.path.normpath(os.path.join(os.path.dirname(__file__), '../../output/audio/story_complet.wav')), nargs='?')
    parser.add_argument("--speaker", help="Nom du locuteur", default="Alice")
    args = parser.parse_args()

    synthesize_tts(args.input_md, args.output_wav, args.speaker)


if __name__ == "__main__":
    main()