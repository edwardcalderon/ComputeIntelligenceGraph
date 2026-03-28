import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */
const sidebars: SidebarsConfig = {
  docsSidebar: [
    {
      type: 'category',
      label: 'Getting Started',
      items: [
        'en/getting-started/index',
        'en/getting-started/installation',
        'en/getting-started/quick-start',
      ],
    },
    {
      type: 'category',
      label: 'Architecture',
      items: [
        'en/architecture/index',
        'en/architecture/system-design',
        'en/architecture/components',
        'en/architecture/vector-store',
        'en/architecture/cli-current-state',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      items: [
        'en/reference/cli',
      ],
    },
    {
      type: 'category',
      label: 'API Reference',
      items: [
        'en/api-reference/index',
        'en/api-reference/endpoints',
      ],
    },
    {
      type: 'category',
      label: 'Deployment',
      items: [
        'en/deployment/README',
      ],
    },
    {
      type: 'category',
      label: 'Authentication',
      items: [
        'en/authentication/README',
      ],
    },
    {
      type: 'category',
      label: 'User Guide',
      items: [
        'en/user-guide/index',
        'en/user-guide/features',
      ],
    },
    {
      type: 'category',
      label: 'Developer Guide',
      items: [
        'en/developer-guide/index',
        'en/developer-guide/contributing',
      ],
    },
    {
      type: 'category',
      label: 'Troubleshooting',
      items: [
        'en/troubleshooting/index',
        'en/troubleshooting/common-issues',
      ],
    },
    {
      type: 'category',
      label: 'Legal',
      items: [
        'en/legal/index',
        'en/legal/terms-of-service',
        'en/legal/privacy-policy',
      ],
    },
    {
      type: 'category',
      label: 'Resources',
      items: [
        'en/project-status',
        'en/next-steps',
        'en/changelog/index',
        'en/faq/index',
      ],
    },
  ],
};

export default sidebars;
