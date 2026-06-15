export function generateStaticParams() {
  return [{ id: "demo-inv-001" }];
}

export default function InvoiceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
