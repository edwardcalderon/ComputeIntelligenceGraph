import { test as base } from '@playwright/test';

/**
 * Mock API responses for testing
 */
export const mockApiResponses = {
  resources: {
    items: [
      {
        id: 'i-1234567890abcdef0',
        name: 'web-server-1',
        type: 'compute',
        provider: 'aws',
        region: 'us-east-1',
        state: 'active',
        tags: { Environment: 'production', Team: 'platform' }
      },
      {
        id: 'db-instance-1',
        name: 'production-db',
        type: 'database',
        provider: 'aws',
        region: 'us-east-1',
        state: 'active',
        tags: { Environment: 'production' }
      },
      {
        id: 'bucket-1',
        name: 'app-storage',
        type: 'storage',
        provider: 'aws',
        region: 'us-east-1',
        state: 'active',
        tags: {}
      }
    ],
    total: 3,
    hasMore: false
  },
  discoveryStatus: {
    running: false,
    lastRun: new Date().toISOString(),
    nextRun: new Date(Date.now() + 300000).toISOString()
  },
  relationships: {
    items: [
      {
        sourceId: 'i-1234567890abcdef0',
        targetId: 'db-instance-1',
        type: 'depends_on'
      },
      {
        sourceId: 'i-1234567890abcdef0',
        targetId: 'bucket-1',
        type: 'uses'
      }
    ]
  }
};

/**
 * Extended test with API mocking capabilities
 */
export const test = base.extend({
  // Add custom fixtures here if needed
});

export { expect } from '@playwright/test';
