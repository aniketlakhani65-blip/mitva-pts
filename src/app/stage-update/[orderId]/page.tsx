import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { StageUpdateForm } from "./StageUpdateForm";

export const dynamic = "force-dynamic";

export default async function StageUpdatePage({ params }: { params: { orderId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    include: {
      customer: { select: { name: true, phone: true } },
      items: { select: { description: true, size: true, qty: true, stonesJson: true } },
      currentStage: true,
      stageHistory: {
        where: { status: { in: ["PENDING", "IN_PROGRESS", "ON_HOLD"] } },
        orderBy: { inAt: "desc" },
        take: 1,
        include: { stage: true, karigar: true }
      }
    }
  });
  if (!order) notFound();

  const current = order.stageHistory[0];

  // If the order is finished, show a simple terminal state.
  if (!current || order.status === "DISPATCHED" || order.status === "CANCELLED") {
    return (
      <main className="min-h-screen max-w-md mx-auto p-4">
        <Link href={`/orders/${order.id}`} className="text-sm text-brand-600">← Order</Link>
        <div className="mt-6 rounded-xl bg-white border p-6 text-center">
          <div className="text-3xl mb-2">✓</div>
          <h1 className="text-xl font-bold">{order.jobNo}</h1>
          <p className="text-sm text-slate-600 mt-1">
            Status: <span className="font-medium">{order.status.replace("_", " ")}</span>
          </p>
          <p className="text-xs text-slate-500 mt-3">No active stage. Nothing to update here.</p>
        </div>
      </main>
    );
  }

  // Load karigars scoped to the current department (fallback: all active)
  const karigars = await prisma.karigar.findMany({
    where: {
      active: true,
      ...(current.stage.department ? { department: current.stage.department } : {})
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, department: true }
  });

  // Earlier stages (for rework target)
  const earlierStages = await prisma.stage.findMany({
    where: { sequence: { lt: current.stage.sequence }, active: true },
    orderBy: { sequence: "asc" },
    select: { id: true, name: true, code: true, sequence: true }
  });

  const stonesRaw = order.items[0]?.stonesJson;
  const stones: any[] = stonesRaw ? JSON.parse(stonesRaw) : [];

  return (
    <main className="min-h-screen bg-slate-50 max-w-md mx-auto p-4 pb-24">
      <Link href={`/orders/${order.id}`} className="text-sm text-brand-600">← Order</Link>

      <header className="mt-2 bg-white border rounded-xl p-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold text-brand-900 leading-tight">{order.jobNo}</h1>
            <p className="text-sm text-slate-700">{order.customer.name}</p>
            <p className="text-xs text-slate-500">
              {order.qty} × {order.items[0]?.description ?? "—"} · {order.metal.replace("_", " ")}
            </p>
          </div>
          {order.priority !== "NORMAL" && (
            <span className="shrink-0 rounded-full bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5">
              {order.priority}
            </span>
          )}
        </div>
        {stones.length > 0 && (
          <details className="mt-2 text-xs text-slate-600">
            <summary className="cursor-pointer text-brand-600">Stones ({stones.length})</summary>
            <ul className="list-disc list-inside mt-1">
              {stones.map((s, i) => (
                <li key={i}>{s.qty} × {s.type} {s.shape} {s.size}</li>
              ))}
            </ul>
          </details>
        )}
      </header>

      <div className="mt-3 rounded-xl bg-brand-50 border border-brand-100 p-4">
        <div className="text-xs uppercase tracking-wide text-brand-700 font-semibold">Current stage</div>
        <div className="text-lg font-bold text-brand-900">{current.stage.name}</div>
        <div className="text-xs text-slate-600">
          Status: <span className="font-medium">{current.status.replace("_", " ")}</span>
          {current.karigar && ` · ${current.karigar.name}`}
        </div>
        <div className="text-xs text-slate-500 mt-1">
          In since {new Date(current.inAt).toLocaleString()}
        </div>
      </div>

      <StageUpdateForm
        orderId={order.id}
        history={{
          id: current.id,
          status: current.status,
          stageName: current.stage.name,
          stageDepartment: current.stage.department,
          wtIn: current.wtIn ? Number(current.wtIn) : null,
          karigarId: current.karigarId
        }}
        karigars={karigars}
        earlierStages={earlierStages}
      />
    </main>
  );
}
