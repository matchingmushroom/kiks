import { CartItem } from "@/types";

export function generateWhatsAppLink(phone: string, items: CartItem[], total: number, customerName: string): string {
  const lines = items.map(
    (item) =>
      `• ${item.name} x${item.quantity} — Rs. ${(item.price * item.quantity).toLocaleString("ne-NP")}`
  );
  const message = [
    `*New Order from ${customerName}*`,
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
