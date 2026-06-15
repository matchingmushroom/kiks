import { CartItem } from "@/types";

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
      `• ${item.name} (ID: ${item.productId}) x${item.quantity} — Rs. ${(item.price * item.quantity).toLocaleString("ne-NP")}`
  );
  const message = [
    `*New Order from ${customerName}*`,
    `Phone: ${customerPhone}`,
    `Address: ${customerAddress}`,
    "",
    ...lines,
    "",
    `*Total: Rs. ${total.toLocaleString("ne-NP")}*`,
    "",
    "Thank you!",
  ].join("\n");

  const encoded = encodeURIComponent(message);
  return `https://wa.me/${phone}?text=${encoded}`;
}
