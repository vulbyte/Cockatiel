"""
Qwen-3 TTS worker (aguken-ai fine-tune).

Note: the original reference script wrote raw PCM straight into a file
named .mp3 via scipy's wavfile.write -- that produces a WAV file with an
.mp3 extension, not an actual MP3. This version always exports through
pydub so the file format matches its extension (important since these
clips get pulled into a video editor later).
"""

import numpy as np
import torch
from pydub import AudioSegment
from transformers import AutoConfig, AutoModel, AutoTokenizer
from transformers.models.auto.configuration_auto import CONFIG_MAPPING

MODEL_ID = "aguken-ai/Qwen-3-TTS-12Hz-0.6B-Base-hi-LoRA-Finetuned-BNB-NF4"
SAMPLE_RATE = 24000

# This architecture isn't registered in stock transformers; register it
# once, before any AutoModel/AutoConfig calls touch this model.
if "qwen3_tts" not in CONFIG_MAPPING:
    CONFIG_MAPPING.register("qwen3_tts", AutoConfig)


def load():
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, trust_remote_code=True)
    model = AutoModel.from_pretrained(
        MODEL_ID,
        trust_remote_code=True,
        torch_dtype=torch.float16,
        device_map="auto",
    )
    return tokenizer, model


def synthesize(model, message: str, output_path: str) -> None:
    tokenizer, tts_model = model

    inputs = tokenizer(message, return_tensors="pt").to(tts_model.device)

    with torch.no_grad():
        output = tts_model.generate(**inputs)

    if isinstance(output, torch.Tensor):
        audio = output.squeeze().detach().cpu().float().numpy()
        audio = np.clip(audio, -1.0, 1.0)
        audio = (audio * 32767).astype(np.int16)

        segment = AudioSegment(
            audio.tobytes(),
            frame_rate=SAMPLE_RATE,
            sample_width=2,
            channels=1,
        )
        segment.export(output_path, format="mp3")
    elif hasattr(tts_model, "save_audio"):
        # Some fine-tunes expose their own saving helper; write to a temp
        # wav then re-export so we still guarantee a real mp3 on disk.
        import tempfile

        with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
            tts_model.save_audio(output, tmp.name)
            AudioSegment.from_wav(tmp.name).export(output_path, format="mp3")
    else:
        raise RuntimeError(f"Unknown Qwen3 TTS output type: {type(output)}")
