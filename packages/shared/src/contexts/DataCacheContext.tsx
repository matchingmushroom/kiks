"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from "react";
import { collection, query, getDocs, QueryConstraint } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface CacheEntry {
  data: any[];
  timestamp: number;
}

interface DataCacheContextType {
  getCached: <T>(key: string) => T[] | null;
  setCached: (key: string, data: any[]) => void;
  refreshCollection: (key: string) => void;
  invalidateAll: () => void;
}

const TTL = 5 * 60 * 1000;

export const DataCacheContext = createContext<DataCacheContextType>({
  getCached: () => null,
  setCached: () => {},
  refreshCollection: () => {},
  invalidateAll: () => {},
});

export function DataCacheProvider({ children }: { children: ReactNode }) {
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const [, setTick] = useState(0);

  const getCached = useCallback(<T,>(key: string): T[] | null => {
    const entry = cacheRef.current.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > TTL) {
      cacheRef.current.delete(key);
      return null;
    }
    return entry.data as T[];
  }, []);

  const setCached = useCallback((key: string, data: any[]) => {
    cacheRef.current.set(key, { data, timestamp: Date.now() });
  }, []);

  const refreshCollection = useCallback((key: string) => {
    const prefix = key + "|";
    for (const k of cacheRef.current.keys()) {
      if (k === key || k.startsWith(prefix)) {
        cacheRef.current.delete(k);
      }
    }
  }, []);

  const invalidateAll = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  return (
    <DataCacheContext.Provider value={{ getCached, setCached, refreshCollection, invalidateAll }}>
      {children}
    </DataCacheContext.Provider>
  );
}

export function useDataCache() {
  return useContext(DataCacheContext);
}

export function useCachedCollection<T>(
  collectionName: string,
  constraints: QueryConstraint[] = []
) {
  const { getCached, setCached } = useDataCache();
  const [data, setData] = useState<T[]>(() => getCached<T>(collectionName) ?? []);
  const [loading, setLoading] = useState(() => getCached<T>(collectionName) === null);
  const [error, setError] = useState<string | null>(null);
  const cacheKey = collectionName + "|" + JSON.stringify(constraints);

  useEffect(() => {
    const cached = getCached<T>(cacheKey);
    if (cached) {
      setData(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const q = query(collection(db, collectionName), ...constraints);
    getDocs(q).then((snapshot) => {
      if (cancelled) return;
      const docs = snapshot.docs.map((d) => ({ ...d.data(), id: d.id, uid: d.id } as T));
      setCached(cacheKey, docs);
      setData(docs);
      setLoading(false);
    }).catch((err) => {
      if (cancelled) return;
      setError(err.message);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [cacheKey, collectionName, getCached, setCached, constraints]);

  return { data, loading, error };
}
