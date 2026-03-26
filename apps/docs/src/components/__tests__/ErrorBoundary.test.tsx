import React from 'react';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

// Component that throws an error
const ThrowError = () => {
  throw new Error('Test error');
};

// Component that renders normally
const NormalComponent = () => {
  return React.createElement('div', null, 'Normal content');
};

describe('ErrorBoundary', () => {
  // Suppress console.error for these tests
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should render children when there is no error', () => {
    render(
      React.createElement(ErrorBoundary, null, React.createElement(NormalComponent))
    );

    expect(screen.getByText('Normal content')).toBeInTheDocument();
  });

  it('should catch errors and display error message', () => {
    render(
      React.createElement(ErrorBoundary, null, React.createElement(ThrowError))
    );

    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
  });

  it('should display error details in expandable section', () => {
    render(
      React.createElement(ErrorBoundary, null, React.createElement(ThrowError))
    );

    const details = screen.getByText(/Error Details/i);
    expect(details).toBeInTheDocument();
  });

  it('should display error message content', () => {
    render(
      React.createElement(ErrorBoundary, null, React.createElement(ThrowError))
    );

    expect(screen.getByText(/Test error/i)).toBeInTheDocument();
  });

  it('should display console hint', () => {
    render(
      React.createElement(ErrorBoundary, null, React.createElement(ThrowError))
    );

    expect(screen.getByText(/Check the browser console/i)).toBeInTheDocument();
  });

  it('should log error to console', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    render(
      React.createElement(ErrorBoundary, null, React.createElement(ThrowError))
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      'Error caught by boundary:',
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  it('should render multiple children without error', () => {
    render(
      React.createElement(
        ErrorBoundary,
        null,
        React.createElement('div', null, 'Child 1'),
        React.createElement('div', null, 'Child 2'),
        React.createElement('div', null, 'Child 3')
      )
    );

    expect(screen.getByText('Child 1')).toBeInTheDocument();
    expect(screen.getByText('Child 2')).toBeInTheDocument();
    expect(screen.getByText('Child 3')).toBeInTheDocument();
  });

  it('should have proper styling for error display', () => {
    const { container } = render(
      React.createElement(ErrorBoundary, null, React.createElement(ThrowError))
    );

    const errorDiv = container.querySelector('div[style*="border"]');
    expect(errorDiv).toBeInTheDocument();
  });
});
