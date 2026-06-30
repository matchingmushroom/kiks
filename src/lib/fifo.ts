import { db } from "./firebase";
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, Timestamp, writeBatch,
} from "firebase/firestore";
import { FifoLayer } from "@/types";

const LAYERS_COLL = "fifo_layers";

export async function getLayers(productId: string): Promise<FifoLayer[]> {
  const q = query(
    collection(db, LAYERS_COLL),
    where("productId", "==", productId),
    orderBy("purchaseDate", "asc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FifoLayer));
}

export async function getActiveLayers(productId: string): Promise<FifoLayer[]> {
  const layers = await getLayers(productId);
  return layers.filter((l) => l.remainingQty > 0);
}

export async function createLayer(
  productId: string,
  purchaseId: string,
  purchaseDate: number,
  quantity: number,
  unitCost: number,
): Promise<string> {
  const ref = await addDoc(collection(db, LAYERS_COLL), {
    productId,
    purchaseId,
    purchaseDate,
    quantity,
    remainingQty: quantity,
    unitCost,
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function consumeFifo(
  productId: string,
  quantity: number,
): Promise<number> {
  if (quantity <= 0) return 0;
  const layers = await getActiveLayers(productId);
  let remaining = quantity;
  let totalCost = 0;
  const updates: { id: string; remainingQty: number }[] = [];

  for (const layer of layers) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, layer.remainingQty);
    remaining -= take;
    totalCost += take * layer.unitCost;
    updates.push({ id: layer.id, remainingQty: layer.remainingQty - take });
  }

  if (remaining > 0) {
    throw new Error(
      `Insufficient FIFO layers for product ${productId}. Needed ${quantity}, available ${quantity - remaining}`,
    );
  }

  const batch = writeBatch(db);
  for (const u of updates) {
    batch.update(doc(db, LAYERS_COLL, u.id), { remainingQty: u.remainingQty });
  }
  await batch.commit();

  return totalCost;
}

export async function restoreFifo(
  productId: string,
  quantity: number,
  unitCost: number,
): Promise<void> {
  if (quantity <= 0) return;
  const layers = await getLayers(productId);

  let remaining = quantity;
  const updates: { id: string; remainingQty: number }[] = [];

  for (const layer of layers.reverse()) {
    if (remaining <= 0) break;
    const originalMax = layer.quantity;
    const currentMax = layer.remainingQty + remaining;
    const restored = Math.min(remaining, originalMax - layer.remainingQty);
    if (restored <= 0) continue;
    remaining -= restored;
    updates.push({ id: layer.id, remainingQty: layer.remainingQty + restored });
  }

  if (remaining > 0) {
    const batch = writeBatch(db);
    for (const u of updates) {
      batch.update(doc(db, LAYERS_COLL, u.id), { remainingQty: u.remainingQty });
    }
    const ref = await addDoc(collection(db, LAYERS_COLL), {
      productId,
      purchaseId: "return",
      purchaseDate: Date.now(),
      quantity: remaining,
      remainingQty: remaining,
      unitCost,
      createdAt: Date.now(),
    });
    batch.commit();
    return;
  }

  const batch = writeBatch(db);
  for (const u of updates) {
    batch.update(doc(db, LAYERS_COLL, u.id), { remainingQty: u.remainingQty });
  }
  await batch.commit();
}

export async function syncLayersToPhysical(
  productId: string,
  physicalQty: number,
): Promise<void> {
  const layers = await getActiveLayers(productId);
  const systemQty = layers.reduce((s, l) => s + l.remainingQty, 0);
  const diff = physicalQty - systemQty;

  if (diff === 0) return;

  if (diff > 0) {
    const latest = layers[layers.length - 1];
    const unitCost = latest?.unitCost || 0;
    await addDoc(collection(db, LAYERS_COLL), {
      productId,
      purchaseId: "reconciliation",
      purchaseDate: Date.now(),
      quantity: diff,
      remainingQty: diff,
      unitCost,
      createdAt: Date.now(),
    });
  } else {
    const toRemove = Math.abs(diff);
    let remaining = toRemove;
    const batch = writeBatch(db);
    for (const layer of layers.reverse()) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, layer.remainingQty);
      remaining -= take;
      batch.update(doc(db, LAYERS_COLL, layer.id), {
        remainingQty: layer.remainingQty - take,
      });
    }
    await batch.commit();
  }
}

export async function getStockValue(productId: string): Promise<number> {
  const layers = await getActiveLayers(productId);
  return layers.reduce((s, l) => s + l.remainingQty * l.unitCost, 0);
}

export async function getStockValueFallback(
  productId: string,
  quantityInStock: number,
  costPrice: number,
): Promise<number> {
  const layers = await getActiveLayers(productId);
  if (layers.length > 0) {
    return layers.reduce((s, l) => s + l.remainingQty * l.unitCost, 0);
  }
  return quantityInStock * costPrice;
}
