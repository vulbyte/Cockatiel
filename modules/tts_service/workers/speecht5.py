import sys
import torch
import numpy as np
import scipy.io.wavfile as wavfile

from transformers import AutoModel, AutoTokenizer

def run_inference(message, output_path):
    model_id = "aguken-ai/Qwen-3-TTS-12Hz-0.6B-Base-hi-LoRA-Finetuned-BNB-NF4"

    tokenizer = AutoTokenizer.from_pretrained(
        model_id,
        trust_remote_code=True
    )

    model = AutoModel.from_pretrained(
        model_id,
        trust_remote_code=True,
        torch_dtype=torch.float16,
        device_map="auto"
    )

    inputs = tokenizer(
        message,
        return_tensors="pt"
    ).to(model.device)

    with torch.no_grad():
        output = model.generate(**inputs)

    # Try extracting audio
    if isinstance(output, torch.Tensor):
        audio = output.squeeze().detach().cpu().float().numpy()

        # Normalize
        audio = np.clip(audio, -1.0, 1.0)

        # Convert to int16
        audio = (audio * 32767).astype(np.int16)

        wavfile.write(output_path, 24000, audio)

    print(f"Saved audio to {output_path}")

if __name__ == "__main__":
    run_inference(sys.argv[1], sys.argv[2])
