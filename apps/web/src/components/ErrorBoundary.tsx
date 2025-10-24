import { Component } from 'preact';
import type { ComponentChildren } from 'preact';

interface ErrorBoundaryProps {
  children: ComponentChildren;
  fallback?: ComponentChildren;
  onError?: (error: Error, errorInfo: any) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <div className="text-red-600 text-4xl mb-3">⚠️</div>
          <h3 className="text-lg font-semibold text-red-900 mb-2">
            Something went wrong
          </h3>
          <p className="text-sm text-red-700 mb-4">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Lightweight error boundary for widgets
export function WidgetErrorBoundary({ 
  children, 
  widgetName 
}: { 
  children: ComponentChildren; 
  widgetName?: string;
}) {
  return (
    <ErrorBoundary
      fallback={
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="text-yellow-600 text-2xl mr-3">⚠️</div>
            <div>
              <h4 className="text-sm font-semibold text-yellow-900 mb-1">
                Widget Error
              </h4>
              <p className="text-xs text-yellow-700">
                {widgetName ? `The ${widgetName} widget` : 'This widget'} encountered an error and couldn't load.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 text-xs text-yellow-800 hover:text-yellow-900 font-medium underline"
              >
                Reload page
              </button>
            </div>
          </div>
        </div>
      }
      onError={(error) => {
        console.error(`Widget error (${widgetName || 'unknown'}):`, error);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
