import React from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { DevPanel } from '../components/DevPanel';
import { initDevTools } from '../utils/devTools';

// Initialize dev tools on app startup
if (typeof window !== 'undefined') {
  initDevTools();
}

/**
 * Root component that wraps the entire Docusaurus app
 * Provides error boundary and development tools
 */
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      {children}
      <DevPanel />
    </ErrorBoundary>
  );
}
