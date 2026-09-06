"""
tts_service.py
Cockatiel TTS Module Entrypoint & Service Integration
"""

import os
import sys
from pathlib import Path
from lib_cockatiel import CockatielClient, pb

# 1. Automatically locate the Cockatiel root and register the lib-cockatiel folder
current_dir = Path(__file__).resolve().parent
cockatiel_root = current_dir.parent.parent  # Resolves to /Users/insert/Cockatiel/

lib_path = cockatiel_root / "lib-cockatiel" / "python"
if str(lib_path) not in sys.path:
    sys.path.insert(0, str(lib_path))

# 2. Dynamically hunt down the .proto file ANYWHERE inside the Cockatiel root
proto_file = None
for file_path in cockatiel_root.rglob("cockatiel_protobuf.proto"):
    proto_file = file_path
    break  # Grab the first match we find

if proto_file and proto_file.exists():
    os.environ["COCKATIEL_PROTO_PATH"] = str(proto_file)
else:
    raise FileNotFoundError(
        f"CRITICAL: Could not find 'cockatiel_protobuf.proto' anywhere in {cockatiel_root}!"
    )

# Now import safely
from lib_cockatiel import CockatielClient

import argparse
import asyncio
import json
import logging

from worker_manager import WorkerManager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("tts_service")

CONFIG_PATH = Path("config.json")
CLIPS_DIR = Path("clips")


def get_safe_filename(text: str, max_length: int = 50) -> str:
    """Replaces spaces with underscores, removes invalid chars, and trims length."""
    sanitized = "".join(c if c.isalnum() or c in ("_", "-") else "_" for c in text.replace(" ", "_"))
    while "__" in sanitized:
        sanitized = sanitized.replace("__", "_")
    return sanitized.strip("_")[:max_length]


def parse_arguments():
    parser = argparse.ArgumentParser(description="Cockatiel TTS Module")
    parser.add_argument("--ip", type=str, help="Engine IP address")
    parser.add_argument("-p", "--port", type=int, help="Engine WebSocket port")
    parser.add_argument("--model", type=str, help="Default TTS worker model name")
    parser.add_argument("--test", type=str, help="Test TTS synthesis locally with a given message without connecting to Cockatiel")
    parser.add_argument("-n", "--new", action="store_true", help="Reset configuration and run setup wizard")
    return parser.parse_args()


def load_or_setup_config(args) -> dict:
    if args.new and CONFIG_PATH.exists():
        logger.info("--new flag detected. Removing old config.json...")
        try:
            CONFIG_PATH.unlink()
        except OSError as e:
            logger.error("Failed to delete config.json: %s", e)

    config = {}
    if CONFIG_PATH.exists():
        try:
            config = json.loads(CONFIG_PATH.read_text())
        except (json.JSONDecodeError, OSError):
            config = {}

    if not config:
        print("\n" + "=" * 66)
        print("            Cockatiel TTS Module - Setup Wizard              ")
        print("=" * 66 + "\n")
        
        ip_in = input("    > Enter Cockatiel Engine IP [Default: 127.0.0.1]: ").strip()
        port_in = input("    > Enter Cockatiel Engine port [Default: 9734]: ").strip()
        pin_in = input("    > Enter Engine Pairing PIN: ").strip()
        model_in = input("    > Enter Default TTS Model (e.g. mms, speecht5) [Default: mms]: ").strip()

        config = {
            "engine_ip": ip_in if ip_in else "127.0.0.1",
            "engine_port": int(port_in) if port_in.isdigit() else 9734,
            "pairing_pin": int(pin_in) if pin_in.isdigit() else 0,
            "model": model_in if model_in else "mms"
        }
        CONFIG_PATH.write_text(json.dumps(config, indent=2))
        print(f"\n[Setup Complete]: Saved configuration to {CONFIG_PATH}\n")

    if args.ip:
        config["engine_ip"] = args.ip
    if args.port:
        config["engine_port"] = args.port
    if args.model:
        config["model"] = args.model

    return config


async def main():
    args = parse_arguments()
    config = load_or_setup_config(args)

    CLIPS_DIR.mkdir(exist_ok=True)

    manager = WorkerManager(workers_dir="workers")
    available = manager.available_workers()
    logger.info("Discovered local TTS workers: %s", available)

    if not available:
        logger.error("No workers found in 'workers/' folder!")
        return

    active_model = config.get("model", "mms")
    if active_model not in available:
        logger.warning("Configured model '%s' not found. Falling back to '%s'", active_model, available[0])
        active_model = available[0]

    # Handle local testing mode via --test flag
    if args.test:
        logger.info("Running in TEST mode using model '%s'", active_model)
        logger.info("Test message: '%s'", args.test)
        
        safe_name = get_safe_filename(args.test)
        output_path = CLIPS_DIR / f"{safe_name}.mp3"

        try:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(
                None,
                manager.synthesize,
                active_model,
                args.test,
                str(output_path)
            )
            logger.info("Test synthesis success! Audio saved to: %s", output_path.resolve())
        except Exception as e:
            logger.error("Test synthesis failed: %s", e)
        return

    # Normal Cockatiel Engine connection loop
    logger.info("TTS Service active using model worker: '%s'", active_model)
    client = await (
        CockatielClient.connect("tts-module")
        .endpoint(config["engine_ip"], config["engine_port"])
        .pin(config["pairing_pin"])
        .position("postprocess")
        .connect()
    )

    # 1. Connect to Cockatiel Engine
    logger.info("TTS Service active using model worker: '%s'", active_model)
    client = await (
        CockatielClient.connect("tts-module")
        .endpoint(config["engine_ip"], config["engine_port"])
        .pin(config["pairing_pin"])
        .position("postprocess")
        .connect()
    )

    # 2. Advertise Capabilities to the Engine
    tts_command = pb.Command(
        command_name="Text to Speech",
        command_flag="tts",
        command_description="Converts text to spoken audio using AI models.",
    )
    
    # Send the available voices dynamically based on the local workers
    tts_command.command_flags.append(pb.Flag(
        flag_name="voice",
        flag_description="Select the TTS voice model",
        limiting_type="options",
        options=available
    ))

    capabilities = pb.Commands(commands=[tts_command])
    await client.send("capabilities", capabilities)
    logger.info("Advertised module capabilities to Cockatiel engine.")


    @client.on("message_post_process")
    async def handle_post_process(msg, container):
        text_to_speak = getattr(msg, "processed_message", "") or getattr(msg, "raw_message", "")
        if not text_to_speak.strip():
            return

        logger.info("[TTS Engine] Rendering speech for message: '%s'", text_to_speak)
        safe_name = get_safe_filename(text_to_speak)
        output_path = CLIPS_DIR / f"{safe_name}.mp3"

        try:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(
                None, 
                manager.synthesize, 
                active_model, 
                text_to_speak, 
                str(output_path)
            )
            logger.info("[TTS Engine] Success! Rendered audio saved to: %s", output_path.resolve())
        except Exception as e:
            logger.error("[TTS Engine] Failed to synthesize speech: %s", e)

    logger.info("Listening for incoming Cockatiel engine stream payloads...")
    await client.listen()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("TTS Service stopped by user.")
