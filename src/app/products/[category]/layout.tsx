export function generateStaticParams() {
  return [
    { category: "rings" },
    { category: "necklaces" },
    { category: "earrings" },
    { category: "bracelets" },
  ];
}

export default function CategoryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
