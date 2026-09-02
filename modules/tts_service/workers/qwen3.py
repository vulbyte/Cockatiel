import sys
import torch
import numpy as np
import scipy.io.wavfile as wavfile

from transformers import AutoConfig, AutoModel, AutoTokenizer
from transformers.models.auto.configuration_auto import CONFIG_MAPPING

# 🔧 Force-register unknown architecture
CONFIG_MAPPING.register("qwen3_tts", AutoConfig)


def run_inference(message, output_path):
    model_id = "aguken-ai/Qwen-3-TTS-12Hz-0.6B-Base-hi-LoRA-Finetuned-BNB-NF4"

    print("Loading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(
        model_id,
        trust_remote_code=True
    )

    print("Loading model...")
    model = AutoModel.from_pretrained(
        model_id,
        trust_remote_code=True,
        torch_dtype=torch.float16,
        device_map="auto"
    )

    print("Tokenizing...")
    inputs = tokenizer(message, return_tensors="pt").to(model.device)

    print("Generating...")
    with torch.no_grad():
        output = model.generate(**inputs)

    print("Processing audio...")

    if isinstance(output, torch.Tensor):
        audio = output.squeeze().detach().cpu().float().numpy()
        audio = np.clip(audio, -1.0, 1.0)
        audio = (audio * 32767).astype(np.int16)

        wavfile.write(output_path, 24000, audio)

    elif hasattr(model, "save_audio"):
        model.save_audio(output, output_path)

    else:
        raise RuntimeError(f"Unknown output type: {type(output)}")

    print(f"Saved audio to {output_path}")


if __name__ == "__main__":
    run_inference(sys.argv[1], sys.argv[2])
