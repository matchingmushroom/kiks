function genIds(prefix: string, start: number, end: number) {
  const ids: { id: string }[] = [];
  for (let i = start; i <= end; i++) ids.push({ id: `${prefix}-${String(i).padStart(3, "0")}` });
  return ids;
}

export function generateStaticParams() {
  return [
    ...genIds("rng", 1, 12),
    ...genIds("nck", 1, 10),
    ...genIds("ear", 1, 10),
    ...genIds("brl", 1, 10),
    ...genIds("pnd", 1, 8),
  ];
}

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return children;
}
