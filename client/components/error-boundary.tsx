import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: { componentStack: string } | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="max-w-lg w-full">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle>Something went wrong</CardTitle>
              <CardDescription>
                We encountered an unexpected error. This has been logged and we'll look into it.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {this.state.error && (
                <div className="p-3 rounded-md bg-muted text-sm font-mono overflow-x-auto">
                  <p className="text-destructive font-medium">{this.state.error.message}</p>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Try refreshing the page or going back to the home page. If the problem persists, 
                please contact support.
              </p>
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row gap-2">
              <Button onClick={this.handleRetry} variant="outline" className="w-full sm:w-auto">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              <Button onClick={this.handleGoHome} variant="outline" className="w-full sm:w-auto">
                <Home className="h-4 w-4 mr-2" />
                Go Home
              </Button>
              <Button onClick={this.handleReload} className="w-full sm:w-auto">
                <RefreshCw className="h-4 w-4 mr-2" />
                Reload Page
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

interface ErrorMessageProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  showReload?: boolean;
}

export function ErrorMessage({ title = "Error", message, onRetry, showReload = true }: ErrorMessageProps) {
  return (
    <Card className="max-w-md mx-auto">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
      {(onRetry || showReload) && (
        <CardFooter className="flex gap-2">
          {onRetry && (
            <Button onClick={onRetry} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          )}
          {showReload && (
            <Button onClick={() => window.location.reload()} variant="ghost" size="sm">
              Reload Page
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}

interface QueryErrorProps {
  error: Error | null;
  onRetry?: () => void;
}

export function QueryError({ error, onRetry }: QueryErrorProps) {
  const getErrorMessage = (error: Error | null): string => {
    if (!error) return "An unexpected error occurred";
    
    const message = error.message.toLowerCase();
    
    if (message.includes("network") || message.includes("fetch")) {
      return "Unable to connect to the server. Please check your internet connection and try again.";
    }
    
    if (message.includes("401") || message.includes("unauthorized")) {
      return "Your session has expired. Please refresh the page to continue.";
    }
    
    if (message.includes("403") || message.includes("forbidden")) {
      return "You don't have permission to access this content.";
    }
    
    if (message.includes("404") || message.includes("not found")) {
      return "The requested content could not be found.";
    }
    
    if (message.includes("500") || message.includes("server")) {
      return "The server encountered an error. Please try again later.";
    }
    
    if (message.includes("timeout")) {
      return "The request took too long. Please check your connection and try again.";
    }
    
    return error.message || "Something went wrong. Please try again.";
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] p-6 text-center">
      <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <Bug className="h-6 w-6 text-destructive" />
      </div>
      <h3 className="font-semibold mb-2">Something went wrong</h3>
      <p className="text-sm text-muted-foreground max-w-md mb-4">
        {getErrorMessage(error)}
      </p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      )}
    </div>
  );
}
