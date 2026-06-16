type FilterOp = "==" | "!=" | "<" | "<=" | ">" | ">=" | "array-contains";
type OrderDir = "asc" | "desc";

export interface QueryOptions {
  where?: [string, FilterOp, any][];
  orderBy?: [string, OrderDir];
  limit?: number;
}

function getVal(f: any): any {
  if (!f) return null;
  if (f.stringValue !== undefined) return f.stringValue;
  if (f.integerValue !== undefined) return Number(f.integerValue);
  if (f.doubleValue !== undefined) return Number(f.doubleValue);
  if (f.booleanValue !== undefined) return f.booleanValue;
  if (f.timestampValue) return new Date(f.timestampValue).getTime();
  if (f.arrayValue) return (f.arrayValue.values || []).map(getVal);
  if (f.mapValue) return Object.fromEntries(Object.entries(f.mapValue.fields || {}).map(([k, v]) => [k, getVal(v)]));
  return null;
}

function fieldsToObj(fields: Record<string, any>): any {
  const obj: Record<string, any> = {};
  for (const [key, value] of Object.entries(fields)) {
    obj[key] = getVal(value);
  }
  return obj;
}

function toFieldValue(value: any): Record<string, any> {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "number") return Number.isInteger(value) && Math.abs(value) < 2 ** 53
    ? { integerValue: String(value) }
    : { doubleValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(v => toFieldValue(v)) } };
  if (typeof value === "object" && value.constructor === Object)
    return { mapValue: { fields: toFields(value as Record<string, any>) } };
  return { nullValue: null };
}

function toFields(obj: Record<string, any>): Record<string, any> {
  const fields: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;
    fields[key] = toFieldValue(value);
  }
  return fields;
}

const OP_MAP: Record<FilterOp, string> = {
  "==": "EQUAL",
  "!=": "NOT_EQUAL",
  "<": "LESS_THAN",
  "<=": "LESS_THAN_OR_EQUAL",
  ">": "GREATER_THAN",
  ">=": "GREATER_THAN_OR_EQUAL",
  "array-contains": "ARRAY_CONTAINS",
};

const DIR_MAP: Record<OrderDir, string> = {
  asc: "ASCENDING",
  desc: "DESCENDING",
};

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function buildStructuredQuery(collection: string, opts?: QueryOptions) {
  const sq: any = { from: [{ collectionId: collection }] };

  if (opts?.where && opts.where.length > 0) {
    const filters: any[] = opts.where.map(([field, op, value]) => ({
      fieldFilter: {
        field: { fieldPath: field },
        op: OP_MAP[op],
        value: toFieldValue(value),
      },
    }));
    sq.where = filters.length === 1 ? filters[0] : { compositeFilter: { op: "AND", filters } };
  }

  if (opts?.orderBy) {
    sq.orderBy = [{
      field: { fieldPath: opts.orderBy[0] },
      direction: DIR_MAP[opts.orderBy[1]],
    }];
  }

  if (opts?.limit !== undefined) {
    sq.limit = opts.limit;
  }

  return sq;
}

export async function getDocument<T>(collection: string, docId: string, signal?: AbortSignal): Promise<T | null> {
  const res = await fetch(`${BASE}/${collection}/${docId}?key=${API_KEY}`, { signal });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const doc = await res.json();
  return { id: doc.name.split("/").pop(), ...fieldsToObj(doc.fields) } as T;
}

export async function queryDocuments<T>(collection: string, opts?: QueryOptions, signal?: AbortSignal): Promise<T[]> {
  const sq = buildStructuredQuery(collection, opts);
  const res = await fetch(`${BASE}:runQuery?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ structuredQuery: sq }),
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const results = await res.json();
  return results
    .filter((r: any) => r.document)
    .map((r: any) => ({ id: r.document.name.split("/").pop(), ...fieldsToObj(r.document.fields) }) as T);
}

export async function getAllDocuments<T>(collection: string, signal?: AbortSignal): Promise<T[]> {
  const res = await fetch(`${BASE}/${collection}?key=${API_KEY}`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data.documents || []).map((doc: any) => ({ id: doc.name.split("/").pop(), ...fieldsToObj(doc.fields) })) as T[];
}

export async function addDocument<T>(collection: string, data: Record<string, any>): Promise<string> {
  const res = await fetch(`${BASE}/${collection}?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields: toFields(data) }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HTTP ${res.status}: ${err}`);
  }
  const doc = await res.json();
  return doc.name.split("/").pop();
}

export async function addDocumentWithId<T>(collection: string, docId: string, data: Record<string, any>): Promise<void> {
  const res = await fetch(`${BASE}/${collection}/${docId}?key=${API_KEY}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields: toFields(data) }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HTTP ${res.status}: ${err}`);
  }
}

export async function updateDocument<T>(collection: string, docId: string, data: Record<string, any>): Promise<void> {
  const mask = Object.keys(data).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");
  const res = await fetch(`${BASE}/${collection}/${docId}?key=${API_KEY}&${mask}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields: toFields(data) }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HTTP ${res.status}: ${err}`);
  }
}
