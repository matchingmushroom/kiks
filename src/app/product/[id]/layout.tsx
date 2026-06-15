export function generateStaticParams() {
  return [
    { id: "demo-1" },
    { id: "demo-2" },
    { id: "demo-3" },
    { id: "demo-4" },
  ];
}

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return children;
}
