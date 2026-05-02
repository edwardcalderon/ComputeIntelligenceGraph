/**
 * Jupyter notebook types following the nbformat v4.5 specification.
 *
 * @see https://nbformat.readthedocs.io/en/latest/format_description.html
 * @module
 */

/** Parameters used to generate a notebook with embedded configuration. */
export interface NotebookParams {
  /** Ollama model name to pull (e.g. "llama3.2"). */
  modelName: string;
  /** AWS region for credential configuration. */
  awsRegion: string;
  /** SQS request queue URL the worker polls for inference requests. */
  requestQueueUrl: string;
  /** SQS response queue URL the worker posts inference responses to. */
  responseQueueUrl: string;
  /** DynamoDB table name for session state and heartbeats. */
  dynamoTableName: string;
  /** Full content of the worker Python script to embed in the notebook. */
  workerScriptContent: string;
}

/** A single cell in a Jupyter notebook. */
export interface NotebookCell {
  /** Cell type — only `code` and `markdown` are used. */
  cell_type: 'code' | 'markdown';
  /** Arbitrary cell-level metadata. */
  metadata: Record<string, unknown>;
  /** Cell source lines. Each element is one line (may include trailing newline). */
  source: string[];
  /** Cell outputs (code cells only). */
  outputs?: unknown[];
  /** Execution count (code cells only). `null` means not yet executed. */
  execution_count?: number | null;
}

/** A complete Jupyter notebook document (nbformat v4.5). */
export interface NotebookDocument {
  /** Major notebook format version — always 4. */
  nbformat: 4;
  /** Minor notebook format version — always 5. */
  nbformat_minor: 5;
  /** Top-level notebook metadata. */
  metadata: {
    kernelspec: { display_name: string; language: string; name: string };
    language_info: { name: string; version: string };
  };
  /** Ordered list of notebook cells. */
  cells: NotebookCell[];
}
