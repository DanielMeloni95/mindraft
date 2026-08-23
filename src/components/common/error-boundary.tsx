"use client";

import * as React from "react";

import { ErrorState } from "@/components/ui/error-state";

type Props = { children: React.ReactNode; fallbackMessage?: string };
type State = { error: Error | null };

/**
 * Keeps one broken widget (a canvas, an editor) from taking down the
 * whole page.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[boundary]", error.message);
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorState
          message={this.props.fallbackMessage ?? this.state.error.message}
          onRetry={() => this.setState({ error: null })}
        />
      );
    }
    return this.props.children;
  }
}
