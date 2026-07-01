import CategoryProductsPage from "./_client";

export async function generateStaticParams() {
  return [{ category: "placeholder" }];
}

export default function Page() {
  return <CategoryProductsPage />;
}
