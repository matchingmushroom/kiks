import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

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
