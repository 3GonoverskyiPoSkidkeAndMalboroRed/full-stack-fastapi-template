export function formatPrice(value?: string | number | null): string {
  if (value == null) return "—"
  const numeric = typeof value === "string" ? Number(value) : value
  if (Number.isNaN(numeric)) return "—"
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(numeric)
}
