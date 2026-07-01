import CategoryProductsPage from "./_client";

export async function generateStaticParams() {
  try {
    const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    const project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/categories?key=${key}`);
    const data = await res.json();
    const cats = (data.documents || []).map((doc: any) => ({ category: doc.name.split("/").pop() }));
    return cats.length > 0 ? cats : [{ category: "placeholder" }];
  } catch {
    return [{ category: "placeholder" }];
  }
}

export default function Page() {
  return <CategoryProductsPage />;
}
