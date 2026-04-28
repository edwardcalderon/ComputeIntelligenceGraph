/**
 * MCP (Model Context Protocol) tool endpoints
 * GET /mcp/tools - list available MCP tools
 * POST /mcp/tools/:toolName - execute MCP tool
 * Validates: Requirements 5.4
 */

import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { formatErrorResponse } from '../schemas/error.js';

/**
 * Mock MCP tools registry
 * In a full implementation, this would be populated from a configuration or database
 */
interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const MCP_TOOLS: MCPTool[] = [
  {
    name: 'get_weather',
    description: 'Get current weather for a location',
    inputSchema: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'City name or coordinates',
        },
      },
      required: ['location'],
    },
  },
  {
    name: 'search_web',
    description: 'Search the web for information',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results',
          default: 10,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'calculate',
    description: 'Perform mathematical calculations',
    inputSchema: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'Mathematical expression to evaluate',
        },
      },
      required: ['expression'],
    },
  },
];

/**
 * Create a new Hono router for MCP endpoints
 */
export const createMCPRouter = () => {
  const router = new Hono();

  /**
   * GET /mcp/tools
   * Lists all available MCP tools
   * Validates: Requirement 5.4
   */
  router.get('/tools', async (c) => {
    const requestId = uuidv4();

    try {
      console.log('[MCP] GET /mcp/tools request received', {
        requestId,
        timestamp: new Date().toISOString(),
      });

      const response = {
        object: 'list',
        data: MCP_TOOLS.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
        count: MCP_TOOLS.length,
      };

      console.log('[MCP] Returning MCP tools list', {
        requestId,
        toolCount: MCP_TOOLS.length,
        timestamp: new Date().toISOString(),
      });

      return c.json(response, 200);
    } catch (error) {
      console.error('[MCP] Unexpected error in tools list handler', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      const errorResponse = formatErrorResponse(
        'internal_error',
        'An unexpected error occurred while listing MCP tools',
        'INTERNAL_ERROR',
        requestId,
      );

      return c.json(errorResponse, 500);
    }
  });

  /**
   * POST /mcp/tools/:toolName
   * Executes a specific MCP tool with provided arguments
   * Validates: Requirement 5.4
   */
  router.post('/tools/:toolName', async (c) => {
    const requestId = uuidv4();
    const toolName = c.req.param('toolName');

    try {
      console.log('[MCP] POST /mcp/tools/:toolName request received', {
        requestId,
        toolName,
        timestamp: new Date().toISOString(),
      });

      // Find the requested tool
      const tool = MCP_TOOLS.find((t) => t.name === toolName);

      if (!tool) {
        console.warn('[MCP] Tool not found', {
          requestId,
          toolName,
        });

        const errorResponse = formatErrorResponse(
          'tool_not_found',
          `MCP tool '${toolName}' not found`,
          'TOOL_NOT_FOUND',
          requestId,
        );

        return c.json(errorResponse, 404);
      }

      // Parse request body
      let toolArgs: Record<string, unknown>;
      try {
        toolArgs = await c.req.json();
      } catch (error) {
        console.warn('[MCP] Invalid JSON in request body', {
          requestId,
          toolName,
          error: error instanceof Error ? error.message : String(error),
        });

        const errorResponse = formatErrorResponse(
          'invalid_request',
          'Invalid JSON in request body',
          'INVALID_REQUEST',
          requestId,
        );

        return c.json(errorResponse, 400);
      }

      // Validate required arguments
      const schema = tool.inputSchema as {
        required?: string[];
        properties?: Record<string, unknown>;
      };
      if (schema.required) {
        for (const requiredArg of schema.required) {
          if (!(requiredArg in toolArgs)) {
            console.warn('[MCP] Missing required argument', {
              requestId,
              toolName,
              missingArg: requiredArg,
            });

            const errorResponse = formatErrorResponse(
              'invalid_request',
              `Missing required argument: ${requiredArg}`,
              'MISSING_ARGUMENT',
              requestId,
            );

            return c.json(errorResponse, 400);
          }
        }
      }

      // Execute the tool (mock implementation)
      const result = await executeMCPTool(toolName, toolArgs);

      const response = {
        toolName,
        status: 'success',
        result,
        executedAt: new Date().toISOString(),
      };

      console.log('[MCP] Tool executed successfully', {
        requestId,
        toolName,
        timestamp: new Date().toISOString(),
      });

      return c.json(response, 200);
    } catch (error) {
      console.error('[MCP] Unexpected error in tool execution handler', {
        requestId,
        toolName,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      const errorResponse = formatErrorResponse(
        'internal_error',
        'An unexpected error occurred while executing the MCP tool',
        'INTERNAL_ERROR',
        requestId,
      );

      return c.json(errorResponse, 500);
    }
  });

  return router;
};

/**
 * Mock implementation of MCP tool execution
 * In a full implementation, this would call actual tool implementations
 */
async function executeMCPTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  switch (toolName) {
    case 'get_weather':
      return {
        location: args.location,
        temperature: 72,
        condition: 'Partly Cloudy',
        humidity: 65,
      };

    case 'search_web':
      return {
        query: args.query,
        results: [
          {
            title: 'Example Result 1',
            url: 'https://example.com/1',
            snippet: 'This is an example search result.',
          },
          {
            title: 'Example Result 2',
            url: 'https://example.com/2',
            snippet: 'Another example search result.',
          },
        ],
        count: 2,
      };

    case 'calculate':
      // Simple mock calculation
      return {
        expression: args.expression,
        result: 42,
        note: 'Mock calculation result',
      };

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

/**
 * Export the router factory function for use in the main Hono app
 */
export default createMCPRouter;
