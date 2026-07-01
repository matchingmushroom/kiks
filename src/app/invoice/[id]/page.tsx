import PublicInvoicePage from "./_client";

export async function generateStaticParams() {
  try {
    const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    const project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/invoices?key=${key}&pageSize=500`);
    const data = await res.json();
    const ids = (data.documents || []).map((doc: any) => ({ id: doc.name.split("/").pop() }));
    return ids.length > 0 ? ids : [{ id: "placeholder" }];
  } catch {
    return [{ id: "placeholder" }];
  }
}

export default function Page() {
  return <PublicInvoicePage />;
}
