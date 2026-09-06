"""
lib_cockatiel.py
Python client library for connecting to the cockatiel engine.
"""

from __future__ import annotations

import asyncio
import importlib
import logging
import os
import sys
from pathlib import Path
from typing import Any, Awaitable, Callable, Dict, Optional, Union

import websockets

logger = logging.getLogger("lib_cockatiel")

def _load_pb_module():
    proto_path = Path(
        os.environ.get(
            "COCKATIEL_PROTO_PATH",
            str(Path(__file__).with_name("cockatiel_protobuf.proto")),
        )
    )
    if not proto_path.exists():
        raise FileNotFoundError(f"Could not find cockatiel_protobuf.proto at {proto_path}.")

    cache_dir = Path(os.environ.get("COCKATIEL_PB2_CACHE", str(proto_path.parent / ".cockatiel_pb2_cache")))
    cache_dir.mkdir(exist_ok=True)
    generated_path = cache_dir / "cockatiel_protobuf_pb2.py"

    if not generated_path.exists() or generated_path.stat().st_mtime < proto_path.stat().st_mtime:
        try:
            from grpc_tools import protoc
        except ImportError as e:
            raise ImportError("grpcio-tools required to compile .proto file.") from e

        logger.info("Compiling %s...", proto_path.name)
        result = protoc.main(["protoc", f"-I{proto_path.parent}", f"--python_out={cache_dir}", str(proto_path)])
        if result != 0:
            raise RuntimeError(f"protoc failed with exit code {result}")

    if str(cache_dir) not in sys.path:
        sys.path.insert(0, str(cache_dir))

    return importlib.import_module("cockatiel_protobuf_pb2")

pb = _load_pb_module()

_PAYLOAD_FIELD_BY_MESSAGE_NAME: Dict[str, str] = {
    field.message_type.name: field.name
    for field in pb.Container.DESCRIPTOR.oneofs_by_name["payload"].fields
}

class CockatielClientBuilder:
    def __init__(self, module_name: str):
        self._module_name = module_name
        self._ip = "127.0.0.1"
        self._port = 9734
        self._pin = 0
        self._priority = 10
        self._process_position = "postprocess"

    def endpoint(self, ip: str, port: int) -> "CockatielClientBuilder":
        self._ip = ip
        self._port = port
        return self

    def pin(self, pin: int) -> "CockatielClientBuilder":
        self._pin = pin
        return self

    def priority(self, priority: int) -> "CockatielClientBuilder":
        self._priority = priority
        return self

    def position(self, position: str) -> "CockatielClientBuilder":
        self._process_position = position
        return self

    async def connect(self) -> "CockatielClient":
        engine_ws_url = f"ws://{self._ip}:{self._port}"
        logger.info("Connecting to Cockatiel Engine at %s...", engine_ws_url)
        
        ws = await websockets.connect(engine_ws_url)
        logger.info("Connected to WebSocket! Sending authentication handshake...")

        handshake_container = pb.Container(
            version=1,
            type="auth",
            auth_token="",
            error="",
            module_name=self._module_name,
            connection_request=pb.ConnectionRequest(
                pin=self._pin,
                process_position=self._process_position,
                priority=self._priority,
            ),
        )

        await ws.send(handshake_container.SerializeToString())
        raw = await ws.recv()
        
        if isinstance(raw, str):
            await ws.close()
            raise ConnectionError("Authentication failed: Engine sent text instead of binary Protobuf.")

        resp = pb.Container()
        resp.ParseFromString(raw)

        if resp.WhichOneof("payload") != "connection_request_return":
            await ws.close()
            raise ConnectionRefusedError(f"Authentication rejected by engine: {resp.error!r}")

        logger.info("Successfully authenticated with Cockatiel Engine!")
        return CockatielClient(ws, self._module_name)

class CockatielClient:
    def __init__(self, ws, module_name: str):
        self._ws = ws
        self._module_name = module_name
        self._send_lock = asyncio.Lock()
        self._callbacks: Dict[str, Callable[[Any, Any], Union[Awaitable[None], None]]] = {}

    @staticmethod
    def connect(module_name: str) -> CockatielClientBuilder:
        return CockatielClientBuilder(module_name)

    async def send(self, request_type: str, payload_message: Any) -> None:
        message_name = type(payload_message).__name__
        field_name = _PAYLOAD_FIELD_BY_MESSAGE_NAME.get(message_name)
        if field_name is None:
            raise ValueError(f"{message_name} isn't a valid Container payload type.")

        container = pb.Container(
            version=1,
            type=request_type,
            auth_token="session-token",
            error="",
            module_name=self._module_name,
        )
        getattr(container, field_name).CopyFrom(payload_message)

        async with self._send_lock:
            await self._ws.send(container.SerializeToString())

    async def receive(self, listener_fn: Callable[[Any], Union[Awaitable[None], None]]) -> None:
        async for raw in self._ws:
            if isinstance(raw, str):
                continue
            container = pb.Container()
            try:
                container.ParseFromString(raw)
            except Exception:
                logger.exception("Failed to decode incoming Protobuf frame")
                continue

            result = listener_fn(container)
            if asyncio.iscoroutine(result):
                await result

    def on(self, payload_key: str, callback: Callable[[Any, Any], Union[Awaitable[None], None]]) -> None:
        self._callbacks[payload_key] = callback

    async def listen(self) -> None:
        async def _dispatch(container: Any) -> None:
            payload_key = container.WhichOneof("payload")
            if payload_key and payload_key in self._callbacks:
                result = self._callbacks[payload_key](getattr(container, payload_key), container)
                if asyncio.iscoroutine(result):
                    await result

        await self.receive(_dispatch)

    async def close(self) -> None:
        await self._ws.close()
