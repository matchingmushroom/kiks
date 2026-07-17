"use client";

import { useState, useEffect, useContext } from "react";
import {
  collection,
  query,
  getDocs,
  where,
  orderBy,
  limit,
  onSnapshot,
  QueryConstraint,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DataCacheContext } from "@/contexts/DataCacheContext";

interface UseFirestoreOptions {
  constraints?: QueryConstraint[];
  realtime?: boolean;
  cache?: boolean;
}

export function useFirestore<T>(
  collectionName: string,
  options: UseFirestoreOptions = {}
) {
  const { constraints = [], realtime = true, cache = false } = options;
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dataCache = useContext(DataCacheContext);
  const cacheKey = collectionName + "|" + JSON.stringify(constraints);

  useEffect(() => {
    if (!realtime && cache && dataCache) {
      const cached = dataCache.getCached<T>(cacheKey);
      if (cached) {
        setData(cached);
        setLoading(false);
        return;
      }
    }
  }, [cacheKey, cache, realtime, dataCache]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const q = query(collection(db, collectionName), ...constraints);

    if (realtime) {
      const unsub = onSnapshot(
        q,
        (snapshot) => {
          if (cancelled) return;
          const docs = snapshot.docs.map((d) => ({ ...d.data(), id: d.id, uid: d.id } as T));
          setData(docs);
          setLoading(false);
        },
        (err) => {
          if (cancelled) return;
          setError(err.message);
          setLoading(false);
        }
      );
      return () => { cancelled = true; unsub(); };
    }

    getDocs(q).then((snapshot) => {
      if (cancelled) return;
      const docs = snapshot.docs.map((d) => ({ ...d.data(), id: d.id, uid: d.id } as T));
      if (cache && dataCache) dataCache.setCached(cacheKey, docs);
      setData(docs);
      setLoading(false);
    }).catch((err) => {
      if (cancelled) return;
      setError(err.message);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [collectionName, JSON.stringify(constraints), realtime, cache, cacheKey, dataCache]);

  return { data, loading, error };
}

export { where, orderBy, limit, Timestamp };
export { useDataCache } from "@/contexts/DataCacheContext";
