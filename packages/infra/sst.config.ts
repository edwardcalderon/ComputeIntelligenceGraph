/// <reference path="./sst-env.d.ts" />

export default $config({
  app(input: { stage?: string }) {
    return {
      name: process.env.INFRA_APP_NAME ?? 'cig-api',
      removal: input?.stage === 'production' ? 'retain' : 'remove',
      protect: ['production'].includes(input?.stage ?? ''),
      home: 'aws',
      providers: {
        aws: {
          region: process.env.AWS_REGION ?? process.env.API_REGION ?? 'us-east-1',
        },
      },
    };
  },
  async run() {
    const { createInfrastructure } = await import('./infra.config.js');
    return createInfrastructure();
  },
});
