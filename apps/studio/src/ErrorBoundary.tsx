import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";

interface Props {
  children?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-slate-950 text-slate-100 p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 max-w-lg w-full flex flex-col items-center text-center shadow-2xl">
            <div className="w-16 h-16 bg-red-950/50 rounded-full flex items-center justify-center mb-6 border border-red-900/50">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-100 mb-2">Something went wrong</h2>
            <p className="text-sm text-slate-400 mb-6 bg-slate-950 p-4 rounded-lg border border-slate-800 w-full overflow-auto max-h-32 text-left font-mono break-words">
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <button
              onClick={this.handleReset}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold flex items-center gap-2 transition-colors shadow-lg shadow-emerald-900/20"
            >
              <RotateCcw className="w-4 h-4" /> Reset View
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
