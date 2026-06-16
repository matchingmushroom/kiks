"use client";

import { useState, useEffect } from "react";
import { queryDocuments, QueryOptions } from "@/lib/firestoreRest";

export function useCollection<T>(collectionName: string, opts?: QueryOptions) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);

    (async () => {
      try {
        const docs = await queryDocuments<T>(collectionName, opts, controller.signal);
        if (!cancelled) setData(docs);
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Failed to load data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [collectionName, JSON.stringify(opts)]);

  return { data, loading, error };
}
