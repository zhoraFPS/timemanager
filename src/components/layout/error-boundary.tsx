"use client";

import { Component, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
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

  render() {
    if (this.state.hasError) {
      return (
        <Card className="border-destructive/50">
          <CardContent className="p-8 text-center space-y-4">
            <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
            <div>
              <h2 className="text-lg font-semibold">Etwas ist schiefgelaufen</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {this.state.error?.message ?? "Unbekannter Fehler"}
              </p>
            </div>
            <Button onClick={() => this.setState({ hasError: false, error: null })}>
              Erneut versuchen
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}
