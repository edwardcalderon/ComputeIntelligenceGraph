/// <reference path="./.sst/types/index.ts" />

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      REQUEST_QUEUE_URL: string;
      RESPONSE_QUEUE_URL: string;
      STATE_TABLE_NAME: string;
      AWS_REGION: string;
    }
  }
}

export {};
