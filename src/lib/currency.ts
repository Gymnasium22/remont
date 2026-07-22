/** Форматирование сумм в белорусских рублях (Br) */
export function formatBr(amount: number, opts?: { compact?: boolean }): string {
  if (!Number.isFinite(amount)) return '0 Br';
  const n = Math.round(amount * 100) / 100;
  if (opts?.compact && Math.abs(n) >= 1000) {
    const k = n / 1000;
    return `${k.toLocaleString('ru-BY', { maximumFractionDigits: 1 })} тыс. Br`;
  }
  return `${n.toLocaleString('ru-BY', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} Br`;
}

export function parseAmount(value: string): number {
  const cleaned = value.replace(/\s/g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}
