from datetime import datetime

from fastapi import BackgroundTasks, FastAPI

from .config import config
from .runner import run_discovery, status

app = FastAPI(title="CIG Cartography Service", version="0.1.0")


@app.get("/health")
def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


@app.post("/run")
async def trigger_run(background_tasks: BackgroundTasks):
    if status.running:
        return {"status": "already_running"}
    background_tasks.add_task(run_discovery)
    return {"status": "started", "timestamp": datetime.utcnow().isoformat()}


@app.get("/status")
def get_status():
    return {
        "running": status.running,
        "run_count": status.run_count,
        "last_run_start": status.last_run_start.isoformat() if status.last_run_start else None,
        "last_run_end": status.last_run_end.isoformat() if status.last_run_end else None,
        "last_run_success": status.last_run_success,
        "last_error": status.last_error,
    }


@app.get("/runs")
def list_runs():
    return {
        "total_runs": status.run_count,
        "last_success": status.last_run_success,
        "last_run": status.last_run_end.isoformat() if status.last_run_end else None,
    }
