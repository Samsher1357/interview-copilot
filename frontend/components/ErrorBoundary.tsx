'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorCount: number
}

export class ErrorBoundary extends Component<Props, State> {
  private errorTimeout: NodeJS.Timeout | null = null

  public state: State = {
    hasError: false,
    error: null,
    errorCount: 0,
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo)
    
    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo)
    
    // Increment error count
    this.setState(prev => ({ errorCount: prev.errorCount + 1 }))
    
    // Auto-reset after 10 seconds if error count is low
    if (this.state.errorCount < 3) {
      this.errorTimeout = setTimeout(() => {
        this.handleReset()
      }, 10000)
    }
  }

  public componentWillUnmount() {
    if (this.errorTimeout) {
      clearTimeout(this.errorTimeout)
    }
  }

  private readonly handleReset = () => {
    if (this.errorTimeout) {
      clearTimeout(this.errorTimeout)
    }
    this.setState({ hasError: false, error: null })
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      // If too many errors, suggest page reload
      const tooManyErrors = this.state.errorCount >= 3

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
              <svg
                className="w-6 h-6 text-red-600 dark:text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-center text-gray-900 dark:text-white mb-2">
              {tooManyErrors ? 'Multiple Errors Detected' : 'Something went wrong'}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-4">
              {tooManyErrors 
                ? 'The application has encountered multiple errors. Please reload the page.'
                : this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <div className="flex gap-3">
              {!tooManyErrors && (
                <button
                  onClick={this.handleReset}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  Try Again
                </button>
              )}
              <button
                onClick={() => globalThis.location.reload()}
                className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors"
              >
                Reload Page
              </button>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4 p-3 bg-gray-100 dark:bg-gray-900 rounded text-xs">
                <summary className="cursor-pointer font-medium text-gray-700 dark:text-gray-300">
                  Error Details (Count: {this.state.errorCount})
                </summary>
                <pre className="mt-2 text-red-600 dark:text-red-400 whitespace-pre-wrap break-words">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Hook to handle async errors in components
 * Usage: const handleAsyncError = useAsyncError()
 * Then: handleAsyncError(error) in catch blocks
 */
export function useAsyncError() {
  const [, setError] = React.useState()
  
  return React.useCallback((error: Error) => {
    setError(() => {
      throw error
    })
  }, [])
}
