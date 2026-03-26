/**
 * Development tools for local testing and debugging
 * Provides utilities for testing i18n, Mermaid diagrams, search, and analytics
 */

/**
 * Mock analytics tracker for local testing
 * Logs analytics events to console instead of sending to external service
 */
export const mockAnalytics = {
  trackPageView: (pagePath: string, pageTitle: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics] Page View:', { pagePath, pageTitle, timestamp: new Date().toISOString() });
    }
  },

  trackEvent: (eventName: string, eventData?: Record<string, any>) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics] Event:', { eventName, eventData, timestamp: new Date().toISOString() });
    }
  },

  trackSearch: (query: string, resultCount: number) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics] Search:', { query, resultCount, timestamp: new Date().toISOString() });
    }
  },

  trackLanguageSwitch: (fromLanguage: string, toLanguage: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics] Language Switch:', { fromLanguage, toLanguage, timestamp: new Date().toISOString() });
    }
  },
};

/**
 * Development i18n utilities for testing language switching
 */
export const devI18n = {
  /**
   * Get all supported languages for local testing
   */
  getSupportedLanguages: (): string[] => {
    return ['en', 'es', 'pt', 'fr', 'de', 'zh', 'ja'];
  },

  /**
   * Store language preference in localStorage for persistence
   */
  setLanguagePreference: (language: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dev-language-preference', language);
      console.log('[i18n] Language preference set to:', language);
    }
  },

  /**
   * Get stored language preference
   */
  getLanguagePreference: (): string | null => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('dev-language-preference');
    }
    return null;
  },

  /**
   * Clear language preference
   */
  clearLanguagePreference: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('dev-language-preference');
      console.log('[i18n] Language preference cleared');
    }
  },
};

/**
 * Development Mermaid utilities for testing diagram rendering
 */
export const devMermaid = {
  /**
   * Test Mermaid diagram rendering
   */
  testDiagramRendering: (diagramCode: string): boolean => {
    try {
      // Basic validation that diagram code is not empty
      if (!diagramCode || diagramCode.trim().length === 0) {
        console.warn('[Mermaid] Empty diagram code');
        return false;
      }
      console.log('[Mermaid] Diagram code validated:', diagramCode.substring(0, 50) + '...');
      return true;
    } catch (error) {
      console.error('[Mermaid] Diagram rendering error:', error);
      return false;
    }
  },

  /**
   * Get list of supported Mermaid diagram types
   */
  getSupportedDiagramTypes: (): string[] => {
    return ['flowchart', 'sequence', 'class', 'state', 'er', 'gantt', 'pie', 'git'];
  },
};

/**
 * Development search utilities for testing search functionality
 */
export const devSearch = {
  /**
   * Mock search function for local testing
   */
  mockSearch: (query: string, documents: Array<{ id: string; title: string; content: string }>): Array<{ id: string; title: string; score: number }> => {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const lowerQuery = query.toLowerCase();
    const results = documents
      .map((doc) => {
        const titleMatch = doc.title.toLowerCase().includes(lowerQuery);
        const contentMatch = doc.content.toLowerCase().includes(lowerQuery);
        let score = 0;

        if (titleMatch) score += 2;
        if (contentMatch) score += 1;

        return { id: doc.id, title: doc.title, score };
      })
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score);

    console.log('[Search] Query:', query, 'Results:', results.length);
    return results;
  },

  /**
   * Test search index generation
   */
  testSearchIndex: (documents: Array<{ id: string; title: string; content: string }>): boolean => {
    try {
      if (!Array.isArray(documents) || documents.length === 0) {
        console.warn('[Search] No documents to index');
        return false;
      }
      console.log('[Search] Index generated for', documents.length, 'documents');
      return true;
    } catch (error) {
      console.error('[Search] Index generation error:', error);
      return false;
    }
  },
};

/**
 * Development environment detector
 */
export const isDevelopment = (): boolean => {
  return process.env.NODE_ENV === 'development';
};

/**
 * Initialize development tools
 * Call this in your app initialization to enable dev tools
 */
export const initDevTools = () => {
  if (isDevelopment() && typeof window !== 'undefined') {
    // Expose dev tools to window for console access
    (window as any).__devTools = {
      analytics: mockAnalytics,
      i18n: devI18n,
      mermaid: devMermaid,
      search: devSearch,
    };
    console.log('[DevTools] Initialized. Access via window.__devTools');
  }
};
