import DateConverter from "@remotemerge/nepali-date-converter";

const NEPALI_MONTHS = [
  "Baishakh", "Jestha", "Ashad", "Shrawan", "Bhadra",
  "Ashwin", "Kartik", "Mangsir", "Poush", "Magh",
  "Falgun", "Chaitra",
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toBS(date: Date): { year: number; month: number; day: number; dayName: string } {
  const r = new DateConverter(dateStr(date)).toBs();
  return { year: r.year, month: r.month, day: r.date, dayName: r.day };
}

export function formatBS(date: Date): string {
  const bs = toBS(date);
  return `${bs.year} ${NEPALI_MONTHS[bs.month - 1]} ${pad(bs.day)}`;
}

export function formatBSDateTime(date: Date): string {
  const bs = toBS(date);
  const hours = date.getHours();
  const minutes = pad(date.getMinutes());
  const ampm = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 || 12;
  return `${bs.year} ${NEPALI_MONTHS[bs.month - 1]} ${pad(bs.day)}, ${h12}:${minutes} ${ampm}`;
}

export function getCurrentFYRange(): { start: Date; end: Date } {
  const now = new Date();
  const bs = toBS(now);
  const fyStartYear = bs.month >= 4 ? bs.year : bs.year - 1;
  const adStart = new DateConverter(`${fyStartYear}-04-01`).toAd();
  const adEnd = new DateConverter(`${fyStartYear + 1}-03-32`).toAd();
  return {
    start: new Date(adStart.year, adStart.month - 1, adStart.date),
    end: new Date(adEnd.year, adEnd.month - 1, adEnd.date),
  };
}

export function getPreviousFYRange(): { start: Date; end: Date } {
  const now = new Date();
  const bs = toBS(now);
  const currentFYStartYear = bs.month >= 4 ? bs.year : bs.year - 1;
  const prevFYStartYear = currentFYStartYear - 1;
  const adStart = new DateConverter(`${prevFYStartYear}-04-01`).toAd();
  const adEnd = new DateConverter(`${currentFYStartYear}-03-32`).toAd();
  return {
    start: new Date(adStart.year, adStart.month - 1, adStart.date),
    end: new Date(adEnd.year, adEnd.month - 1, adEnd.date),
  };
}

export function getFiscalYearStartEpoch(): number {
  return getCurrentFYRange().start.getTime();
}
