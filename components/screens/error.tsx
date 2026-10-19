'use client';

import { useGame } from '@/components/game-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

export function ErrorScreen() {
  const { error, clearError, backHome } = useGame();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 safe-area">
      <div className="w-full max-w-md space-y-4">
        <Card className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
          <div className="flex justify-center mb-3">
            <AlertCircle className="h-8 w-8 text-red-400" aria-hidden="true" />
          </div>
          <CardTitle>Something went wrong</CardTitle>
          {error && (
            <p className="text-sm text-white/70 mt-3">{error.message}</p>
          )}
          <div className="flex flex-col gap-2 mt-6">
            {error?.retryable && (
              <Button onClick={() => clearError()} variant="outline" className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
                Try Again
              </Button>
            )}
            <Button onClick={() => backHome()} variant="ghost" className="w-full">
              <Home className="h-4 w-4 mr-2" aria-hidden="true" />
              Back Home
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
