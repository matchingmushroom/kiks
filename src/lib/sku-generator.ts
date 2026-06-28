export function generateSku(categoryShortCode: string, costPrice: number, supplierShortCode: string): string {
  const cp = String(Math.floor(costPrice / 10) + 10).padStart(5, "0");
  return `S${categoryShortCode}-${cp}-${supplierShortCode}`;
}

export function generateModelNo(categoryShortCode: string, costPrice: number, quantity: number): string {
  const cp = String(Math.floor(costPrice / 10) + 10).padStart(5, "0");
  const qty = String(quantity).padStart(5, "0");
  return `M${categoryShortCode}-${cp}-${qty}`;
}
