/**
 * Development configuration for Docusaurus
 * Enables HMR, live reload, and error display for local development
 */

export const devConfig = {
  // Hot Module Reloading (HMR) for instant preview updates
  hmr: {
    enabled: true,
    protocol: 'ws',
    host: 'localhost',
    port: parseInt(process.env.PORT || '3000', 10),
  },

  // Live reload for markdown file changes
  liveReload: {
    enabled: true,
    watchFiles: ['docs/**/*.md', 'docs/**/*.mdx', 'src/**/*.tsx', 'src/**/*.ts'],
  },

  // Error display configuration
  errorDisplay: {
    showErrorOverlay: true,
    showErrorInConsole: true,
    showWarnings: false,
  },

  // Source maps for debugging
  sourceMaps: {
    enabled: true,
    includeSourceContent: true,
  },

  // Development server settings
  server: {
    host: '0.0.0.0',
    port: parseInt(process.env.PORT || '3000', 10),
    strictPort: false,
    open: false,
  },
};

export default devConfig;
