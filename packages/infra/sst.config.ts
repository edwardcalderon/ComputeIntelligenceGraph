/// <reference path="./sst-env.d.ts" />

import { loadInfraEnv, resolveAwsRegion } from './src/config/env.js';

loadInfraEnv();

export default $config({
  app(input: { stage?: string }) {
    return {
      name: process.env.INFRA_APP_NAME ?? 'cig-api',
      removal: input?.stage === 'production' ? 'retain' : 'remove',
      protect: ['production'].includes(input?.stage ?? ''),
      home: 'aws',
      providers: {
        aws: {
          region: resolveAwsRegion(),
        },
      },
    };
  },
  async run() {
    const { createInfrastructure } = await import('./infra.config.js');
    return createInfrastructure();
  },
});
