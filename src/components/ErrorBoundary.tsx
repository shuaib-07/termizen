import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center select-none bg-card/40 rounded-xl border border-destructive/30">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive border border-destructive/20 mb-3">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-foreground mb-1">
            {this.props.fallbackTitle || "Something went wrong in this view"}
          </h3>
          <p className="text-xs text-muted-foreground max-w-md mb-4 font-mono break-all bg-background/50 p-2 rounded border border-border/40">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={this.handleReset}
            className="gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Reload View</span>
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
