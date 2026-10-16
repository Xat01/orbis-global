"use client";

import React from "react";
import { ErrorState } from "@/components/ui/States";

interface Props {
  children: React.ReactNode;
  fallbackTitle: string;
}

interface State {
  error: string | null;
}

/** Isolates failures (e.g. map tiles/chunk failing) from the rest of the app. */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error.message : "render-failed" };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="space-y-2">
          <div className="rounded border border-warning/40 bg-amber-50 px-3 py-2 text-xs text-warning">
            {this.props.fallbackTitle}
          </div>
          <ErrorState error={this.state.error} />
        </div>
      );
    }
    return this.props.children;
  }
}
