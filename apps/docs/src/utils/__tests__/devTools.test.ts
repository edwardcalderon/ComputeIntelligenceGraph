import { devI18n, devMermaid, devSearch, mockAnalytics, isDevelopment } from '../devTools';

describe('Development Tools', () => {
  // Mock localStorage
  const localStorageMock = (() => {
    let store: Record<string, string> = {};

    return {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value.toString();
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
    };
  })();

  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
    });
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  describe('devI18n', () => {
    it('should return supported languages', () => {
      const languages = devI18n.getSupportedLanguages();
      expect(languages).toEqual(['en', 'es', 'pt', 'fr', 'de', 'zh', 'ja']);
      expect(languages.length).toBe(7);
    });

    it('should set and get language preference', () => {
      devI18n.setLanguagePreference('es');
      const preference = devI18n.getLanguagePreference();
      expect(preference).toBe('es');
    });

    it('should persist language preference in localStorage', () => {
      devI18n.setLanguagePreference('fr');
      expect(localStorage.getItem('dev-language-preference')).toBe('fr');
    });

    it('should clear language preference', () => {
      devI18n.setLanguagePreference('de');
      devI18n.clearLanguagePreference();
      expect(devI18n.getLanguagePreference()).toBeNull();
    });

    it('should handle multiple language switches', () => {
      const languages = devI18n.getSupportedLanguages();
      for (const lang of languages) {
        devI18n.setLanguagePreference(lang);
        expect(devI18n.getLanguagePreference()).toBe(lang);
      }
    });
  });

  describe('devMermaid', () => {
    it('should validate non-empty diagram code', () => {
      const result = devMermaid.testDiagramRendering('graph TD\n  A[Start] --> B[End]');
      expect(result).toBe(true);
    });

    it('should reject empty diagram code', () => {
      const result = devMermaid.testDiagramRendering('');
      expect(result).toBe(false);
    });

    it('should reject whitespace-only diagram code', () => {
      const result = devMermaid.testDiagramRendering('   \n  \n  ');
      expect(result).toBe(false);
    });

    it('should return supported diagram types', () => {
      const types = devMermaid.getSupportedDiagramTypes();
      expect(types).toEqual(['flowchart', 'sequence', 'class', 'state', 'er', 'gantt', 'pie', 'git']);
      expect(types.length).toBe(8);
    });

    it('should handle various diagram types', () => {
      const diagrams = [
        'flowchart TD\n  A --> B',
        'sequenceDiagram\n  A->>B: Hello',
        'classDiagram\n  class A',
        'stateDiagram\n  [*] --> A',
      ];

      for (const diagram of diagrams) {
        const result = devMermaid.testDiagramRendering(diagram);
        expect(result).toBe(true);
      }
    });
  });

  describe('devSearch', () => {
    const mockDocuments = [
      { id: '1', title: 'Getting Started', content: 'Learn how to get started with CIG' },
      { id: '2', title: 'Architecture Guide', content: 'Understanding the system architecture' },
      { id: '3', title: 'API Reference', content: 'Complete API documentation' },
    ];

    it('should return empty results for empty query', () => {
      const results = devSearch.mockSearch('', mockDocuments);
      expect(results).toEqual([]);
    });

    it('should find documents by title', () => {
      const results = devSearch.mockSearch('Getting', mockDocuments);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toContain('Getting');
    });

    it('should find documents by content', () => {
      const results = devSearch.mockSearch('architecture', mockDocuments);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should rank title matches higher than content matches', () => {
      const results = devSearch.mockSearch('Architecture', mockDocuments);
      // Architecture appears in both title and content of document 2
      const architectureDoc = results.find((r) => r.id === '2');
      expect(architectureDoc).toBeDefined();
      expect(architectureDoc?.score).toBeGreaterThan(1);
    });

    it('should be case-insensitive', () => {
      const resultsLower = devSearch.mockSearch('api', mockDocuments);
      const resultsUpper = devSearch.mockSearch('API', mockDocuments);
      expect(resultsLower.length).toBe(resultsUpper.length);
    });

    it('should validate search index', () => {
      const result = devSearch.testSearchIndex(mockDocuments);
      expect(result).toBe(true);
    });

    it('should reject empty document list', () => {
      const result = devSearch.testSearchIndex([]);
      expect(result).toBe(false);
    });

    it('should reject non-array input', () => {
      const result = devSearch.testSearchIndex(null as unknown as Array<{ id: string; title: string; content: string }>);
      expect(result).toBe(false);
    });
  });

  describe('mockAnalytics', () => {
    it('should track page views', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      mockAnalytics.trackPageView('/docs/getting-started', 'Getting Started');
      expect(consoleSpy).toHaveBeenCalled();
      process.env.NODE_ENV = originalEnv;
      consoleSpy.mockRestore();
    });

    it('should track events', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      mockAnalytics.trackEvent('test-event', { data: 'test' });
      expect(consoleSpy).toHaveBeenCalled();
      process.env.NODE_ENV = originalEnv;
      consoleSpy.mockRestore();
    });

    it('should track search', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      mockAnalytics.trackSearch('test query', 5);
      expect(consoleSpy).toHaveBeenCalled();
      process.env.NODE_ENV = originalEnv;
      consoleSpy.mockRestore();
    });

    it('should track language switches', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      mockAnalytics.trackLanguageSwitch('en', 'es');
      expect(consoleSpy).toHaveBeenCalled();
      process.env.NODE_ENV = originalEnv;
      consoleSpy.mockRestore();
    });
  });

  describe('isDevelopment', () => {
    it('should detect development environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      expect(isDevelopment()).toBe(true);
      process.env.NODE_ENV = originalEnv;
    });

    it('should detect non-development environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      expect(isDevelopment()).toBe(false);
      process.env.NODE_ENV = originalEnv;
    });
  });
});
