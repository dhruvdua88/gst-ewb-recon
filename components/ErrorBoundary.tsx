import React from 'react';

interface State { error: Error | null; }

/**
 * Catches render/runtime errors in the tree below it so a single bad component (a
 * malformed file, an unexpected data shape) shows an actionable message instead of a
 * blank white screen — with the error text so the user can report it.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('Reconciliation UI crashed:', error, info);
  }

  render(): React.ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white border border-red-200 rounded-2xl shadow-lg p-6">
          <h1 className="text-xl font-bold text-red-700">Something went wrong</h1>
          <p className="text-sm text-gray-600 mt-2">
            The app hit an unexpected error while processing. Your files never left your
            browser. Try reloading and re-uploading; if it persists, the message below
            helps pinpoint the cause.
          </p>
          <pre className="mt-3 text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-x-auto text-red-800 whitespace-pre-wrap">
            {this.state.error.message || String(this.state.error)}
          </pre>
          <button
            onClick={() => { this.setState({ error: null }); location.reload(); }}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
