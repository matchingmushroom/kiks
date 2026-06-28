export function generateSku(shortCode: string, sequence: number): string {
  const seq = String(sequence).padStart(3, "0");
  return `${shortCode}-${seq}`;
}

export function generateModelNo(shortCode: string, sequence: number): string {
  const seq = String(sequence).padStart(3, "0");
  return `M-${shortCode}-${seq}`;
}

export function getNextSequence(existingProducts: { sku: string; categoryId: string }[], categoryId: string): number {
  const categoryProducts = existingProducts.filter((p) => p.categoryId === categoryId);
  if (categoryProducts.length === 0) return 1;
  const maxSeq = Math.max(
    ...categoryProducts.map((p) => {
      const parts = p.sku.split("-");
      const last = parts[parts.length - 1];
      return parseInt(last, 10) || 0;
    })
  );
  return maxSeq + 1;
}
