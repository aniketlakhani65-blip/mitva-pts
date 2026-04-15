import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Date helpers (local time)
// ---------------------------------------------------------------------------
function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// ---------------------------------------------------------------------------
// Main dashboard
// ---------------------------------------------------------------------------

export default async function Dashboard() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const now = new Date();
  const todayEnd = endOfDay(now);
  const weekEnd = endOfDay(addDays(now, 7));
  const monthStart = startOfMonth(now);
  const notDoneFilter = { notIn: ["DISPATCHED", "CANCELLED"] };

  // All counts in parallel — single round-trip fan-out
  const [
    liveOrders,
    overdueCount,
    dueTodayCount,
    dueThisWeekCount,
    onHoldCount,
    dispatchedThisMonth,
    avgCycleAgg,
    liveByStage,
    overdueList,
    dueSoonList,
    recentDispatches,
    priorityList,
    agingAlerts,
    onHoldList
  ] = await Promise.all([
    prisma.order.count({ where: { status: notDoneFilter } }),
    prisma.order.count({
      where: { status: notDoneFilter, expectedDelivery: { lt: startOfDay(now) } }
    }),
    prisma.order.count({
      where: { status: notDoneFilter, expectedDelivery: { gte: startOfDay(now), lte: todayEnd } }
    }),
    prisma.order.count({
      where: { status: notDoneFilter, expectedDelivery: { gte: startOfDay(now), lte: weekEnd } }
    }),
    prisma.order.count({ where: { status: "ON_HOLD" } }),
    prisma.order.count({
      where: { status: "DISPATCHED", actualDelivery: { gte: monthStart } }
    }),
    // Average cycle time (days) for orders dispatched this month
    prisma.order.findMany({
      where: { status: "DISPATCHED", actualDelivery: { gte: monthStart } },
      select: { orderDate: true, actualDelivery: true }
    }),
    prisma.stage.findMany({
      where: { active: true },
      orderBy: { sequence: "asc" },
      select: {
        id: true, name: true, code: true, department: true, slaDays: true,
        _count: { select: { currentOrders: true } }
      }
    }),
    prisma.order.findMany({
      where: { status: notDoneFilter, expectedDelivery: { lt: startOfDay(now) } },
      orderBy: { expectedDelivery: "asc" },
      take: 10,
      select: {
        id: true, jobNo: true, priority: true, expectedDelivery: true,
        customer: { select: { name: true } },
        currentStage: { select: { name: true } }
      }
    }),
    prisma.order.findMany({
      where: {
        status: notDoneFilter,
        expectedDelivery: { gte: startOfDay(now), lte: weekEnd }
      },
      orderBy: { expectedDelivery: "asc" },
      take: 10,
      select: {
        id: true, jobNo: true, priority: true, expectedDelivery: true,
        customer: { select: { name: true } },
        currentStage: { select: { name: true } }
      }
    }),
    prisma.order.findMany({
      where: { status: "DISPATCHED" },
      orderBy: { actualDelivery: "desc" },
      take: 5,
      select: {
        id: true, jobNo: true, actualDelivery: true, expectedDelivery: true,
        customer: { select: { name: true } }
      }
    }),
    prisma.order.findMany({
      where: { status: notDoneFilter, priority: { in: ["VIP", "RUSH"] } },
      orderBy: [{ priority: "asc" }, { expectedDelivery: "asc" }],
      take: 6,
      select: {
        id: true, jobNo: true, priority: true, expectedDelivery: true,
        customer: { select: { name: true } },
        currentStage: { select: { name: true } }
      }
    }),
    // Aging alerts: IN_PROGRESS / PENDING stage rows that have exceeded SLA days
    prisma.stageHistory.findMany({
      where: { status: { in: ["PENDING", "IN_PROGRESS"] } },
      orderBy: { inAt: "asc" },
      take: 50,
      include: {
        stage: { select: { name: true, slaDays: true, department: true } },
        karigar: { select: { name: true } },
        order: {
          select: { id: true, jobNo: true, priority: true, customer: { select: { name: true } } }
        }
      }
    }),
    prisma.order.findMany({
      where: { status: "ON_HOLD" },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true, jobNo: true,
        customer: { select: { name: true } },
        currentStage: { select: { name: true } }
      }
    })
  ]);

  // Compute average cycle time in days
  const cycleDays = avgCycleAgg
    .filter((o: any) => o.actualDelivery)
    .map((o: any) =>
      (new Date(o.actualDelivery).getTime() - new Date(o.orderDate).getTime()) / 86400000
    );
  const avgCycle = cycleDays.length
    ? (cycleDays.reduce((a: number, b: number) => a + b, 0) / cycleDays.length).toFixed(1)
    : "—";

  // Filter aging alerts on the application side (compare against stage SLA)
  const alertsOverSla = agingAlerts
    .map((h: any) => {
      const ageDays = (now.getTime() - new Date(h.inAt).getTime()) / 86400000;
      return { h, ageDays, sla: h.stage.slaDays };
    })
    .filter((x: any) => x.ageDays > x.sla * 1.5) // >50% past SLA = alert
    .sort((a: any, b: any) => b.ageDays / b.sla - a.ageDays / a.sla)
    .slice(0, 8);

  return (
    <main className="min-h-screen p-6 max-w-7xl mx-auto">
      <header className="flex justify-between items-start mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-brand-900">Mitva PTS</h1>
          <p className="text-sm text-slate-600">
            Welcome, {session.user?.name} ·{" "}
            <span className="uppercase text-xs font-semibold">{(session.user as any).role}</span>
            {" · "}
            {now.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "short", day: "numeric" })}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/stage-update" className="px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-100">
            Shop-floor queue
          </Link>
          <Link href="/orders/new" className="px-3 py-1.5 rounded-md bg-brand-600 text-white text-sm font-medium hover:bg-brand-700">
            + New Order
          </Link>
          <SignOutButton />
        </div>
      </header>

      {/* KPI strip */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <StatCard label="Live orders" value={liveOrders} tone="brand" href="/orders" />
        <StatCard label="Overdue" value={overdueCount} tone="danger" href="#overdue" />
        <StatCard label="Due today" value={dueTodayCount} tone="warn" href="#due" />
        <StatCard label="Due this week" value={dueThisWeekCount} tone="info" href="#due" />
        <StatCard label="On hold" value={onHoldCount} tone="muted" href="#hold" />
        <StatCard
          label="Dispatched (MTD)"
          value={dispatchedThisMonth}
          tone="success"
          footer={`Avg cycle ${avgCycle}${avgCycle !== "—" ? " d" : ""}`}
        />
      </section>

      {/* Overdue + Due soon side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Panel
          id="overdue"
          title="Overdue orders"
          tone="danger"
          empty={overdueList.length === 0}
          emptyMsg="Nothing overdue. Keep it up."
        >
          <OrderList rows={overdueList} showDaysOver />
        </Panel>

        <Panel
          id="due"
          title="Due in next 7 days"
          tone="warn"
          empty={dueSoonList.length === 0}
          emptyMsg="Nothing due in the next week."
        >
          <OrderList rows={dueSoonList} />
        </Panel>
      </div>

      {/* Priority + Aging alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Panel
          title="VIP & Rush orders"
          tone="amber"
          empty={priorityList.length === 0}
          emptyMsg="No active VIP or Rush orders."
        >
          <ul className="divide-y text-sm">
            {priorityList.map((o: any) => (
              <li key={o.id} className="py-2 flex justify-between gap-3">
                <Link href={`/orders/${o.id}`} className="flex-1 min-w-0 hover:underline">
                  <div className="flex items-center gap-2">
                    <PriorityChip priority={o.priority} />
                    <span className="font-semibold text-slate-800">{o.jobNo}</span>
                    <span className="text-slate-500 truncate">· {o.customer.name}</span>
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {o.currentStage?.name ?? "—"} · due {new Date(o.expectedDelivery).toLocaleDateString()}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title="Aging alerts (past SLA)"
          tone="danger"
          empty={alertsOverSla.length === 0}
          emptyMsg="Every stage is within SLA."
        >
          <ul className="divide-y text-sm">
            {alertsOverSla.map(({ h, ageDays, sla }: any) => (
              <li key={h.id} className="py-2">
                <Link href={`/stage-update/${h.order.id}`} className="hover:underline">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">{h.order.jobNo}</span>
                    <span className="text-slate-500 truncate">· {h.order.customer.name}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {h.stage.name} · {h.karigar?.name ?? "unassigned"} ·
                    <span className="text-red-600 font-medium">
                      {" "}{ageDays.toFixed(1)}d / {sla}d SLA
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {/* Live by stage */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3">
          Live orders by stage
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {liveByStage.map((s: any) => (
            <Link
              key={s.id}
              href={s.department ? `/stage-update?dept=${encodeURIComponent(s.department)}` : "/stage-update"}
              className="rounded-lg border bg-white p-3 hover:border-brand-400 hover:shadow-sm transition"
            >
              <div className="text-xs text-slate-500 uppercase tracking-wide">{s.code}</div>
              <div className="text-sm font-medium text-slate-800 truncate">{s.name}</div>
              <div className="flex items-baseline justify-between mt-1">
                <div className="text-2xl font-bold text-brand-700">{s._count.currentOrders}</div>
                <div className="text-[10px] text-slate-400">SLA {s.slaDays}d</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* On hold + Recent dispatches */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel
          id="hold"
          title="On hold"
          tone="amber"
          empty={onHoldList.length === 0}
          emptyMsg="No orders on hold."
        >
          <ul className="divide-y text-sm">
            {onHoldList.map((o: any) => (
              <li key={o.id} className="py-2">
                <Link href={`/orders/${o.id}`} className="hover:underline">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">{o.jobNo}</span>
                    <span className="text-slate-500 truncate">· {o.customer.name}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    Held at {o.currentStage?.name ?? "—"}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title="Recently dispatched"
          tone="success"
          empty={recentDispatches.length === 0}
          emptyMsg="No dispatches yet."
        >
          <ul className="divide-y text-sm">
            {recentDispatches.map((o: any) => {
              const onTime = o.actualDelivery && new Date(o.actualDelivery) <= new Date(o.expectedDelivery);
              return (
                <li key={o.id} className="py-2 flex justify-between gap-3">
                  <Link href={`/orders/${o.id}`} className="flex-1 hover:underline min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">{o.jobNo}</span>
                      <span className="text-slate-500 truncate">· {o.customer.name}</span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {o.actualDelivery ? new Date(o.actualDelivery).toLocaleDateString() : "—"}
                    </div>
                  </Link>
                  <span className={`shrink-0 self-start text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    onTime ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                  }`}>
                    {onTime ? "ON TIME" : "LATE"}
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <footer className="mt-10 text-center text-xs text-slate-400">
        Mitva PTS · data refreshed {now.toLocaleTimeString()}
      </footer>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  label, value, tone, href, footer
}: {
  label: string;
  value: number;
  tone: "brand" | "danger" | "warn" | "info" | "success" | "muted";
  href?: string;
  footer?: string;
}) {
  const tones: Record<string, string> = {
    brand:   "bg-brand-50 border-brand-100 text-brand-900",
    danger:  "bg-red-50 border-red-100 text-red-900",
    warn:    "bg-amber-50 border-amber-100 text-amber-900",
    info:    "bg-indigo-50 border-indigo-100 text-indigo-900",
    success: "bg-green-50 border-green-100 text-green-900",
    muted:   "bg-slate-50 border-slate-200 text-slate-700"
  };
  const body = (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <div className="text-xs font-medium opacity-70 uppercase tracking-wide">{label}</div>
      <div className="text-3xl font-bold mt-1 leading-none">{value}</div>
      {footer && <div className="text-[11px] opacity-70 mt-2">{footer}</div>}
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

function Panel({
  id, title, tone, empty, emptyMsg, children
}: {
  id?: string;
  title: string;
  tone: "brand" | "danger" | "warn" | "amber" | "success";
  empty: boolean;
  emptyMsg: string;
  children: React.ReactNode;
}) {
  const headerTones: Record<string, string> = {
    brand:   "text-brand-800",
    danger:  "text-red-800",
    warn:    "text-amber-800",
    amber:   "text-amber-800",
    success: "text-green-800"
  };
  return (
    <section id={id} className="bg-white border rounded-xl p-4">
      <h2 className={`text-sm font-semibold uppercase tracking-wide mb-3 ${headerTones[tone]}`}>
        {title}
      </h2>
      {empty ? (
        <p className="text-sm text-slate-500 italic">{emptyMsg}</p>
      ) : (
        children
      )}
    </section>
  );
}

function OrderList({ rows, showDaysOver }: { rows: any[]; showDaysOver?: boolean }) {
  const now = new Date();
  return (
    <ul className="divide-y text-sm">
      {rows.map((o: any) => {
        const days = Math.floor((now.getTime() - new Date(o.expectedDelivery).getTime()) / 86400000);
        return (
          <li key={o.id} className="py-2 flex justify-between gap-3">
            <Link href={`/orders/${o.id}`} className="flex-1 min-w-0 hover:underline">
              <div className="flex items-center gap-2">
                {o.priority !== "NORMAL" && <PriorityChip priority={o.priority} />}
                <span className="font-semibold text-slate-800">{o.jobNo}</span>
                <span className="text-slate-500 truncate">· {o.customer.name}</span>
              </div>
              <div className="text-xs text-slate-500 truncate">
                {o.currentStage?.name ?? "—"} · due {new Date(o.expectedDelivery).toLocaleDateString()}
              </div>
            </Link>
            {showDaysOver && days > 0 && (
              <span className="shrink-0 self-start text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-800">
                {days}d late
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function PriorityChip({ priority }: { priority: string }) {
  if (priority === "NORMAL") return null;
  const cls =
    priority === "VIP"
      ? "bg-purple-100 text-purple-800"
      : "bg-amber-100 text-amber-800";
  return (
    <span className={`shrink-0 rounded-full text-[10px] font-bold px-1.5 py-0.5 ${cls}`}>
      {priority}
    </span>
  );
}
