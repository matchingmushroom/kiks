import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

export async function generateId(prefix: string): Promise<string> {
  const counterRef = doc(db, "counters", prefix);
  const snap = await getDoc(counterRef);
  let seq = 1;
  if (snap.exists()) {
    seq = (snap.data().lastNumber || 0) + 1;
  }
  await setDoc(counterRef, { lastNumber: seq }, { merge: true });
  return `${prefix}-${String(seq).padStart(4, "0")}`;
}
