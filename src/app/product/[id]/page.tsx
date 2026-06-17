import ProductPage from "./_client";

export async function generateStaticParams() {
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  try {
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/products?key=${key}&pageSize=500`);
    const data = await res.json();
    return (data.documents || []).map((doc: any) => ({ id: doc.name.split("/").pop() }));
  } catch {
    return [];
  }
}

export default function Page() {
  return <ProductPage />;
}
