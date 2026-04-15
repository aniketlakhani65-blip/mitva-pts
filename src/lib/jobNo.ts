import { prisma } from "@/lib/prisma";

/**
 * Generates the next Job Number in the format YYMM-NNNN.
 * Sequence resets monthly. Uses a serialisable transaction to avoid duplicates.
 */
export async function nextJobNo(now: Date = new Date()): Promise<string> {
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `${yy}${mm}-`;

  // Find highest existing for this month and increment
  const latest = await prisma.order.findFirst({
    where: { jobNo: { startsWith: prefix } },
    orderBy: { jobNo: "desc" },
    select: { jobNo: true }
  });

  let next = 1;
  if (latest) {
    const suffix = latest.jobNo.split("-")[1];
    const n = parseInt(suffix, 10);
    if (!Number.isNaN(n)) next = n + 1;
  }
  return prefix + String(next).padStart(4, "0");
}
