const euroFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
});

export function formatPrice(priceCents: number): string {
  return euroFormatter.format(priceCents / 100);
}
