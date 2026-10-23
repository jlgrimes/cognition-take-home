export const money = (cents: number, currency = "usd") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);

export const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export const titleCase = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
