/**
 * Property 1: Notebook Generation Round-Trip
 *
 * For any valid `NotebookParams`, generating a notebook via `generateNotebook()`
 * and then serializing with `JSON.stringify()` and parsing back with `JSON.parse()`
 * SHALL produce a structurally valid Jupyter notebook with `nbformat` equal to 4,
 * a non-empty `cells` array, and exactly 5 code cells.
 *
 * **Validates: Requirements 3.1, 3.6, 12.6**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { generateNotebook } from '../notebook/generator.js';
import type { NotebookParams } from '../notebook/types.js';

/**
 * Arbitrary for a valid `NotebookParams` object.
 *
 * Each field is constrained to produce values that survive JSON round-trips
 * without issues (no special chars that break JSON, non-empty strings, valid URLs).
 */
const arbNotebookParams: fc.Arbitrary<NotebookParams> = fc.record({
  modelName: fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,49}$/).filter(
    (s) => s.length > 0,
  ),
  awsRegion: fc.stringMatching(/^[a-z]{2}-[a-z]+-\d$/).filter(
    (s) => s.length > 0,
  ),
  requestQueueUrl: fc.webUrl({ withFragments: false, withQueryParameters: false }),
  responseQueueUrl: fc.webUrl({ withFragments: false, withQueryParameters: false }),
  dynamoTableName: fc.stringMatching(/^[a-zA-Z0-9_.-]{1,50}$/),
  workerScriptContent: fc
    .string({ minLength: 1, maxLength: 500 })
    .filter((s) => s.trim().length > 0),
});

describe('Property 1: Notebook Generation Round-Trip', () => {
  it('generateNotebook() → JSON.stringify() → JSON.parse() produces a valid notebook with nbformat 4, non-empty cells, and exactly 5 code cells', () => {
    fc.assert(
      fc.property(arbNotebookParams, (params) => {
        // Step 1: Generate the notebook
        const notebook = generateNotebook(params);

        // Step 2: Serialize to JSON
        const json = JSON.stringify(notebook);

        // Step 3: Parse back from JSON
        const parsed = JSON.parse(json);

        // Assert: nbformat === 4
        expect(parsed.nbformat).toBe(4);

        // Assert: nbformat_minor === 5
        expect(parsed.nbformat_minor).toBe(5);

        // Assert: cells is a non-empty array
        expect(Array.isArray(parsed.cells)).toBe(true);
        expect(parsed.cells.length).toBeGreaterThan(0);

        // Assert: exactly 5 cells
        expect(parsed.cells).toHaveLength(5);

        // Assert: all cells have cell_type === 'code'
        for (const cell of parsed.cells) {
          expect(cell.cell_type).toBe('code');
        }

        // Assert: all cells have a source array
        for (const cell of parsed.cells) {
          expect(Array.isArray(cell.source)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});


/**
 * Property 2: Notebook Parameterized Content Embedding
 *
 * For any valid `NotebookParams`, the generated notebook SHALL contain:
 * (a) a cell whose source includes `ollama pull` followed by the specified model name,
 * (b) a cell whose source includes the specified request queue URL and response queue URL,
 * (c) a cell whose source includes the Ollama install script URL.
 *
 * **Validates: Requirements 3.3, 3.4, 3.5**
 */

describe('Property 2: Notebook Parameterized Content Embedding', () => {
  /**
   * Arbitrary for a valid `NotebookParams` object.
   * Reuses the same constraints as Property 1 to ensure valid inputs.
   */
  const arbNotebookParamsForEmbedding: fc.Arbitrary<NotebookParams> = fc.record({
    modelName: fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,49}$/).filter(
      (s) => s.length > 0,
    ),
    awsRegion: fc.stringMatching(/^[a-z]{2}-[a-z]+-\d$/).filter(
      (s) => s.length > 0,
    ),
    requestQueueUrl: fc.webUrl({ withFragments: false, withQueryParameters: false }),
    responseQueueUrl: fc.webUrl({ withFragments: false, withQueryParameters: false }),
    dynamoTableName: fc.stringMatching(/^[a-zA-Z0-9_.-]{1,50}$/),
    workerScriptContent: fc
      .string({ minLength: 1, maxLength: 500 })
      .filter((s) => s.trim().length > 0),
  });

  it('generated notebook cells contain ollama pull <modelName>, request/response queue URLs, and the Ollama install script URL', () => {
    fc.assert(
      fc.property(arbNotebookParamsForEmbedding, (params) => {
        const notebook = generateNotebook(params);

        // Flatten all cell sources into a single string for searching
        const allSource = notebook.cells
          .flatMap((cell) => cell.source)
          .join('');

        // (a) Contains `ollama pull <modelName>` with the exact model name
        expect(allSource).toContain(`ollama pull ${params.modelName}`);

        // (b) Contains the request queue URL and response queue URL
        expect(allSource).toContain(params.requestQueueUrl);
        expect(allSource).toContain(params.responseQueueUrl);

        // (c) Contains the Ollama install script URL
        expect(allSource).toContain('https://ollama.com/install.sh');
      }),
      { numRuns: 100 },
    );
  });
});
