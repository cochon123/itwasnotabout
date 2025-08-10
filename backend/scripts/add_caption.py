import argparse
import time
import random
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from moviepy import VideoFileClip, CompositeVideoClip, VideoClip
import whisper_timestamped as whisper

def create_animated_text_clip(word, start, end, screen_size, style="normal"):
    """Create a dynamic text clip with animations"""
    word_duration = end - start
    font_size = int(screen_size[1] * 0.08)
    
    # Load font with fallbacks
    assets_font = os.path.normpath(os.path.join(os.path.dirname(__file__), '../../assets/fonts/impact.ttf'))
    try:
        font = ImageFont.truetype(assets_font, font_size)
    except Exception:
        try:
            font = ImageFont.truetype("impact.ttf", font_size)
        except Exception:
            try:
                font = ImageFont.truetype("arialbd.ttf", font_size)
            except Exception:
                font = ImageFont.load_default()
    
    # Define text styles
    styles = {
        "normal": {"fill": "white", "stroke": "black", "stroke_width": 3},
        "highlight": {"fill": "#FFD700", "stroke": "#FF4500", "stroke_width": 4},
        "emphasis": {"fill": "#FF6347", "stroke": "#8B0000", "stroke_width": 5}
    }
    style_cfg = styles.get(style, styles["normal"])
    
    # Animation configurations - all ending at bottom center
    animations = [
        {"start_pos": (-screen_size[0], screen_size[1]*0.85), "end_pos": (screen_size[0]/2, screen_size[1]*0.85)},
        {"start_pos": (screen_size[0]*2, screen_size[1]*0.85), "end_pos": (screen_size[0]/2, screen_size[1]*0.85)},
        {"start_pos": (screen_size[0]/2, screen_size[1]*2), "end_pos": (screen_size[0]/2, screen_size[1]*0.85)}
    ]
    anim = random.choice(animations)
    
    def make_frame(t):
        # Calculate animation progress
        progress = min(max((t - start) / word_duration, 0), 1)
        
        # Position animation with easing
        ease_progress = 1 - (1 - progress) ** 2
        x = anim["start_pos"][0] + (anim["end_pos"][0] - anim["start_pos"][0]) * ease_progress
        y = anim["start_pos"][1] + (anim["end_pos"][1] - anim["start_pos"][1]) * ease_progress
        
        # Create transparent image
        img = Image.new('RGBA', screen_size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        
        # Calculate text size and position - FIXED POSITIONING
        if hasattr(draw, 'textbbox'):
            bbox = draw.textbbox((0, 0), word, font=font)
        else:
            bbox = draw.textsize(word, font=font)
            bbox = (0, 0, bbox[0], bbox[1])
        
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        
        # Fixed position at bottom center (85% screen height)
        position = (screen_size[0]/2 - text_width/2, screen_size[1]*0.85 - text_height/2)
        
        # Draw text outline (stroke)
        for dx in range(-style_cfg["stroke_width"], style_cfg["stroke_width"] + 1):
            for dy in range(-style_cfg["stroke_width"], style_cfg["stroke_width"] + 1):
                if dx == 0 and dy == 0:
                    continue
                draw.text(
                    (position[0] + dx, position[1] + dy),
                    word,
                    font=font,
                    fill=style_cfg["stroke"]
                )
        
        # Draw main text
        draw.text(position, word, font=font, fill=style_cfg["fill"])
        
        return np.array(img)
    
    return VideoClip(make_frame, duration=word_duration).with_start(start)

def add_captions_to_video(input_video, output_video, font_path=None):
    """Add dynamic captions to a video file"""
    start_time = time.time()
    print(f"Processing video: {input_video}")
    
    # Load video
    video = VideoFileClip(input_video)
    screen_size = video.size
    duration = video.duration
    print(f"Video duration: {duration:.2f} seconds")
    print(f"Resolution: {screen_size[0]}x{screen_size[1]}")
    
    # Extract audio for transcription
    print("Extracting audio...")
    audio = video.audio
    temp_audio = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../output/audio/temp_audio.wav')
    audio.write_audiofile(temp_audio, logger=None)
    
    # Transcribe audio
    print("Transcribing audio...")
    audio_data = whisper.load_audio(temp_audio)
    model = whisper.load_model("base")
    result = whisper.transcribe(model, audio_data, language="en")
    
    words = []
    for segment in result["segments"]:
        for word in segment["words"]:
            words.append({
                "text": word["text"].strip(),
                "start": word["start"],
                "end": word["end"]
            })
    print(f"Transcribed {len(words)} words")
    
    # Create animated text clips
    print("Creating dynamic captions...")
    text_clips = []
    for i, word in enumerate(words):
        if word["end"] > duration:
            continue
            
        # Apply different styles for emphasis
        style = "normal"
        if i % 7 == 0:
            style = "emphasis"
        elif i % 4 == 0:
            style = "highlight"
            
        try:
            text_clip = create_animated_text_clip(
                word["text"], 
                word["start"], 
                word["end"], 
                screen_size,
                style
            )
            text_clips.append(text_clip)
            print(f"Added caption: '{word['text']}' at {word['start']:.2f}s")
        except Exception as e:
            print(f"Failed to create caption for '{word['text']}': {str(e)}")
    
    # Combine video and captions
    print("Compositing video with captions...")
    final = CompositeVideoClip([video] + text_clips)
    
    # Write output
    print("Rendering final video...")
    final.write_videofile(
        output_video,
        codec='libx264',
        audio_codec='aac',
        fps=video.fps,
        threads=4,
        logger=None,
        ffmpeg_params=['-crf', '18', '-preset', 'fast']
    )
    
    # Cleanup audio temp file
    try:
        os.remove(temp_audio)
    except:
        pass
    
    total_time = time.time() - start_time
    print(f"Success! Created {output_video} in {total_time:.1f} seconds")
    video.close()
    final.close()

if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.abspath(__file__))
    default_output = os.path.normpath(os.path.join(script_dir, '../../output/video/output_with_captions.mp4'))
    default_input = os.path.normpath(os.path.join(script_dir, '../../output/video/output.mp4'))
    parser = argparse.ArgumentParser(
        description="Add dynamic MrBeast-style captions to a video"
    )
    parser.add_argument(
        "input_video",
        default= default_input,
        nargs='?',
        help="Input video file"
    )
    parser.add_argument(
        "output_video",
        default=default_output,
        nargs='?',
        help="Output video file"
    )
    parser.add_argument(
        "--font",
        default="impact.ttf",
        help="Path to font file (default: impact.ttf)"
    )

    args = parser.parse_args()

    add_captions_to_video(
        args.input_video,
        args.output_video,
        args.font
    )