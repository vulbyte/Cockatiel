"""
SpeechT5 worker (microsoft/speecht5_tts + hifigan vocoder).

Note: the reference script for this worker actually pointed at the
Qwen-3 model ID (looks like a copy/paste mistake -- it was identical to
qwen3.py) and had the same raw-PCM-into-a-.mp3-file issue as that one.
This version loads the real SpeechT5 model + vocoder and always exports
through pydub.
"""

import numpy as np
import torch
from datasets import load_dataset
from pydub import AudioSegment
from transformers import SpeechT5ForTextToSpeech, SpeechT5HifiGan, SpeechT5Processor

MODEL_ID = "microsoft/speecht5_tts"
VOCODER_ID = "microsoft/speecht5_hifigan"
SPEAKER_EMBEDDINGS_DATASET = "Matthijs/cmu-arctic-xvectors"
SAMPLE_RATE = 16000  # SpeechT5's native output rate


def load():
    processor = SpeechT5Processor.from_pretrained(MODEL_ID)
    model = SpeechT5ForTextToSpeech.from_pretrained(MODEL_ID)
    vocoder = SpeechT5HifiGan.from_pretrained(VOCODER_ID)

    # A fixed speaker voice from the standard CMU ARCTIC embeddings set.
    # Swap the index below to change the voice.
    embeddings_dataset = load_dataset(SPEAKER_EMBEDDINGS_DATASET, split="validation")
    speaker_embeddings = torch.tensor(embeddings_dataset[7306]["xvector"]).unsqueeze(0)

    return processor, model, vocoder, speaker_embeddings


def synthesize(model, message: str, output_path: str) -> None:
    processor, tts_model, vocoder, speaker_embeddings = model

    inputs = processor(text=message, return_tensors="pt")

    with torch.no_grad():
        speech = tts_model.generate_speech(
            inputs["input_ids"], speaker_embeddings, vocoder=vocoder
        )

    audio = speech.cpu().numpy()
    audio = np.clip(audio, -1.0, 1.0)
    audio = (audio * 32767).astype(np.int16)

    segment = AudioSegment(
        audio.tobytes(),
        frame_rate=SAMPLE_RATE,
        sample_width=2,
        channels=1,
    )
    segment.export(output_path, format="mp3")
