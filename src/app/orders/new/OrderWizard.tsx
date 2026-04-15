"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createOrder } from "./actions";
import type { NewOrderInput, Stone } from "./schema";

type CustomerLite = { id: string; name: string; phone: string | null; type: string };

const STEPS = ["Customer", "Item", "Stones", "Commercial", "Review"] as const;
type StepName = (typeof STEPS)[number];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function plusDaysISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

const METALS = [
  { v: "GOLD_22K",  l: "Gold 22K" },
  { v: "GOLD_18K",  l: "Gold 18K" },
  { v: "GOLD_14K",  l: "Gold 14K" },
  { v: "SILVER",    l: "Silver" },
  { v: "PLATINUM",  l: "Platinum" }
];
const COLORS = [
  { v: "YELLOW", l: "Yellow" },
  { v: "WHITE",  l: "White" },
  { v: "ROSE",   l: "Rose" },
  { v: "NA",     l: "N/A" }
];

export function OrderWizard({ customers }: { customers: CustomerLite[] }) {
  const router = useRouter();
  const [stepIdx, setStepIdx] = useState(0);
  const [pending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const [form, setForm] = useState<NewOrderInput>({
    customerId: customers[0]?.id ?? undefined,
    newCustomer: undefined,
    orderDate: todayISO(),
    expectedDelivery: plusDaysISO(14),
    priority: "NORMAL",
    metal: "GOLD_22K",
    color: "YELLOW",
    qty: 1,
    grossWtEst: 0,
    quotedPrice: undefined,
    advancePaid: 0,
    itemDescription: "",
    size: "",
    stones: [],
    specialNotes: ""
  });

  const [mode, setMode] = useState<"existing" | "new">(customers.length ? "existing" : "new");

  const step: StepName = STEPS[stepIdx];
  const patch = (p: Partial<NewOrderInput>) => setForm((f) => ({ ...f, ...p }));
  const patchNewCustomer = (p: Partial<NonNullable<NewOrderInput["newCustomer"]>>) =>
    setForm((f) => ({
      ...f,
      newCustomer: { name: "", phone: "", email: "", address: "", type: "RETAIL", ...(f.newCustomer ?? {}), ...p }
    }));

  function next() {
    setSubmitError(null);
    const errs = validateStep(step, form, mode);
    if (errs.length) {
      setSubmitError(errs.join(" "));
      return;
    }
    setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
  }
  function back() {
    setSubmitError(null);
    setStepIdx((i) => Math.max(i - 1, 0));
  }

  function submit() {
    setSubmitError(null);
    setFieldErrors({});
    // Strip fields based on mode
    const payload: NewOrderInput = { ...form };
    if (mode === "existing") {
      payload.newCustomer = undefined;
    } else {
      payload.customerId = undefined;
    }
    startTransition(async () => {
      const res = await createOrder(payload);
      if (res.ok) {
        router.push(`/orders/${res.orderId}?created=1`);
      } else {
        setSubmitError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
      }
    });
  }

  return (
    <main className="min-h-screen max-w-3xl mx-auto p-6">
      <header className="mb-6 flex justify-between items-center">
        <div>
          <Link href="/" className="text-sm text-brand-600 hover:underline">← Dashboard</Link>
          <h1 className="text-2xl font-bold text-brand-900 mt-1">New Order</h1>
        </div>
      </header>

      <Stepper step={stepIdx} />

      <div className="bg-white border rounded-xl p-6 mt-6 space-y-5">
        {step === "Customer" && (
          <CustomerStep
            mode={mode}
            setMode={setMode}
            customers={customers}
            form={form}
            patch={patch}
            patchNewCustomer={patchNewCustomer}
          />
        )}
        {step === "Item" && <ItemStep form={form} patch={patch} />}
        {step === "Stones" && <StonesStep form={form} patch={patch} />}
        {step === "Commercial" && <CommercialStep form={form} patch={patch} />}
        {step === "Review" && <ReviewStep form={form} mode={mode} customers={customers} />}

        {submitError && (
          <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm p-3">
            {submitError}
            {Object.keys(fieldErrors).length > 0 && (
              <ul className="mt-2 list-disc list-inside">
                {Object.entries(fieldErrors).map(([k, v]) => (
                  <li key={k}><code>{k}</code>: {v.join(", ")}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex justify-between pt-4 border-t">
          <button
            type="button"
            onClick={back}
            disabled={stepIdx === 0 || pending}
            className="px-4 py-2 rounded-md border text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Back
          </button>
          {step !== "Review" ? (
            <button
              type="button"
              onClick={next}
              className="px-4 py-2 rounded-md bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
            >
              Continue →
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="px-5 py-2 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {pending ? "Creating..." : "Create order"}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

// -- Step components ----------------------------------------------------------

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex items-center gap-2 text-xs">
      {STEPS.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span
            className={`w-6 h-6 rounded-full grid place-items-center font-semibold ${
              i < step ? "bg-brand-600 text-white" :
              i === step ? "bg-brand-600 text-white ring-2 ring-brand-200" :
              "bg-slate-200 text-slate-600"
            }`}
          >
            {i + 1}
          </span>
          <span className={i === step ? "font-semibold text-slate-800" : "text-slate-500"}>{s}</span>
          {i < STEPS.length - 1 && <span className="text-slate-300">—</span>}
        </li>
      ))}
    </ol>
  );
}

function Field({
  label, children, hint
}: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

const inputCls =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:ring-brand-600";

function CustomerStep({
  mode, setMode, customers, form, patch, patchNewCustomer
}: {
  mode: "existing" | "new";
  setMode: (m: "existing" | "new") => void;
  customers: CustomerLite[];
  form: NewOrderInput;
  patch: (p: Partial<NewOrderInput>) => void;
  patchNewCustomer: (p: Partial<NonNullable<NewOrderInput["newCustomer"]>>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("existing")}
          className={`px-3 py-1.5 rounded-md text-sm border ${
            mode === "existing" ? "bg-brand-600 text-white border-brand-600" : "bg-white text-slate-700"
          }`}
          disabled={!customers.length}
        >
          Existing customer
        </button>
        <button
          type="button"
          onClick={() => setMode("new")}
          className={`px-3 py-1.5 rounded-md text-sm border ${
            mode === "new" ? "bg-brand-600 text-white border-brand-600" : "bg-white text-slate-700"
          }`}
        >
          New customer
        </button>
      </div>

      {mode === "existing" ? (
        <Field label="Customer">
          <select
            value={form.customerId ?? ""}
            onChange={(e) => patch({ customerId: e.target.value })}
            className={inputCls}
          >
            <option value="">— select —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.phone ? `· ${c.phone}` : ""} · {c.type}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Name *">
            <input
              className={inputCls}
              value={form.newCustomer?.name ?? ""}
              onChange={(e) => patchNewCustomer({ name: e.target.value })}
            />
          </Field>
          <Field label="Phone">
            <input
              className={inputCls}
              value={form.newCustomer?.phone ?? ""}
              onChange={(e) => patchNewCustomer({ phone: e.target.value })}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              className={inputCls}
              value={form.newCustomer?.email ?? ""}
              onChange={(e) => patchNewCustomer({ email: e.target.value })}
            />
          </Field>
          <Field label="Type">
            <select
              className={inputCls}
              value={form.newCustomer?.type ?? "RETAIL"}
              onChange={(e) => patchNewCustomer({ type: e.target.value as any })}
            >
              <option value="RETAIL">Retail</option>
              <option value="WHOLESALE">Wholesale</option>
              <option value="END_CUSTOMER">End customer</option>
              <option value="INTERNAL">Internal</option>
            </select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Address">
              <textarea
                className={inputCls}
                rows={2}
                value={form.newCustomer?.address ?? ""}
                onChange={(e) => patchNewCustomer({ address: e.target.value })}
              />
            </Field>
          </div>
        </div>
      )}
    </div>
  );
}

function ItemStep({
  form, patch
}: { form: NewOrderInput; patch: (p: Partial<NewOrderInput>) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2">
        <Field label="Item description *" hint="e.g. Solitaire diamond engagement ring">
          <input
            className={inputCls}
            value={form.itemDescription}
            onChange={(e) => patch({ itemDescription: e.target.value })}
          />
        </Field>
      </div>
      <Field label="Metal *">
        <select className={inputCls} value={form.metal} onChange={(e) => patch({ metal: e.target.value as any })}>
          {METALS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
        </select>
      </Field>
      <Field label="Color">
        <select className={inputCls} value={form.color} onChange={(e) => patch({ color: e.target.value as any })}>
          {COLORS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
        </select>
      </Field>
      <Field label="Quantity">
        <input
          type="number" min={1}
          className={inputCls}
          value={form.qty}
          onChange={(e) => patch({ qty: Number(e.target.value) })}
        />
      </Field>
      <Field label="Size" hint="Ring size / chain length / bangle size">
        <input
          className={inputCls}
          value={form.size}
          onChange={(e) => patch({ size: e.target.value })}
        />
      </Field>
      <Field label="Gross weight estimate (g)">
        <input
          type="number" step={0.001} min={0}
          className={inputCls}
          value={form.grossWtEst}
          onChange={(e) => patch({ grossWtEst: Number(e.target.value) })}
        />
      </Field>
      <Field label="Priority">
        <select className={inputCls} value={form.priority} onChange={(e) => patch({ priority: e.target.value as any })}>
          <option value="NORMAL">Normal</option>
          <option value="RUSH">Rush</option>
          <option value="VIP">VIP</option>
        </select>
      </Field>
      <Field label="Order date">
        <input type="date" className={inputCls} value={form.orderDate}
          onChange={(e) => patch({ orderDate: e.target.value })} />
      </Field>
      <Field label="Expected delivery">
        <input type="date" className={inputCls} value={form.expectedDelivery}
          onChange={(e) => patch({ expectedDelivery: e.target.value })} />
      </Field>
    </div>
  );
}

function StonesStep({
  form, patch
}: { form: NewOrderInput; patch: (p: Partial<NewOrderInput>) => void }) {
  const add = () =>
    patch({
      stones: [
        ...form.stones,
        { type: "Diamond", shape: "Round", size: "", qty: 1, quality: "", source: "in-house" }
      ]
    });
  const update = (i: number, p: Partial<Stone>) => {
    const next = form.stones.slice();
    next[i] = { ...next[i], ...p };
    patch({ stones: next });
  };
  const remove = (i: number) => patch({ stones: form.stones.filter((_, j) => j !== i) });

  return (
    <div className="space-y-3">
      {form.stones.length === 0 && (
        <p className="text-sm text-slate-500">No stones yet. Skip this step if the piece has no stones.</p>
      )}
      {form.stones.map((s, i) => (
        <div key={i} className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end border rounded-md p-3">
          <Field label="Type">
            <input className={inputCls} value={s.type} onChange={(e) => update(i, { type: e.target.value })} />
          </Field>
          <Field label="Shape">
            <input className={inputCls} value={s.shape} onChange={(e) => update(i, { shape: e.target.value })} />
          </Field>
          <Field label="Size">
            <input className={inputCls} value={s.size} onChange={(e) => update(i, { size: e.target.value })} placeholder="e.g. 3mm" />
          </Field>
          <Field label="Qty">
            <input type="number" min={1} className={inputCls} value={s.qty}
              onChange={(e) => update(i, { qty: Number(e.target.value) })} />
          </Field>
          <Field label="Quality">
            <input className={inputCls} value={s.quality} onChange={(e) => update(i, { quality: e.target.value })} placeholder="VS1-F" />
          </Field>
          <div className="flex gap-2">
            <select
              className={inputCls}
              value={s.source}
              onChange={(e) => update(i, { source: e.target.value as any })}
            >
              <option value="in-house">In-house</option>
              <option value="customer">Customer</option>
            </select>
            <button type="button" onClick={() => remove(i)}
              className="px-2 text-sm text-red-600 hover:underline">Remove</button>
          </div>
        </div>
      ))}
      <button type="button" onClick={add}
        className="px-3 py-1.5 rounded-md border border-dashed border-brand-300 text-brand-700 text-sm hover:bg-brand-50">
        + Add stone
      </button>
    </div>
  );
}

function CommercialStep({
  form, patch
}: { form: NewOrderInput; patch: (p: Partial<NewOrderInput>) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Field label="Quoted price (₹)">
        <input
          type="number" step={0.01} min={0}
          className={inputCls}
          value={form.quotedPrice ?? ""}
          onChange={(e) => patch({ quotedPrice: e.target.value === "" ? undefined : Number(e.target.value) })}
        />
      </Field>
      <Field label="Advance paid (₹)">
        <input
          type="number" step={0.01} min={0}
          className={inputCls}
          value={form.advancePaid}
          onChange={(e) => patch({ advancePaid: Number(e.target.value) })}
        />
      </Field>
      <div className="md:col-span-2">
        <Field label="Special notes / instructions">
          <textarea className={inputCls} rows={3}
            value={form.specialNotes}
            onChange={(e) => patch({ specialNotes: e.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}

function ReviewStep({
  form, mode, customers
}: { form: NewOrderInput; mode: "existing" | "new"; customers: CustomerLite[] }) {
  const cust =
    mode === "existing"
      ? customers.find((c) => c.id === form.customerId)?.name ?? "—"
      : form.newCustomer?.name ?? "—";
  return (
    <div className="space-y-4 text-sm">
      <div>
        <h3 className="font-semibold text-slate-800 mb-1">Customer</h3>
        <p className="text-slate-700">{cust} {mode === "new" && form.newCustomer?.phone ? `· ${form.newCustomer.phone}` : ""}</p>
      </div>
      <div>
        <h3 className="font-semibold text-slate-800 mb-1">Item</h3>
        <p className="text-slate-700">
          {form.qty} × {form.itemDescription || "—"} · {METALS.find((m) => m.v === form.metal)?.l} ({form.color.toLowerCase()}) · {form.size || "no size"} · ~{form.grossWtEst}g
        </p>
        <p className="text-slate-500 text-xs mt-1">
          Priority {form.priority} · Order {form.orderDate} · Due {form.expectedDelivery}
        </p>
      </div>
      <div>
        <h3 className="font-semibold text-slate-800 mb-1">Stones ({form.stones.length})</h3>
        {form.stones.length === 0 ? (
          <p className="text-slate-500">No stones.</p>
        ) : (
          <ul className="list-disc list-inside text-slate-700">
            {form.stones.map((s, i) => (
              <li key={i}>
                {s.qty} × {s.type} {s.shape} {s.size} {s.quality ? `(${s.quality})` : ""} [{s.source}]
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3 className="font-semibold text-slate-800 mb-1">Commercial</h3>
        <p className="text-slate-700">
          Quote ₹{form.quotedPrice ?? "—"} · Advance ₹{form.advancePaid}
        </p>
        {form.specialNotes && <p className="text-slate-600 italic mt-1">"{form.specialNotes}"</p>}
      </div>
    </div>
  );
}

// -- Per-step validation (quick UX check; server re-validates with Zod) -------

function validateStep(step: StepName, f: NewOrderInput, mode: "existing" | "new"): string[] {
  const errs: string[] = [];
  if (step === "Customer") {
    if (mode === "existing" && !f.customerId) errs.push("Select a customer.");
    if (mode === "new" && !(f.newCustomer?.name?.trim())) errs.push("Enter a customer name.");
  }
  if (step === "Item") {
    if (!f.itemDescription.trim()) errs.push("Describe the item.");
    if (!f.orderDate) errs.push("Order date required.");
    if (!f.expectedDelivery) errs.push("Expected delivery required.");
    if (new Date(f.expectedDelivery) < new Date(f.orderDate))
      errs.push("Expected delivery cannot be before order date.");
    if (f.qty < 1) errs.push("Quantity must be at least 1.");
  }
  return errs;
}
