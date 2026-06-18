"use client";

import { useState, useEffect } from "react";
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

interface UseFirestoreOptions {
  constraints?: QueryConstraint[];
  realtime?: boolean;
}

export function useFirestore<T>(
  collectionName: string,
  options: UseFirestoreOptions = {}
) {
  const { constraints = [], realtime = true } = options;
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setData(docs);
      setLoading(false);
    }).catch((err) => {
      if (cancelled) return;
      setError(err.message);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [collectionName, JSON.stringify(constraints), realtime]);

  return { data, loading, error };
}

export { where, orderBy, limit, Timestamp };
