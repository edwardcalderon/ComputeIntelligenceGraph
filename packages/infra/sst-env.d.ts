/**
 * Lightweight SST v3 global declarations for the infra package.
 *
 * These stubs keep editor tooling functional without depending on generated
 * `.sst` types in source control.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

declare const sst: {
  aws: Record<string, any>;
  Secret: new (name: string) => { value: any };
  Linkable: { wrap: (value: any) => any };
  [key: string]: any;
};

declare const $app: {
  stage: string;
  name: string;
  [key: string]: any;
};

declare function $config(config: any): any;
