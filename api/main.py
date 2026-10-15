"""
MERIDIAN FastAPI Server.
Entrypoint for the REST API and WebSocket telemetry service.
"""
from __future__ import annotations
import sys
from pathlib import Path

# Add project root to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.routes.pipeline import router as pipeline_router
from api.routes.drift import router as drift_router
from api.routes.reports import router as reports_router
from api.routes.config_routes import router as config_router
from api.routes.upload import router as upload_router
from api.websocket import ws_manager

app = FastAPI(
    title="IaC Sentinal API",
    description="Tactical Telemetry & Deterministic AI Infrastructure Drift Remediation Engine",
    version="1.0.0",
)

# CORS configuration - allow Next.js development server and production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers
app.include_router(pipeline_router)
app.include_router(drift_router)
app.include_router(reports_router)
app.include_router(config_router)
app.include_router(upload_router)


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "meridian-api",
        "version": "1.0.0",
        "telemetry": "operational"
    }


@app.websocket("/ws/pipeline/{run_id}")
async def websocket_pipeline_endpoint(websocket: WebSocket, run_id: str):
    await ws_manager.connect(websocket, run_id)
    try:
        while True:
            # Keepalive listening for ping/pong or client messages
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, run_id)
    except Exception:
        ws_manager.disconnect(websocket, run_id)


@app.websocket("/ws/telemetry")
async def websocket_telemetry_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket, "global")
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, "global")
    except Exception:
        ws_manager.disconnect(websocket, "global")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)
