"use client";

import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background">
          <div className="text-center max-w-md">
            <div className="text-6xl mb-4">😵</div>
            <h1 className="text-2xl font-black mb-2">Something went wrong</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Don&apos;t worry — your data is safe. This is a temporary hiccup. Try reloading the page.
            </p>
            {this.state.error?.message && (
              <pre className="text-xs text-left bg-muted p-3 rounded-lg mb-4 overflow-auto max-h-32">
                {this.state.error.message}
              </pre>
            )}
            <Button
              className="bg-brand hover:bg-brand-dark text-white"
              onClick={() => window.location.reload()}
            >
              🔄 Reload Page
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
