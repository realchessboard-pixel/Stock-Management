/**
 * Business-day boundaries. All StockFlow shops are in India for now; when
 * Business gets a timezone column, pass it through instead of this constant.
 */
export const BUSINESS_TZ = "Asia/Kolkata";

/** "YYYY-MM-DD" for a date in the business timezone. */
export function businessDateKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Start of a business-local day (YYYY-MM-DD) as a UTC instant. IST has no DST: fixed +05:30. */
export function startOfBusinessDay(key: string): Date {
  return new Date(`${key}T00:00:00+05:30`);
}

export function addDays(key: string, days: number): string {
  const d = startOfBusinessDay(key);
  d.setUTCDate(d.getUTCDate() + days);
  return businessDateKey(d);
}
