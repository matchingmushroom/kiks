import SaleDetailPage from "./_client";

export async function generateStaticParams() {
  try {
    const { initializeApp, getApps } = await import("firebase/app");
    const { getFirestore, collection, getDocs } = await import("firebase/firestore");

    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };

    if (!firebaseConfig.projectId) return [{ id: "placeholder" }];

    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    const db = getFirestore(app);
    const snap = await getDocs(collection(db, "sales"));
    const ids = snap.docs.map((d) => ({ id: d.id }));
    return ids.length > 0 ? ids : [{ id: "placeholder" }];
  } catch {
    return [{ id: "placeholder" }];
  }
}

export default function Page() {
  return <SaleDetailPage />;
}
