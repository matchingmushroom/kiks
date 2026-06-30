import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  DocumentData,
  QueryConstraint,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";

const collections = {
  users: "users",
  categories: "categories",
  products: "products",
  sections: "sections",
  orders: "orders",
  sales: "sales",
  invoices: "invoices",
  coupons: "coupons",
  debtors: "debtors",
  inventoryLogs: "inventory_logs",
  fifoLayers: "fifo_layers",
  settings: "shop_settings",
  counters: "counters",
  purchases: "purchases",
  expenses: "expenses",
  recurringExpenses: "recurring_expenses",
  accounts: "accounts",
  accountTransactions: "account_transactions",
  offers: "offers",
  creditors: "creditors",
  suppliers: "suppliers",
  customers: "customers",
};

function toTimestamp(date?: Date): Timestamp {
  return Timestamp.fromDate(date || new Date());
}

function fromDoc<T>(docSnap: DocumentData): T {
  return { id: docSnap.id, ...docSnap.data() } as T;
}

export async function getDocument<T>(collectionName: string, docId: string): Promise<T | null> {
  const docSnap = await getDoc(doc(db, collectionName, docId));
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as T;
}

export async function getDocuments<T>(
  collectionName: string,
  constraints: QueryConstraint[] = []
): Promise<T[]> {
  const q = query(collection(db, collectionName), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => fromDoc<T>(d));
}

export async function addDocument<T>(collectionName: string, data: Record<string, unknown>): Promise<string> {
  const docRef = await addDoc(collection(db, collectionName), {
    ...data,
    createdAt: toTimestamp(),
  } as DocumentData);
  return docRef.id;
}

export async function updateDocument(
  collectionName: string,
  docId: string,
  data: Record<string, unknown>
): Promise<void> {
  await updateDoc(doc(db, collectionName, docId), {
    ...data,
    updatedAt: toTimestamp(),
  } as DocumentData);
}

export async function deleteDocument(collectionName: string, docId: string): Promise<void> {
  await deleteDoc(doc(db, collectionName, docId));
}

export async function setDocument<T>(
  collectionName: string,
  docId: string,
  data: Record<string, unknown>
): Promise<void> {
  await setDoc(doc(db, collectionName, docId), {
    ...data,
    createdAt: toTimestamp(),
  } as DocumentData);
}

export async function getCounter(counterName: string, year: number): Promise<number> {
  const docRef = doc(db, collections.counters, `${counterName}_${year}`);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    await setDoc(docRef, { lastNumber: 1, year });
    return 1;
  }
  const current = docSnap.data().lastNumber || 0;
  const next = current + 1;
  await updateDoc(docRef, { lastNumber: next });
  return next;
}

export async function getShopSettings() {
  return getDocument<{
    shopName: string;
    tagline: string;
    logoUrl: string;
    phone: string;
    address: string;
    whatsappNumber: string;
    currency: string;
  }>(collections.settings, "config");
}

export {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  collections,
};
