/**
 * Cortex — Error Boundary
 *
 * Catches unhandled React errors and displays a fallback UI
 * instead of crashing the entire popup or options page.
 */

import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[Cortex] React error boundary caught:", error, info);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{
          padding: "24px",
          color: "#f87171",
          background: "#1a1a1a",
          borderRadius: "8px",
          fontFamily: "system-ui, sans-serif",
          fontSize: "14px",
          textAlign: "center",
        }}>
          <p style={{ fontWeight: 600, marginBottom: "8px" }}>Something went wrong</p>
          <p style={{ opacity: 0.7, fontSize: "12px" }}>
            {this.state.error?.message ?? "Unknown error"}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: "12px", padding: "6px 16px",
              background: "#7c6af7", color: "white",
              border: "none", borderRadius: "6px", cursor: "pointer",
              fontSize: "12px", fontWeight: 600,
            }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
