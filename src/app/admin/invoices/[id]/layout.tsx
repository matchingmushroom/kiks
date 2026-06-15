export function generateStaticParams() {
  // demo-inv-001 for backwards compat, inv-001 is the new seed
  return [{ id: "demo-inv-001" }, { id: "inv-001" }];
}

export default function InvoiceDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
