import { db } from "@/lib/firebase";
import {
  collection, query, where, getDocs, writeBatch, doc, deleteDoc,
} from "firebase/firestore";

export interface AnonymizeResult {
  sales: number;
  invoices: number;
  orders: number;
  debtors: number;
  coupons: number;
  testimonials: { deleted: number; anonymized: number };
  total: number;
}

export async function anonymizeCustomerData(
  customerPhone: string,
  customerName: string,
  options?: { deleteTestimonials?: boolean }
): Promise<AnonymizeResult> {
  const result: AnonymizeResult = { sales: 0, invoices: 0, orders: 0, debtors: 0, coupons: 0, testimonials: { deleted: 0, anonymized: 0 }, total: 0 };
  if (!customerPhone) return result;

  const batch = writeBatch(db);
  let ops = 0;

  const addToBatch = (ref: any, data: any) => {
    if (ops >= 490) return;
    batch.update(ref, data);
    ops++;
  };

  // Sales
  const salesSnap = await getDocs(query(collection(db, "sales"), where("customer.phone", "==", customerPhone)));
  salesSnap.forEach((d) => {
    addToBatch(d.ref, {
      "customer.name": "[Deleted]",
      "customer.phone": "",
      "customer.address": "",
      "customer.email": "",
    });
  });
  result.sales = salesSnap.size;

  // Invoices
  const invoiceSnap = await getDocs(query(collection(db, "invoices"), where("customer.phone", "==", customerPhone)));
  invoiceSnap.forEach((d) => {
    addToBatch(d.ref, {
      "customer.name": "[Deleted]",
      "customer.phone": "",
      "customer.address": "",
    });
  });
  result.invoices = invoiceSnap.size;

  // Orders
  const orderSnap = await getDocs(query(collection(db, "orders"), where("customer.phone", "==", customerPhone)));
  orderSnap.forEach((d) => {
    addToBatch(d.ref, {
      "customer.name": "[Deleted]",
      "customer.phone": "",
      "customer.address": "",
    });
  });
  result.orders = orderSnap.size;

  // Debtors
  const debtorSnap = await getDocs(query(collection(db, "debtors"), where("customerPhone", "==", customerPhone)));
  debtorSnap.forEach((d) => {
    addToBatch(d.ref, { customerName: "[Deleted]", customerPhone: "", customerAddress: "" });
  });
  result.debtors = debtorSnap.size;

  // Coupons (issuedToCustomer.phone)
  const couponSnap = await getDocs(query(collection(db, "coupons"), where("issuedToCustomer.phone", "==", customerPhone)));
  couponSnap.forEach((d) => {
    addToBatch(d.ref, { "issuedToCustomer.name": "[Deleted]", "issuedToCustomer.phone": "", restrictedToPhones: [] });
  });
  result.coupons = couponSnap.size;

  // Testimonials
  const testimonialSnap = await getDocs(query(collection(db, "testimonials"), where("customerPhone", "==", customerPhone)));
  if (options?.deleteTestimonials) {
    for (const d of testimonialSnap.docs) {
      if (ops >= 490) break;
      batch.delete(d.ref);
      ops++;
    }
    result.testimonials.deleted = testimonialSnap.size;
  } else {
    testimonialSnap.forEach((d) => {
      addToBatch(d.ref, { customerName: "[Deleted]", customerPhone: "", customerPhoto: "" });
    });
    result.testimonials.anonymized = testimonialSnap.size;
  }

  result.total = result.sales + result.invoices + result.orders + result.debtors + result.coupons + testimonialSnap.size;

  if (ops > 0) await batch.commit();
  return result;
}

export async function deleteCustomerDocument(customerId: string) {
  await deleteDoc(doc(db, "customers", customerId));
}
