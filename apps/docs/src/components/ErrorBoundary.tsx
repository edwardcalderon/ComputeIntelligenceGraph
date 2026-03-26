import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Error Boundary component for catching and displaying errors in development
 * Provides better error messages and stack traces for debugging
 */
export class ErrorBoundary extends React.Component<Props, State> {
  public constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error details to console for debugging
    console.error('Error caught by boundary:', error);
    console.error('Error info:', errorInfo);

    this.setState({
      error,
      errorInfo,
    });
  }

  public render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '20px',
            margin: '20px',
            border: '2px solid #ff6b6b',
            borderRadius: '8px',
            backgroundColor: '#ffe0e0',
            fontFamily: 'monospace',
            fontSize: '14px',
            color: '#c92a2a',
          }}
        >
          <h2 style={{ marginTop: 0, color: '#c92a2a' }}>
            ⚠️ Something went wrong
          </h2>
          <details style={{ whiteSpace: 'pre-wrap', marginBottom: '10px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
              Error Details
            </summary>
            {this.state.error && (
              <div style={{ marginTop: '10px' }}>
                <strong>Error:</strong>
                <div style={{ marginLeft: '10px', marginTop: '5px' }}>
                  {this.state.error.toString()}
                </div>
              </div>
            )}
            {this.state.errorInfo && (
              <div style={{ marginTop: '10px' }}>
                <strong>Stack Trace:</strong>
                <div style={{ marginLeft: '10px', marginTop: '5px' }}>
                  {this.state.errorInfo.componentStack}
                </div>
              </div>
            )}
          </details>
          <p style={{ marginBottom: 0, fontSize: '12px' }}>
            Check the browser console for more details. This error has been logged.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
