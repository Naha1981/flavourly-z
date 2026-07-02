export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mx-auto mb-4 animate-pulse"
          style={{ background: "var(--brand)" }}
        >
          💡
        </div>
        <div className="text-sm text-muted-foreground">Loading Flavourly…</div>
      </div>
    </div>
  );
}
