"use client";

import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { initializeShopData } from "@/lib/seed";
import { Shield, CheckCircle, AlertCircle } from "lucide-react";

export default function SetupPage() {
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleInit = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await initializeShopData();
      setResults(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Initialization failed");
    }
    setLoading(false);
  };

  const hasFailures = results.some((r) => r.startsWith("❌"));

  return (
    <AdminLayout>
      <div className="p-6 max-w-2xl">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-secondary">First-Time Setup</h1>
        </div>
        <p className="text-muted-foreground mb-6">
          Initialize default data for your shop — settings, categories, and homepage sections.
          Run this only once when setting up a new Firestore project.
        </p>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
          <strong>⚠️ Note:</strong> This will create default documents in Firestore.
          If documents already exist, they will be overwritten.
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}

        {results.length > 0 && (
          <div className={`rounded-xl p-4 mb-6 border ${hasFailures ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
            <div className="flex items-center gap-2 mb-2">
              {hasFailures ? (
                <AlertCircle className="h-5 w-5 text-red-500" />
              ) : (
                <CheckCircle className="h-5 w-5 text-green-500" />
              )}
              <span className="text-sm font-medium">{hasFailures ? "Some items failed" : "All data initialized"}</span>
            </div>
            <ul className="space-y-1">
              {results.map((r, i) => (
                <li key={i} className="text-sm">{r}</li>
              ))}
            </ul>
          </div>
        )}

        <Button onClick={handleInit} disabled={loading} variant="accent" size="lg">
          {loading ? "Initializing..." : "Initialize Shop Data"}
        </Button>
      </div>
    </AdminLayout>
  );
}
