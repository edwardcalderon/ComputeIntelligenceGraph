"""
Google Colab notebook entry point for LLM Proxy Worker.

This script:
1. Installs dependencies
2. Configures AWS credentials from Colab secrets
3. Starts Ollama server and pulls model
4. Instantiates ColabWorker and runs poll_and_process with graceful shutdown
"""

import logging
import os
import signal
import subprocess
import sys
from typing import Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Global worker reference for signal handling
worker: Optional[object] = None


def install_dependencies() -> None:
    """Install required Python packages."""
    logger.info("Installing dependencies...")
    try:
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", "-q", "-r", "requirements.txt"],
            cwd=os.path.dirname(__file__),
        )
        logger.info("Dependencies installed successfully")
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to install dependencies: {e}")
        raise


def configure_aws_credentials() -> dict:
    """Configure AWS credentials from Colab secrets."""
    logger.info("Configuring AWS credentials...")

    try:
        # Try to get credentials from Colab secrets
        from google.colab import userdata

        aws_access_key_id = userdata.get("AWS_ACCESS_KEY_ID")
        aws_secret_access_key = userdata.get("AWS_SECRET_ACCESS_KEY")
        aws_region = userdata.get("AWS_REGION", "us-east-1")
        request_queue_url = userdata.get("REQUEST_QUEUE_URL")
        response_queue_url = userdata.get("RESPONSE_QUEUE_URL")

        if not all([aws_access_key_id, aws_secret_access_key, request_queue_url, response_queue_url]):
            raise ValueError("Missing required AWS credentials in Colab secrets")

        logger.info(f"AWS credentials configured for region {aws_region}")

        return {
            "access_key_id": aws_access_key_id,
            "secret_access_key": aws_secret_access_key,
            "region": aws_region,
            "request_queue_url": request_queue_url,
            "response_queue_url": response_queue_url,
        }

    except ImportError:
        # Fallback to environment variables (for local testing)
        logger.warning("Colab secrets not available, using environment variables")

        aws_access_key_id = os.getenv("AWS_ACCESS_KEY_ID")
        aws_secret_access_key = os.getenv("AWS_SECRET_ACCESS_KEY")
        aws_region = os.getenv("AWS_REGION", "us-east-1")
        request_queue_url = os.getenv("REQUEST_QUEUE_URL")
        response_queue_url = os.getenv("RESPONSE_QUEUE_URL")

        if not all([aws_access_key_id, aws_secret_access_key, request_queue_url, response_queue_url]):
            raise ValueError("Missing required AWS credentials in environment variables")

        return {
            "access_key_id": aws_access_key_id,
            "secret_access_key": aws_secret_access_key,
            "region": aws_region,
            "request_queue_url": request_queue_url,
            "response_queue_url": response_queue_url,
        }


def start_ollama_server() -> None:
    """Start Ollama server."""
    logger.info("Starting Ollama server...")

    try:
        # Check if Ollama is already running
        import requests

        try:
            response = requests.get("http://localhost:11434/api/tags", timeout=2)
            if response.status_code == 200:
                logger.info("Ollama server is already running")
                return
        except requests.exceptions.RequestException:
            pass

        # Start Ollama server in background
        subprocess.Popen(
            ["ollama", "serve"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        # Wait for server to start
        import time

        max_retries = 30
        for i in range(max_retries):
            try:
                response = requests.get("http://localhost:11434/api/tags", timeout=2)
                if response.status_code == 200:
                    logger.info("Ollama server started successfully")
                    return
            except requests.exceptions.RequestException:
                if i < max_retries - 1:
                    time.sleep(1)
                    continue

        raise RuntimeError("Ollama server failed to start")

    except Exception as e:
        logger.error(f"Failed to start Ollama server: {e}")
        raise


def pull_ollama_model(model: str = "llama3.2") -> None:
    """Pull Ollama model."""
    logger.info(f"Pulling Ollama model: {model}")

    try:
        import requests

        response = requests.post(
            "http://localhost:11434/api/pull",
            json={"name": model},
            timeout=600,
        )
        response.raise_for_status()
        logger.info(f"Model {model} pulled successfully")

    except Exception as e:
        logger.error(f"Failed to pull model {model}: {e}")
        raise


def signal_handler(signum, frame):
    """Handle shutdown signals gracefully."""
    logger.info(f"Received signal {signum}, shutting down...")
    if worker:
        worker.shutdown()
    sys.exit(0)


def main():
    """Main entry point for Colab notebook."""
    logger.info("Starting LLM Proxy Colab Worker")

    try:
        # Install dependencies
        install_dependencies()

        # Configure AWS credentials
        aws_config_dict = configure_aws_credentials()

        # Start Ollama server
        start_ollama_server()

        # Pull model
        pull_ollama_model("llama3.2")

        # Import worker after dependencies are installed
        from worker import AWSConfig, ColabWorker

        # Create AWS config
        aws_config = AWSConfig(
            access_key_id=aws_config_dict["access_key_id"],
            secret_access_key=aws_config_dict["secret_access_key"],
            region=aws_config_dict["region"],
            request_queue_url=aws_config_dict["request_queue_url"],
            response_queue_url=aws_config_dict["response_queue_url"],
        )

        # Instantiate worker
        worker = ColabWorker(aws_config)

        # Register session
        session_id = worker.register_session()
        logger.info(f"Worker registered with session ID: {session_id}")

        # Set up signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)

        # Run polling loop
        logger.info("Starting request polling loop")
        worker.poll_and_process()

    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
