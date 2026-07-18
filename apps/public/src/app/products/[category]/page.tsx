import CategoryProductsPage from "./_client";

const ALL_CATEGORIES = [
  "rings", "earrings", "necklaces", "bracelets",
  "pendants", "nosepins", "mangalsutra", "brooch",
  "jewel-set",
];

export async function generateStaticParams() {
  return ALL_CATEGORIES.map((category) => ({ category }));
}

export default function Page() {
  return <CategoryProductsPage />;
}
