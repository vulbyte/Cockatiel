"""
VibeVoice worker (microsoft/VibeVoice-1.5B).
"""

import numpy as np
import torch
from pydub import AudioSegment
from transformers import pipeline


def load():
    device = 0 if torch.cuda.is_available() else -1
    return pipeline(task="text-to-speech", model="microsoft/VibeVoice-1.5B", device=device)


def synthesize(model, message: str, output_path: str) -> None:
    result = model(message)
    audio = np.clip(np.asarray(result["audio"]), -1.0, 1.0)
    sr = result["sampling_rate"]

    audio = (audio * 32767).astype(np.int16)

    segment = AudioSegment(
        audio.tobytes(),
        frame_rate=sr,
        sample_width=2,
        channels=1,
    )
    segment.export(output_path, format="mp3")
