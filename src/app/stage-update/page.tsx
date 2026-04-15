import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function StageQueueIndex({
  searchParams
}: {
  searchParams: { dept?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const departments = await prisma.stage.findMany({
    where: { active: true, department: { not: null } },
    orderBy: { sequence: "asc" },
    select: { department: true }
  });
  const depts = Array.from(new Set(departments.map((d: any) => d.department).filter(Boolean))) as string[];

  const activeDept = searchParams.dept ?? depts[0] ?? "";

  const queue = activeDept
    ? await prisma.stageHistory.findMany({
        where: {
          status: { in: ["PENDING", "IN_PROGRESS", "ON_HOLD"] },
          stage: { department: activeDept }
        },
        orderBy: [{ inAt: "asc" }],
        include: {
          stage: { select: { name: true, code: true } },
          karigar: { select: { name: true } },
          order: {
            select: {
              id: true, jobNo: true, priority: true, expectedDelivery: true,
              customer: { select: { name: true } },
              items: { take: 1, select: { description: true } }
            }
          }
        }
      })
    : [];

  return (
    <main className="min-h-screen bg-slate-50 max-w-md mx-auto p-4 pb-20">
      <header className="flex items-center justify-between mb-3">
        <Link href="/" className="text-sm text-brand-600">← Dashboard</Link>
        <h1 className="text-lg font-bold text-brand-900">Queue</h1>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {depts.map((d) => (
          <Link
            key={d}
            href={`/stage-update?dept=${encodeURIComponent(d)}`}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border ${
              d === activeDept
                ? "bg-brand-600 text-white border-brand-600"
                : "bg-white text-slate-700 border-slate-300"
            }`}
          >
            {d}
          </Link>
        ))}
      </div>

      {queue.length === 0 ? (
        <div className="mt-8 rounded-xl bg-white border p-6 text-center text-sm text-slate-500">
          No live jobs in {activeDept || "this department"}.
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {queue.map((h: any) => {
            const ageDays = Math.floor((Date.now() - new Date(h.inAt).getTime()) / 86400000);
            const overdue = new Date(h.order.expectedDelivery) < new Date();
            return (
              <li key={h.id}>
                <Link
                  href={`/stage-update/${h.order.id}`}
                  className="block bg-white border rounded-xl p-3 active:bg-slate-50"
                >
                  <div className="flex justify-between items-start">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900">{h.order.jobNo}</div>
                      <div className="text-xs text-slate-600 truncate">
                        {h.order.customer.name} · {h.order.items[0]?.description ?? "—"}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {h.stage.name} · {h.karigar?.name ?? "unassigned"}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <StatusDot status={h.status} />
                      <div className="text-[10px] text-slate-500 mt-1">
                        {ageDays}d in stage
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    {h.order.priority !== "NORMAL" && (
                      <span className="rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5">
                        {h.order.priority}
                      </span>
                    )}
                    {overdue && (
                      <span className="rounded-full bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5">
                        OVERDUE
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: "bg-slate-300",
    IN_PROGRESS: "bg-brand-500",
    ON_HOLD: "bg-amber-500",
    COMPLETED: "bg-green-500",
    REWORK: "bg-red-500"
  };
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full ${map[status] ?? "bg-slate-300"}`} title={status} />
  );
}
