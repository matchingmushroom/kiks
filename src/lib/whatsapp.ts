import { CartItem } from "@/types";
import { formatNumber } from "@/lib/utils";

export function generateWhatsAppLink(
  phone: string,
  items: CartItem[],
  total: number,
  customerName: string,
  customerPhone: string,
  customerAddress: string,
  couponCode?: string,
  discount?: number,
  deliveryFee?: number,
  deliveryLocation?: string,
): string {
  const lines = items.map(
    (item) =>
      `• ${item.name} (ID: ${item.productId}) x${item.quantity} — Rs. ${formatNumber(item.price * item.quantity)}`
  );
  const messageParts = [
    `*New Order from ${customerName}*`,
    `Phone: ${customerPhone}`,
    `Address: ${customerAddress}`,
    "",
    ...lines,
    "",
  ];
  if (couponCode && discount && discount > 0) {
    messageParts.push(`*Coupon:* ${couponCode} (-Rs. ${formatNumber(discount)})`);
  }
  if (deliveryLocation) {
    const loc = deliveryLocation === "inside_valley" ? "Inside Valley" : "Outside Valley";
    const fee = deliveryFee && deliveryFee > 0 ? `Rs. ${formatNumber(deliveryFee)}` : "Free";
    messageParts.push(`*Delivery:* ${loc} (${fee})`);
  }
  messageParts.push("");
  messageParts.push(`*Total: Rs. ${formatNumber(total)}*`);
  messageParts.push("");
  messageParts.push("Thank you!");

  const message = messageParts.join("\n");
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${phone}?text=${encoded}`;
}

export function openWhatsApp(url: string): void {
  window.location.href = url;
}
