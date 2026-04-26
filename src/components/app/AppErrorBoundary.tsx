import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: unknown) {
    console.error("[AppErrorBoundary] Unhandled render error", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-6">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-destructive/10 p-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="space-y-2">
                <h1 className="text-lg font-semibold text-foreground">Something went wrong</h1>
                <p className="text-sm text-muted-foreground">
                  The app hit a rendering error. Reload to recover.
                </p>
              </div>
            </div>

            <div className="mt-5">
              <Button onClick={this.handleReload} className="gap-2">
                <RefreshCcw className="h-4 w-4" />
                Reload app
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
