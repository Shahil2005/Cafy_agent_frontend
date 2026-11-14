import React from 'react';
import { captureClientError } from '../../lib/observability/sentry';
import { isSentryEnabled } from '../../lib/observability/config';

interface State {
  hasError: boolean;
  errorId: string;
}

class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false, errorId: '' };

  static getDerivedStateFromError(): State {
    return { hasError: true, errorId: `ERR-${Date.now().toString(36).toUpperCase()}` };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Cafy] Uncaught error:', error, info.componentStack);
    if (isSentryEnabled()) {
      const sentryId = captureClientError(error, { componentStack: info.componentStack });
      if (typeof sentryId === 'string' && sentryId) {
        this.setState({ errorId: sentryId });
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 font-inter flex flex-col items-center justify-center p-4 relative overflow-hidden">

          <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] bg-[size:20px_20px] opacity-40 pointer-events-none" />

          <div className="relative z-10 flex flex-col items-center w-full max-w-md">

            <img src="/CAFY-Icon.svg" alt="Cafy" className="w-14 h-14 object-contain mb-6" />

            <div className="bg-white w-full rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 p-8 text-center">

              <div className="w-14 h-14 bg-red-50 border border-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
                <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>

              <h1 className="text-xl font-bold text-slate-900 mb-2 tracking-tight">
                Something went wrong
              </h1>
              <p className="text-slate-500 text-sm leading-relaxed mb-6">
                We hit an unexpected error. Your data is safe and nothing was lost.
                Refreshing the page usually fixes this.
              </p>

              <button
                onClick={() => window.location.reload()}
                className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold px-5 py-3 rounded-xl transition-colors shadow-sm"
              >
                Refresh page
              </button>

              <div className="border-t border-slate-100 mt-6 pt-5">
                <p className="text-xs text-slate-400 mb-1">Error reference</p>
                <p className="text-xs font-mono font-medium text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 inline-block mb-4">
                  {this.state.errorId}
                </p>
                <p className="text-xs text-slate-400">
                  If this keeps happening, please contact support with the error reference above.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-400 mt-6">
              © {new Date().getFullYear()} Cafy Careers. All rights reserved.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
