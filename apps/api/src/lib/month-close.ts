import { db } from "@/lib/db";

/** Check if a given month is closed (locked for changes). */
export async function isMonthClosed(year: number, month: number): Promise<boolean> {
  const close = await db.monthClose.findUnique({
    where: { year_month: { year, month } },
  });
  return !!close;
}
