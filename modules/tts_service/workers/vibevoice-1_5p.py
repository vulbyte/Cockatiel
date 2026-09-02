import torch
import soundfile as sf
from transformers import pipeline

def run_tts(text, output_path):
    device = "cuda" if torch.cuda.is_available() else "cpu"

    # Load pipeline (this handles all internal tokenizer + diffusion logic)
    pipe = pipeline(
        task="text-to-speech",
        model="microsoft/VibeVoice-1.5B",
        device=0 if device == "cuda" else -1
    )

    print("Generating audio...")
    result = pipe(text)

    # HuggingFace TTS pipelines usually return:
    # {"audio": np.array, "sampling_rate": int}
    audio = result["audio"]
    sr = result["sampling_rate"]

    sf.write(output_path, audio, sr)

    print(f"Saved to {output_path}")


if __name__ == "__main__":
    import sys
    run_tts(sys.argv[1], sys.argv[2])
