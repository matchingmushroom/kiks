"use client";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const correlationId = error.digest || crypto.randomUUID?.() || Math.random().toString(36).slice(2, 10);
  console.error("Admin error [id=" + correlationId + "]:", error.message, error.stack);
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
        <div className="text-center mb-4">
          <h1 className="text-xl font-bold text-secondary mb-2">Something went wrong</h1>
          <p className="text-sm text-muted-foreground mb-2">An unexpected error occurred. Please try again.</p>
          <p className="text-xs text-gray-400">Reference: {correlationId}</p>
        </div>
        <div className="text-center mt-4">
          <button
            onClick={reset}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
