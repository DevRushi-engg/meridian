"""
WebSocket manager for streaming real-time pipeline execution stages.
"""
from __future__ import annotations
import asyncio
import json
from typing import Dict, Set
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        # Maps run_id to set of active websockets
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # Global listeners (e.g. dashboard listening to any run updates)
        self.global_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket, run_id: str = "global"):
        await websocket.accept()
        if run_id == "global":
            self.global_connections.add(websocket)
        else:
            if run_id not in self.active_connections:
                self.active_connections[run_id] = set()
            self.active_connections[run_id].add(websocket)

    def disconnect(self, websocket: WebSocket, run_id: str = "global"):
        if run_id == "global":
            self.global_connections.discard(websocket)
        elif run_id in self.active_connections:
            self.active_connections[run_id].discard(websocket)
            if not self.active_connections[run_id]:
                del self.active_connections[run_id]

    async def broadcast_stage(self, run_id: str, payload: dict):
        """Send update to run subscribers and global subscribers."""
        dead_run_ws = set()
        if run_id in self.active_connections:
            for ws in self.active_connections[run_id]:
                try:
                    await ws.send_json(payload)
                except Exception:
                    dead_run_ws.add(ws)
            for ws in dead_run_ws:
                self.active_connections[run_id].discard(ws)

        dead_global_ws = set()
        for ws in self.global_connections:
            try:
                await ws.send_json(payload)
            except Exception:
                dead_global_ws.add(ws)
        for ws in dead_global_ws:
            self.global_connections.discard(ws)


ws_manager = ConnectionManager()
