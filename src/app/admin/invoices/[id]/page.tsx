import InvoiceDetailPage from "./_client";

export async function generateStaticParams() {
  return [{ id: "placeholder" }];
}

export default function Page() {
  return <InvoiceDetailPage />;
}
