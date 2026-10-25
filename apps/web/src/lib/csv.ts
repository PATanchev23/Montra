/** Serialises rows to RFC 4180 CSV and hands the file to the browser. */
export function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const escape = (value: string | number) => {
    const text = String(value);
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const csv = [header, ...rows].map((row) => row.map(escape).join(',')).join('\r\n');
  // A BOM makes Excel read the file as UTF-8 (€ signs, Cyrillic names).
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Cents → plain decimal string for spreadsheets (no currency symbol, dot separator). */
export function centsToDecimal(cents: number) {
  return (cents / 100).toFixed(2);
}
