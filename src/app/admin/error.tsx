"use client";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("Admin error caught:", error.message, error.stack);
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
        <div className="text-center mb-4">
          <h1 className="text-xl font-bold text-secondary mb-2">Something went wrong</h1>
          <p className="text-sm text-primary font-medium mb-2">{error.message || "This page couldn't load."}</p>
          <p className="text-xs text-gray-400 mb-4 break-all">{error.digest}</p>
        </div>
        <details className="text-xs text-gray-500">
          <summary className="cursor-pointer text-primary">Stack trace</summary>
          <pre className="mt-2 whitespace-pre-wrap max-h-64 overflow-auto bg-gray-100 p-2 rounded">{error.stack}</pre>
        </details>
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
