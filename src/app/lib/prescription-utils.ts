export const WEEKLY_SESSION_OPTIONS = [
  "1 Session / Week",
  "2 Sessions / Week",
  "3 Sessions / Week",
  "4 Sessions / Week",
  "5 Sessions / Week",
  "6 Sessions / Week",
  "7 Sessions / Week",
];

export const DIALYSIS_DAY_OPTIONS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export const SLOT_OPTIONS = [
  "8:00 AM – 12:00 PM",
  "12:00 PM – 4:00 PM",
  "4:00 PM – 8:00 PM",
];

export const DURATION_OPTIONS = ["2 Hours", "3 Hours", "4 Hours", "5 Hours"];

export function weeklySessionsCountFromDays(days: readonly string[]): string {
  return String(new Set(days).size);
}

export function formatRxTimestamp(iso: string): string {
  const date = new Date(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const hour = date.getHours();
  const minute = String(date.getMinutes()).padStart(2, "0");
  const ampm = hour >= 12 ? "PM" : "AM";
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}, ${hour % 12 || 12}:${minute} ${ampm}`;
}
