import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params, searchParams
}: {
  params: { id: string };
  searchParams: { created?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      items: true,
      currentStage: true,
      stageHistory: {
        orderBy: [{ inAt: "asc" }],
        include: { stage: true, karigar: true }
      }
    }
  });
  if (!order) notFound();

  const justCreated = searchParams.created === "1";
  const stonesRaw = order.items[0]?.stonesJson;
  const stones: any[] = stonesRaw ? JSON.parse(stonesRaw) : [];
  const trackUrl = `/track/${order.publicSlug}`;

  return (
    <main className="min-h-screen max-w-4xl mx-auto p-6">
      <Link href="/" className="text-sm text-brand-600 hover:underline">← Dashboard</Link>

      {justCreated && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-2 text-green-800 font-semibold">
            <span className="text-2xl">✓</span>
            <span>Order created successfully</span>
          </div>
          <p className="text-sm text-green-700 mt-1">
            Job number <code className="font-mono font-semibold">{order.jobNo}</code> is now live in {order.currentStage?.name}.
          </p>
          <div className="mt-3 flex gap-2">
            <Link
              href="/orders/new"
              className="px-3 py-1.5 rounded-md bg-brand-600 text-white text-sm hover:bg-brand-700"
            >
              + Create another
            </Link>
            <Link
              href={trackUrl}
              className="px-3 py-1.5 rounded-md border border-slate-300 text-sm text-slate-700 hover:bg-slate-50"
            >
              Customer tracking link
            </Link>
          </div>
        </div>
      )}

      <header className="mt-6 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-brand-900">{order.jobNo}</h1>
          <p className="text-sm text-slate-600">{order.customer.name}</p>
        </div>
        <div className="text-right">
          <StatusBadge status={order.status} />
          <div className="text-xs text-slate-500 mt-1">
            {order.priority !== "NORMAL" && <span className="inline-block bg-amber-100 text-amber-800 rounded px-1.5 py-0.5 mr-1">{order.priority}</span>}
            Expected {new Date(order.expectedDelivery).toLocaleDateString()}
          </div>
          {order.status !== "DISPATCHED" && order.status !== "CANCELLED" && (
            <Link
              href={`/stage-update/${order.id}`}
              className="inline-block mt-2 px-3 py-1.5 rounded-md bg-brand-600 text-white text-xs font-medium hover:bg-brand-700"
            >
              Update stage →
            </Link>
          )}
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <Info label="Metal" value={`${order.metal.replace("_", " ")} ${order.color !== "NA" ? `(${order.color.toLowerCase()})` : ""}`} />
        <Info label="Quantity" value={order.qty.toString()} />
        <Info label="Gross wt (est.)" value={`${order.grossWtEst.toString()} g`} />
      </section>

      <section className="mt-6 bg-white border rounded-xl p-5">
        <h2 className="font-semibold text-slate-800 mb-3">Item</h2>
        {order.items.map((it: any) => (
          <div key={it.id}>
            <p className="text-sm text-slate-700">
              {it.qty} × {it.description} {it.size && <span className="text-slate-500">· {it.size}</span>}
            </p>
            {stones.length > 0 && (
              <ul className="mt-2 text-xs text-slate-600 list-disc list-inside">
                {stones.map((s, i) => (
                  <li key={i}>
                    {s.qty} × {s.type} {s.shape} {s.size} {s.quality ? `(${s.quality})` : ""} [{s.source}]
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {order.specialNotes && (
          <p className="mt-3 text-sm italic text-slate-600 border-l-4 border-amber-300 pl-3">
            {order.specialNotes}
          </p>
        )}
      </section>

      <section className="mt-6 bg-white border rounded-xl p-5">
        <h2 className="font-semibold text-slate-800 mb-3">Stage history</h2>
        <ol className="relative border-l border-slate-200 ml-3">
          {order.stageHistory.map((h: any) => (
            <li key={h.id} className="ml-4 pb-4">
              <span className={`absolute -left-1.5 w-3 h-3 rounded-full ${
                h.status === "COMPLETED" ? "bg-green-500" :
                h.status === "IN_PROGRESS" ? "bg-brand-500" :
                h.status === "REWORK" ? "bg-red-500" :
                "bg-slate-300"
              }`} />
              <div className="flex justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-800">{h.stage.name}</div>
                  <div className="text-xs text-slate-500">
                    {h.karigar?.name ?? "—"} · {h.status.replace("_", " ").toLowerCase()}
                  </div>
                </div>
                <div className="text-xs text-slate-500 text-right">
                  <div>In: {new Date(h.inAt).toLocaleString()}</div>
                  {h.outAt && <div>Out: {new Date(h.outAt).toLocaleString()}</div>}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-6 bg-white border rounded-xl p-5 text-sm">
        <h2 className="font-semibold text-slate-800 mb-3">Commercial</h2>
        <div className="grid grid-cols-3 gap-4">
          <Info label="Quoted" value={order.quotedPrice ? `₹${order.quotedPrice.toString()}` : "—"} />
          <Info label="Advance" value={`₹${order.advancePaid.toString()}`} />
          <Info label="Balance" value={
            order.quotedPrice
              ? `₹${(Number(order.quotedPrice) - Number(order.advancePaid)).toFixed(2)}`
              : "—"
          } />
        </div>
      </section>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-sm font-medium text-slate-800 mt-0.5">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: "bg-slate-100 text-slate-700",
    IN_PROGRESS: "bg-brand-100 text-brand-800",
    ON_HOLD: "bg-amber-100 text-amber-800",
    READY_FOR_DISPATCH: "bg-indigo-100 text-indigo-800",
    DISPATCHED: "bg-green-100 text-green-800",
    CANCELLED: "bg-red-100 text-red-800"
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${map[status] ?? "bg-slate-100"}`}>
      {status.replace("_", " ")}
    </span>
  );
}
