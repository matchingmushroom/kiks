import type { ShopSettings } from "@/types";

export function generateVCard(settings: ShopSettings): string {
  const lines: string[] = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${settings.shopName}`,
    `TEL:${settings.phone}`,
    `ADR:;;${settings.address};;;`,
  ];
  if (settings.website) lines.push(`URL:${settings.website}`);
  const socials: string[] = [];
  if (settings.facebook) socials.push(`Facebook: ${settings.facebook}`);
  if (settings.instagram) socials.push(`Instagram: ${settings.instagram}`);
  if (settings.youtube) socials.push(`YouTube: ${settings.youtube}`);
  if (settings.twitter) socials.push(`Twitter/X: ${settings.twitter}`);
  if (settings.tiktok) socials.push(`TikTok: ${settings.tiktok}`);
  if (socials.length) lines.push(`NOTE:${socials.join("\\n")}`);
  lines.push("END:VCARD");
  return lines.join("\n");
}

export function downloadVCard(settings: ShopSettings): void {
  const vcard = generateVCard(settings);
  const blob = new Blob([vcard], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${settings.shopName.replace(/\s+/g, "_")}_contact.vcf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
