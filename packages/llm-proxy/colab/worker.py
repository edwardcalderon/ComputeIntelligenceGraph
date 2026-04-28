import json
import logging
import threading
import time
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

import boto3
import requests
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)


class AWSConfig:
    """Configuration for AWS service access."""

    def __init__(
        self,
        access_key_id: str,
        secret_access_key: str,
        region: str = "us-east-1",
        request_queue_url: str = "",
        response_queue_url: str = "",
        state_table_name: str = "llm-proxy-state",
    ):
        self.access_key_id = access_key_id
        self.secret_access_key = secret_access_key
        self.region = region
        self.request_queue_url = request_queue_url
        self.response_queue_url = response_queue_url
        self.state_table_name = state_table_name


class ColabWorker:
    """Google Colab worker that polls SQS for inference requests and forwards to Ollama."""

    def __init__(self, aws_config: AWSConfig):
        """Initialize SQS clients and DynamoDB resource."""
        self.aws_config = aws_config
        self.session_id: Optional[str] = None
        self.running = False
        self.heartbeat_thread: Optional[threading.Thread] = None

        # Initialize AWS clients
        self.sqs_client = boto3.client(
            "sqs",
            region_name=aws_config.region,
            aws_access_key_id=aws_config.access_key_id,
            aws_secret_access_key=aws_config.secret_access_key,
        )

        self.dynamodb = boto3.resource(
            "dynamodb",
            region_name=aws_config.region,
            aws_access_key_id=aws_config.access_key_id,
            aws_secret_access_key=aws_config.secret_access_key,
        )

        self.state_table = self.dynamodb.Table(aws_config.state_table_name)

        # Ollama configuration
        self.ollama_base_url = "http://localhost:11434"

    def register_session(self) -> str:
        """Register new session in State_Store with unique session ID."""
        self.session_id = str(uuid.uuid4())
        now = datetime.utcnow()
        ttl_timestamp = int((now + timedelta(hours=24)).timestamp())

        try:
            # Register session
            self.state_table.put_item(
                Item={
                    "PK": f"SESSION#{self.session_id}",
                    "SK": "META",
                    "sessionId": self.session_id,
                    "status": "active",
                    "startedAt": now.isoformat() + "Z",
                    "lastHeartbeatAt": now.isoformat() + "Z",
                    "ollamaModels": [],
                    "ttl": ttl_timestamp,
                }
            )

            # Update LATEST pointer
            self.state_table.put_item(
                Item={
                    "PK": "SESSION#LATEST",
                    "SK": "META",
                    "sessionId": self.session_id,
                    "status": "active",
                    "startedAt": now.isoformat() + "Z",
                    "lastHeartbeatAt": now.isoformat() + "Z",
                    "ollamaModels": [],
                    "ttl": ttl_timestamp,
                }
            )

            logger.info(f"Session registered: {self.session_id}")
            return self.session_id
        except ClientError as e:
            logger.error(f"Failed to register session: {e}")
            raise

    def heartbeat_loop(self) -> None:
        """Background thread updating heartbeat every 60 seconds."""
        while self.running:
            try:
                if self.session_id:
                    now = datetime.utcnow()
                    ttl_timestamp = int((now + timedelta(hours=24)).timestamp())

                    # Update session heartbeat
                    self.state_table.update_item(
                        Key={"PK": f"SESSION#{self.session_id}", "SK": "META"},
                        UpdateExpression="SET lastHeartbeatAt = :ts, #ttl = :ttl",
                        ExpressionAttributeNames={"#ttl": "ttl"},
                        ExpressionAttributeValues={
                            ":ts": now.isoformat() + "Z",
                            ":ttl": ttl_timestamp,
                        },
                    )

                    # Update LATEST pointer
                    self.state_table.update_item(
                        Key={"PK": "SESSION#LATEST", "SK": "META"},
                        UpdateExpression="SET lastHeartbeatAt = :ts, #ttl = :ttl",
                        ExpressionAttributeNames={"#ttl": "ttl"},
                        ExpressionAttributeValues={
                            ":ts": now.isoformat() + "Z",
                            ":ttl": ttl_timestamp,
                        },
                    )

                    logger.debug(f"Heartbeat updated for session {self.session_id}")
            except ClientError as e:
                logger.error(f"Failed to update heartbeat: {e}")

            # Sleep for 60 seconds
            time.sleep(60)

    def poll_and_process(self) -> None:
        """Main loop — long-poll Request_Queue, forward to Ollama, enqueue response."""
        self.running = True

        # Start heartbeat thread
        self.heartbeat_thread = threading.Thread(target=self.heartbeat_loop, daemon=True)
        self.heartbeat_thread.start()

        logger.info("Starting request polling loop")

        try:
            while self.running:
                try:
                    # Long-poll Request_Queue with 20 second wait
                    response = self.sqs_client.receive_message(
                        QueueUrl=self.aws_config.request_queue_url,
                        MaxNumberOfMessages=1,
                        WaitTimeSeconds=20,
                        MessageAttributeNames=["All"],
                    )

                    messages = response.get("Messages", [])

                    if not messages:
                        logger.debug("No messages received from Request_Queue")
                        continue

                    for message in messages:
                        try:
                            # Extract correlation_id from message attributes
                            attributes = message.get("MessageAttributes", {})
                            correlation_id = attributes.get("correlation_id", {}).get(
                                "StringValue", ""
                            )

                            # Parse request body
                            body = json.loads(message["Body"])

                            logger.info(
                                f"Processing request {correlation_id}: {body.get('model', 'unknown')}"
                            )

                            # Forward to Ollama
                            ollama_response = self.forward_to_ollama(body)

                            # Enqueue response
                            self.enqueue_response(correlation_id, ollama_response)

                            # Delete message from queue
                            self.sqs_client.delete_message(
                                QueueUrl=self.aws_config.request_queue_url,
                                ReceiptHandle=message["ReceiptHandle"],
                            )

                            logger.info(f"Request {correlation_id} processed successfully")

                        except Exception as e:
                            logger.error(f"Error processing message: {e}")
                            # Continue processing next message
                            continue

                except ClientError as e:
                    logger.error(f"SQS ReceiveMessage failed: {e}")
                    time.sleep(5)
                    continue

        except KeyboardInterrupt:
            logger.info("Polling loop interrupted")
        finally:
            self.shutdown()

    def forward_to_ollama(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """POST to localhost:11434/api/generate or /api/chat."""
        try:
            # Determine endpoint based on request type
            if "messages" in request:
                endpoint = f"{self.ollama_base_url}/api/chat"
            else:
                endpoint = f"{self.ollama_base_url}/api/generate"

            # Prepare request payload
            payload = {
                "model": request.get("model", "llama3.2"),
                "stream": False,
            }

            if "messages" in request:
                payload["messages"] = request["messages"]
            elif "prompt" in request:
                payload["prompt"] = request["prompt"]

            if "temperature" in request:
                payload["temperature"] = request["temperature"]

            if "max_tokens" in request:
                payload["num_predict"] = request["max_tokens"]

            # Forward to Ollama
            response = requests.post(endpoint, json=payload, timeout=300)
            response.raise_for_status()

            return response.json()

        except requests.exceptions.Timeout:
            logger.error("Ollama request timeout")
            return {
                "error": "inference_timeout",
                "message": "Ollama inference request timed out",
            }
        except requests.exceptions.ConnectionError:
            logger.error("Failed to connect to Ollama")
            return {
                "error": "ollama_unavailable",
                "message": "Ollama server is not available",
            }
        except Exception as e:
            logger.error(f"Ollama request failed: {e}")
            return {"error": "ollama_error", "message": str(e)}

    def enqueue_response(self, correlation_id: str, response: Dict[str, Any]) -> None:
        """Place response on Response_Queue with matching Correlation_ID."""
        try:
            # Determine status
            status = "error" if "error" in response else "success"

            # Send message to Response_Queue
            self.sqs_client.send_message(
                QueueUrl=self.aws_config.response_queue_url,
                MessageBody=json.dumps(response),
                MessageAttributes={
                    "correlation_id": {"StringValue": correlation_id, "DataType": "String"},
                    "status": {"StringValue": status, "DataType": "String"},
                },
            )

            logger.info(f"Response enqueued for correlation_id {correlation_id}")

        except ClientError as e:
            logger.error(f"Failed to enqueue response: {e}")
            # Retry once
            try:
                self.sqs_client.send_message(
                    QueueUrl=self.aws_config.response_queue_url,
                    MessageBody=json.dumps(response),
                    MessageAttributes={
                        "correlation_id": {"StringValue": correlation_id, "DataType": "String"},
                        "status": {"StringValue": status, "DataType": "String"},
                    },
                )
            except ClientError as retry_error:
                logger.error(f"Failed to enqueue response after retry: {retry_error}")

    def handle_ollama_error(self, correlation_id: str, error: str) -> None:
        """Enqueue error response, continue polling."""
        error_response = {
            "error": "ollama_error",
            "message": error,
        }
        self.enqueue_response(correlation_id, error_response)
        logger.warning(f"Error response enqueued for {correlation_id}: {error}")

    def shutdown(self) -> None:
        """Mark session as terminated in State_Store."""
        self.running = False

        try:
            if self.session_id:
                self.state_table.update_item(
                    Key={"PK": f"SESSION#{self.session_id}", "SK": "META"},
                    UpdateExpression="SET #status = :status",
                    ExpressionAttributeNames={"#status": "status"},
                    ExpressionAttributeValues={":status": "terminated"},
                )

                logger.info(f"Session {self.session_id} marked as terminated")
        except ClientError as e:
            logger.error(f"Failed to terminate session: {e}")

        # Wait for heartbeat thread to finish
        if self.heartbeat_thread:
            self.heartbeat_thread.join(timeout=5)

        logger.info("Worker shutdown complete")
