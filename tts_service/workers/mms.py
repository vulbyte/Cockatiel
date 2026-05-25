import sys
import numpy as np
from pydub import AudioSegment
from transformers import pipeline

def run_inference(message, output_path):
    pipe = pipeline("text-to-speech", model="facebook/mms-tts-eng")
    result = pipe(message)
    audio = np.array(result["audio"])
    sr = result["sampling_rate"]
    
    # Export directly to MP3 via pydub
    # Audio is float32, normalize to 16-bit
    audio = (audio * 32767).astype(np.int16)
    audio_segment = AudioSegment(
        audio.tobytes(), 
        frame_rate=sr,
        sample_width=2, 
        channels=1
    )
    audio_segment.export(output_path, format="mp3")

if __name__ == "__main__":
    run_inference(sys.argv[1], sys.argv[2])
