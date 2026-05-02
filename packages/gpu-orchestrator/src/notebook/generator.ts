/**
 * Notebook generation and parsing for the GPU Orchestrator.
 *
 * Builds valid nbformat v4.5 Jupyter notebooks programmatically from
 * {@link NotebookParams}, embedding model name, AWS config, queue URLs,
 * and the worker script content into exactly 5 code cells.
 *
 * @module
 */

import type {
  NotebookCell,
  NotebookDocument,
  NotebookParams,
} from './types.js';

/**
 * Create a single code cell with the given source lines.
 *
 * Each cell starts with no outputs and a `null` execution count,
 * matching the nbformat v4.5 spec for an unexecuted cell.
 */
function makeCodeCell(source: string[]): NotebookCell {
  return {
    cell_type: 'code',
    metadata: {},
    source,
    outputs: [],
    execution_count: null,
  };
}

/**
 * Cell 1 — System dependencies and pip install.
 *
 * Installs `boto3` and `requests` via pip so the worker script can
 * communicate with AWS SQS / DynamoDB.
 */
function buildDepsCell(): NotebookCell {
  return makeCodeCell([
    '!apt-get update -qq && apt-get install -y -qq curl > /dev/null\n',
    '!pip install -q boto3 requests',
  ]);
}

/**
 * Cell 2 — Ollama installation via the official install script.
 *
 * Uses the canonical one-liner from https://ollama.com/install.sh.
 */
function buildOllamaInstallCell(): NotebookCell {
  return makeCodeCell([
    '!curl -fsSL https://ollama.com/install.sh | sh',
  ]);
}

/**
 * Cell 3 — Start Ollama server, pull the requested model, and verify.
 *
 * Starts the server in the background, waits for it to become ready,
 * pulls the model, and lists available models for verification.
 */
function buildOllamaSetupCell(modelName: string): NotebookCell {
  return makeCodeCell([
    'import subprocess, time\n',
    '\n',
    '# Start Ollama server in the background\n',
    'subprocess.Popen(["ollama", "serve"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)\n',
    'time.sleep(5)  # Wait for server to start\n',
    '\n',
    `!ollama pull ${modelName}\n`,
    '!ollama list',
  ]);
}

/**
 * Cell 4 — AWS credential and region configuration.
 *
 * Writes environment variables so that `boto3` inside the worker script
 * can locate the correct SQS queues and DynamoDB table.
 */
function buildAwsConfigCell(
  awsRegion: string,
  requestQueueUrl: string,
  responseQueueUrl: string,
  dynamoTableName: string,
): NotebookCell {
  return makeCodeCell([
    'import os\n',
    '\n',
    `os.environ["AWS_DEFAULT_REGION"] = "${awsRegion}"\n`,
    `os.environ["AWS_REGION"] = "${awsRegion}"\n`,
    `os.environ["REQUEST_QUEUE_URL"] = "${requestQueueUrl}"\n`,
    `os.environ["RESPONSE_QUEUE_URL"] = "${responseQueueUrl}"\n`,
    `os.environ["DYNAMO_TABLE_NAME"] = "${dynamoTableName}"`,
  ]);
}

/**
 * Cell 5 — Write the worker script to disk and execute it.
 *
 * The worker script content is embedded verbatim. It is written to
 * `/content/worker.py` and then executed with Python.
 */
function buildWorkerCell(workerScriptContent: string): NotebookCell {
  // Escape backslashes and triple-quotes so the content survives the
  // Python string literal round-trip.
  const escaped = workerScriptContent
    .replace(/\\/g, '\\\\')
    .replace(/"""/g, '\\"\\"\\"');

  return makeCodeCell([
    'worker_script = """\n',
    `${escaped}\n`,
    '"""\n',
    '\n',
    'with open("/content/worker.py", "w") as f:\n',
    '    f.write(worker_script)\n',
    '\n',
    '!python /content/worker.py',
  ]);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a complete Jupyter notebook (.ipynb) from the given parameters.
 *
 * The returned {@link NotebookDocument} contains exactly 5 code cells:
 *
 * 1. System deps + `pip install boto3 requests`
 * 2. Ollama install via `curl -fsSL https://ollama.com/install.sh | sh`
 * 3. Ollama start + `ollama pull <modelName>` + `ollama list`
 * 4. AWS credential / region configuration
 * 5. Worker script write + execution
 *
 * @param params - Notebook generation parameters.
 * @returns A valid nbformat v4.5 notebook document.
 */
export function generateNotebook(params: NotebookParams): NotebookDocument {
  const {
    modelName,
    awsRegion,
    requestQueueUrl,
    responseQueueUrl,
    dynamoTableName,
    workerScriptContent,
  } = params;

  return {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {
      kernelspec: {
        display_name: 'Python 3',
        language: 'python',
        name: 'python3',
      },
      language_info: {
        name: 'python',
        version: '3.10',
      },
    },
    cells: [
      buildDepsCell(),
      buildOllamaInstallCell(),
      buildOllamaSetupCell(modelName),
      buildAwsConfigCell(awsRegion, requestQueueUrl, responseQueueUrl, dynamoTableName),
      buildWorkerCell(workerScriptContent),
    ],
  };
}

/**
 * Parse a raw `.ipynb` JSON string into a {@link NotebookDocument}.
 *
 * Validates the top-level structure:
 * - `nbformat` must be `4`
 * - `nbformat_minor` must be `5`
 * - `cells` must be a non-empty array of objects with `cell_type` and `source`
 * - `metadata` must contain `kernelspec` and `language_info`
 *
 * @param json - Raw JSON string of a `.ipynb` file.
 * @returns The parsed and validated notebook document.
 * @throws {Error} If the JSON is malformed or the structure is invalid.
 */
export function parseNotebook(json: string): NotebookDocument {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON: unable to parse notebook content');
  }

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Invalid notebook: root must be a JSON object');
  }

  const obj = raw as Record<string, unknown>;

  // --- nbformat version ---------------------------------------------------
  if (obj.nbformat !== 4) {
    throw new Error(
      `Invalid notebook: expected nbformat 4, got ${String(obj.nbformat)}`,
    );
  }
  if (obj.nbformat_minor !== 5) {
    throw new Error(
      `Invalid notebook: expected nbformat_minor 5, got ${String(obj.nbformat_minor)}`,
    );
  }

  // --- metadata -----------------------------------------------------------
  if (typeof obj.metadata !== 'object' || obj.metadata === null) {
    throw new Error('Invalid notebook: missing or invalid metadata');
  }
  const meta = obj.metadata as Record<string, unknown>;
  if (typeof meta.kernelspec !== 'object' || meta.kernelspec === null) {
    throw new Error('Invalid notebook: missing metadata.kernelspec');
  }
  if (typeof meta.language_info !== 'object' || meta.language_info === null) {
    throw new Error('Invalid notebook: missing metadata.language_info');
  }

  // --- cells --------------------------------------------------------------
  if (!Array.isArray(obj.cells)) {
    throw new Error('Invalid notebook: cells must be an array');
  }
  if (obj.cells.length === 0) {
    throw new Error('Invalid notebook: cells array must not be empty');
  }

  for (let i = 0; i < obj.cells.length; i++) {
    const cell = obj.cells[i] as Record<string, unknown>;
    if (typeof cell !== 'object' || cell === null) {
      throw new Error(`Invalid notebook: cell at index ${i} is not an object`);
    }
    if (cell.cell_type !== 'code' && cell.cell_type !== 'markdown') {
      throw new Error(
        `Invalid notebook: cell at index ${i} has invalid cell_type "${String(cell.cell_type)}"`,
      );
    }
    if (!Array.isArray(cell.source)) {
      throw new Error(
        `Invalid notebook: cell at index ${i} has invalid source (expected array)`,
      );
    }
  }

  return obj as unknown as NotebookDocument;
}
