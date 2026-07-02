import { doc, getDoc, setDoc, collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase";

export function toBase36(num: number): string {
  return num.toString(36).toUpperCase().padStart(5, "0");
}

export async function generateSkuV2(): Promise<string> {
  const counterRef = doc(db, "counters", "sku_base36");
  const snap = await getDoc(counterRef);
  const next = (snap.exists() ? snap.data().lastNumber : 0) + 1;
  await setDoc(counterRef, { lastNumber: next }, { merge: true });
  return toBase36(next);
}

export async function generateModelCode(categoryShortCode: string): Promise<string> {
  const counterRef = doc(db, "counters", `modelCode_${categoryShortCode}`);
  const snap = await getDoc(counterRef);
  const next = (snap.exists() ? snap.data().lastNumber : 0) + 1;
  await setDoc(counterRef, { lastNumber: next }, { merge: true });
  return `${categoryShortCode}-${String(next).padStart(3, "0")}`;
}

export async function findExistingModelCodes(categoryId: string): Promise<string[]> {
  const q = query(collection(db, "products"), where("categoryId", "==", categoryId));
  const snap = await getDocs(q);
  const codes = new Set<string>();
  snap.docs.forEach((d) => {
    const mc = d.data().modelCode;
    if (mc && typeof mc === "string") codes.add(mc);
  });
  return Array.from(codes).sort();
}

export async function generateBarcodeId(categoryShortCode: string): Promise<string> {
  const counterRef = doc(db, "counters", `barcode_${categoryShortCode}`);
  const snap = await getDoc(counterRef);
  const next = (snap.exists() ? snap.data().lastNumber : 0) + 1;
  await setDoc(counterRef, { lastNumber: next }, { merge: true });
  return `${categoryShortCode}-${String(next).padStart(4, "0")}`;
}

export function generateSku(barcodeId: string, costPrice: number, supplierShortCode: string, quantity: number): string {
  const cp = String(Math.floor(costPrice / 10) + 10).padStart(5, "0");
  return `${barcodeId}-${cp}-${supplierShortCode}${quantity}`;
}

export function generateModelNo(categoryShortCode: string, costPrice: number, quantity: number): string {
  const cp = String(Math.floor(costPrice / 10) + 10).padStart(5, "0");
  const qty = String(quantity).padStart(5, "0");
  return `M${categoryShortCode}-${cp}-${qty}`;
}

export async function generateShortCode(categoryShortCode: string, subCatIndex: number): Promise<string> {
  const extNum = subCatIndex;
  const counterKey = `shortCode_${categoryShortCode}_${extNum}`;
  const counterRef = doc(db, "counters", counterKey);
  const snap = await getDoc(counterRef);
  const next = (snap.exists() ? snap.data().lastNumber : 0) + 1;
  await setDoc(counterRef, { lastNumber: next }, { merge: true });
  return `${categoryShortCode}${extNum}-${next}`;
}
