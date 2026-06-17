"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, query, where, orderBy, limit, QueryConstraint } from "firebase/firestore";
import { db } from "@/lib/firebase";

type FilterOp = "==" | "!=" | "<" | "<=" | ">" | ">=" | "array-contains";
type OrderDir = "asc" | "desc";

export interface QueryOptions {
  where?: [string, FilterOp, any][];
  orderBy?: [string, OrderDir];
  limit?: number;
}

const OP_MAP: Record<FilterOp, string> = {
  "==": "==",
  "!=": "!=",
  "<": "<",
  "<=": "<=",
  ">": ">",
  ">=": ">=",
  "array-contains": "array-contains",
};

export function useCollection<T>(collectionName: string, opts?: QueryOptions) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const constraints: QueryConstraint[] = [];
        if (opts?.where) {
          opts.where.forEach(([field, op, value]) => {
            constraints.push(where(field, OP_MAP[op] as any, value));
          });
        }
        if (opts?.orderBy) {
          constraints.push(orderBy(opts.orderBy[0], opts.orderBy[1]));
        }
        if (opts?.limit !== undefined) {
          constraints.push(limit(opts.limit));
        }

        const q = query(collection(db, collectionName), ...constraints);
        const snap = await getDocs(q);
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as T));
        if (!cancelled) setData(docs);
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Failed to load data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [collectionName, JSON.stringify(opts)]);

  return { data, loading, error };
}
