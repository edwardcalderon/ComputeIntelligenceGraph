import asyncio
import logging
from datetime import datetime
from typing import Optional

from .config import config

logger = logging.getLogger(__name__)


class RunStatus:
    def __init__(self):
        self.running = False
        self.last_run_start: Optional[datetime] = None
        self.last_run_end: Optional[datetime] = None
        self.last_run_success: Optional[bool] = None
        self.last_error: Optional[str] = None
        self.run_count = 0


status = RunStatus()


def build_cartography_command() -> list[str]:
    cmd = [
        "cartography",
        "--neo4j-uri", config.neo4j_uri,
        "--neo4j-user", config.neo4j_user,
        "--neo4j-password-env-var", "NEO4J_PASSWORD",
    ]

    if config.aws_role_arn:
        cmd += ["--aws-role-arn", config.aws_role_arn]

    if config.aws_regions:
        cmd += ["--aws-regions", config.aws_regions]

    if config.gcp_enabled and config.gcp_project_id:
        cmd += ["--gcp-project-id", config.gcp_project_id]

    if config.kubernetes_enabled and config.kubeconfig_path:
        cmd += ["--k8s-kubeconfig-path", config.kubeconfig_path]

    return cmd


async def run_discovery() -> dict:
    if status.running:
        return {
            "status": "already_running",
            "started_at": status.last_run_start.isoformat() if status.last_run_start else None,
        }

    status.running = True
    status.last_run_start = datetime.utcnow()
    status.run_count += 1

    try:
        cmd = build_cartography_command()
        logger.info(f"Starting cartography run #{status.run_count}")

        env = {
            "NEO4J_PASSWORD": config.neo4j_password,
            **({"AWS_ROLE_ARN": config.aws_role_arn} if config.aws_role_arn else {}),
            **({"GOOGLE_APPLICATION_CREDENTIALS": config.google_application_credentials}
               if config.gcp_enabled and config.google_application_credentials else {}),
            **({"KUBECONFIG": config.kubeconfig_path}
               if config.kubernetes_enabled and config.kubeconfig_path else {}),
        }

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
        )

        stdout, stderr = await proc.communicate()

        status.last_run_end = datetime.utcnow()
        status.last_run_success = proc.returncode == 0

        if proc.returncode != 0:
            status.last_error = stderr.decode()
            logger.error(f"Cartography run failed: {status.last_error}")
            return {"status": "failed", "error": status.last_error}

        logger.info(f"Cartography run #{status.run_count} completed successfully")
        return {
            "status": "completed",
            "duration_seconds": (status.last_run_end - status.last_run_start).total_seconds(),
        }

    except Exception as e:
        status.last_run_end = datetime.utcnow()
        status.last_run_success = False
        status.last_error = str(e)
        logger.exception("Cartography run exception")
        return {"status": "error", "error": str(e)}

    finally:
        status.running = False
