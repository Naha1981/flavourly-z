"use client";

import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">😵</div>
        <h1 className="text-2xl font-black mb-2">We hit a bump</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Something broke on this page. Your data is safe — try again.
        </p>
        <Button className="bg-brand hover:bg-brand-dark text-white" onClick={reset}>
          🔄 Try Again
        </Button>
      </div>
    </div>
  );
}
