import { format } from 'date-fns';

/**
 * Safely parses any date field (Firestore Timestamp, JS Date, ISO string, or YYYY-MM-DD calendar string)
 * into a valid JavaScript Date object without timezone date regression.
 */
export function parseDateSafe(dateField: any): Date | null {
  if (!dateField) return null;

  // 1. If it's a Firestore Timestamp with toDate()
  if (typeof dateField.toDate === 'function') {
    return dateField.toDate();
  }

  // 2. If it's already an instance of Date
  if (dateField instanceof Date) {
    if (!isNaN(dateField.getTime())) return dateField;
    return null;
  }

  // 3. If it's a serialized Firestore Timestamp object { seconds, nanoseconds }
  if (typeof dateField.seconds === 'number') {
    return new Date(dateField.seconds * 1000);
  }

  // 4. If it's a YYYY-MM-DD string (e.g. "2026-10-26")
  // Standard new Date("2026-10-26") parses as UTC midnight, which shifts backwards to 
  // "2026-10-25" in western timezones or early morning comparisons!
  // Parsing into local noon prevents ANY date shift across all global timezones.
  if (typeof dateField === 'string') {
    const trimmed = dateField.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split('-').map(Number);
      return new Date(year, month - 1, day, 12, 0, 0);
    }
  }

  // 5. General string or number parsing
  const d = new Date(dateField);
  if (!isNaN(d.getTime())) return d;

  return null;
}

export function formatDateSafe(dateField: any, formatStr: string, fallback = '-'): string {
  const d = parseDateSafe(dateField);
  if (!d) return fallback;
  return format(d, formatStr);
}

/**
 * Helper to get the canonical YYYY-MM-DD string for a document (sale or bill),
 * immune to morning timezone shifts.
 */
export function getDocDateString(doc: any): string {
  if (doc?.saleDate && typeof doc.saleDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(doc.saleDate.trim())) {
    return doc.saleDate.trim();
  }
  const parsed = parseDateSafe(doc?.date || doc?.createdAt);
  if (parsed) {
    return format(parsed, 'yyyy-MM-dd');
  }
  return format(new Date(), 'yyyy-MM-dd');
}
