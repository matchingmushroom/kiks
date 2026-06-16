import { CartItem } from "@/types";
import { formatNumber } from "@/lib/utils";

export function generateWhatsAppLink(
  phone: string,
  items: CartItem[],
  total: number,
  customerName: string,
  customerPhone: string,
  customerAddress: string,
): string {
  const lines = items.map(
    (item) =>
      `• ${item.name} (ID: ${item.productId}) x${item.quantity} — Rs. ${formatNumber(item.price * item.quantity)}`
  );
  const message = [
    `*New Order from ${customerName}*`,
    `Phone: ${customerPhone}`,
    `Address: ${customerAddress}`,
    "",
    ...lines,
    "",
    `*Total: Rs. ${formatNumber(total)}*`,
    "",
    "Thank you!",
  ].join("\n");

  const encoded = encodeURIComponent(message);
  return `https://wa.me/${phone}?text=${encoded}`;
}
