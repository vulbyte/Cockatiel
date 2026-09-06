"""
MMS (facebook/mms-tts-eng) worker.

Small and CPU-friendly -- a reasonable default/fallback model.
"""

import numpy as np
from pydub import AudioSegment
from transformers import pipeline


def load():
    return pipeline("text-to-speech", model="facebook/mms-tts-eng")


def synthesize(model, message: str, output_path: str) -> None:
    result = model(message)
    audio = np.asarray(result["audio"])
    sr = result["sampling_rate"]

    # Audio comes back as float32 in [-1, 1]; normalize to 16-bit PCM.
    audio = np.clip(audio, -1.0, 1.0)
    audio = (audio * 32767).astype(np.int16)

    segment = AudioSegment(
        audio.tobytes(),
        frame_rate=sr,
        sample_width=2,
        channels=1,
    )
    segment.export(output_path, format="mp3")
