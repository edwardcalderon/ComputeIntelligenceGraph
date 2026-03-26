import React, { useState } from 'react';
import { devI18n, devMermaid, devSearch, mockAnalytics, isDevelopment } from '../utils/devTools';
import styles from './DevPanel.module.css';

/**
 * Development panel component for local testing
 * Only visible in development mode
 * Provides UI for testing i18n, Mermaid, search, and analytics
 */
export const DevPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'i18n' | 'mermaid' | 'search' | 'analytics'>('i18n');
  const [selectedLanguage, setSelectedLanguage] = useState(devI18n.getLanguagePreference() || 'en');
  const [mermaidCode, setMermaidCode] = useState('graph TD\n  A[Start] --> B[End]');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; title: string; score: number }>>([]);

  if (!isDevelopment()) {
    return null;
  }

  const handleLanguageChange = (lang: string) => {
    setSelectedLanguage(lang);
    devI18n.setLanguagePreference(lang);
    mockAnalytics.trackLanguageSwitch(selectedLanguage, lang);
  };

  const handleTestMermaid = () => {
    const isValid = devMermaid.testDiagramRendering(mermaidCode);
    if (isValid) {
      alert('✓ Mermaid diagram code is valid');
    } else {
      alert('✗ Mermaid diagram code is invalid');
    }
  };

  const handleTestSearch = () => {
    // Mock documents for testing
    const mockDocs = [
      { id: '1', title: 'Getting Started', content: 'Learn how to get started with CIG' },
      { id: '2', title: 'Architecture Guide', content: 'Understanding the system architecture' },
      { id: '3', title: 'API Reference', content: 'Complete API documentation' },
    ];
    const results = devSearch.mockSearch(searchQuery, mockDocs);
    setSearchResults(results);
    mockAnalytics.trackSearch(searchQuery, results.length);
  };

  const handleTrackEvent = () => {
    mockAnalytics.trackEvent('dev-panel-test', { timestamp: new Date().toISOString() });
    alert('✓ Event tracked (check console)');
  };

  return (
    <div className={styles.devPanel}>
      <button
        className={styles.toggleButton}
        onClick={() => setIsOpen(!isOpen)}
        title="Toggle Development Panel"
      >
        {isOpen ? '✕' : '⚙️'}
      </button>

      {isOpen && (
        <div className={styles.panelContent}>
          <h3 className={styles.title}>Development Tools</h3>

          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === 'i18n' ? styles.active : ''}`}
              onClick={() => setActiveTab('i18n')}
            >
              i18n
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'mermaid' ? styles.active : ''}`}
              onClick={() => setActiveTab('mermaid')}
            >
              Mermaid
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'search' ? styles.active : ''}`}
              onClick={() => setActiveTab('search')}
            >
              Search
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'analytics' ? styles.active : ''}`}
              onClick={() => setActiveTab('analytics')}
            >
              Analytics
            </button>
          </div>

          <div className={styles.tabContent}>
            {activeTab === 'i18n' && (
              <div>
                <h4>Language Switching</h4>
                <p>Current: <strong>{selectedLanguage}</strong></p>
                <div className={styles.buttonGroup}>
                  {devI18n.getSupportedLanguages().map((lang) => (
                    <button
                      key={lang}
                      className={`${styles.langButton} ${selectedLanguage === lang ? styles.active : ''}`}
                      onClick={() => handleLanguageChange(lang)}
                    >
                      {lang.toUpperCase()}
                    </button>
                  ))}
                </div>
                <p className={styles.info}>
                  Language preference is stored in localStorage
                </p>
              </div>
            )}

            {activeTab === 'mermaid' && (
              <div>
                <h4>Mermaid Diagram Testing</h4>
                <textarea
                  className={styles.textarea}
                  value={mermaidCode}
                  onChange={(e) => setMermaidCode(e.target.value)}
                  placeholder="Enter Mermaid diagram code"
                />
                <button className={styles.button} onClick={handleTestMermaid}>
                  Test Diagram
                </button>
                <p className={styles.info}>
                  Supported types: {devMermaid.getSupportedDiagramTypes().join(', ')}
                </p>
              </div>
            )}

            {activeTab === 'search' && (
              <div>
                <h4>Search Functionality</h4>
                <input
                  type="text"
                  className={styles.input}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter search query"
                />
                <button className={styles.button} onClick={handleTestSearch}>
                  Test Search
                </button>
                {searchResults.length > 0 && (
                  <div className={styles.results}>
                    <p><strong>Results ({searchResults.length}):</strong></p>
                    <ul>
                      {searchResults.map((result) => (
                        <li key={result.id}>
                          {result.title} (score: {result.score})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'analytics' && (
              <div>
                <h4>Mock Analytics</h4>
                <p>Events are logged to browser console</p>
                <button className={styles.button} onClick={handleTrackEvent}>
                  Track Test Event
                </button>
                <p className={styles.info}>
                  Open DevTools console to see analytics logs
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
