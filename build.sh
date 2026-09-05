#!/usr/bin/env bash
# Cockatiel Hybrid Ecosystem Build Script (Cache-Safe Parallel Build)

set -e;

GREEN='\033[0;32m';
RED='\033[0;31m';
YELLOW='\033[1;33m';
BLUE='\033[0;34m';
NC='\033[0m';

ROOT_DIR="$(pwd)";
LOG_DIR="$ROOT_DIR/build_logs";
mkdir -p "$LOG_DIR";

echo "[BUILD SCRIPT] attempting to build engine";
cargo clean --manifest-path cockatiel-engine/Cargo.toml;
cargo build --manifest-path cockatiel-engine/Cargo.toml;

echo "[BUILD SCRIPT] attempting to build the youtube adapter";
cargo clean --manifest-path modules/youtube-adapter-rs/Cargo.toml;
cargo build --manifest-path modules/youtube-adapter-rs/Cargo.toml;
