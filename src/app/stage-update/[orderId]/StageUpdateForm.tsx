"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  startStage, completeAndAdvance, sendToRework, holdStage, resumeStage
} from "./actions";

type Karigar = { id: string; name: string; department: string | null };
type Stage = { id: string; name: string; code: string; sequence: number };

type Props = {
  orderId: string;
  history: {
    id: string;
    status: string;
    stageName: string;
    stageDepartment: string | null;
    wtIn: number | null;
    karigarId: string | null;
  };
  karigars: Karigar[];
  earlierStages: Stage[];
};

type Mode = "main" | "rework" | "hold";

export function StageUpdateForm({ orderId, history, karigars, earlierStages }: Props) {
  const router = useRouter();
  const [pending, startT] = useTransition();
  const [mode, setMode] = useState<Mode>("main");
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const [karigarId, setKarigarId] = useState(history.karigarId ?? "");
  const [wtIn, setWtIn] = useState<string>(history.wtIn != null ? String(history.wtIn) : "");
  const [wtOut, setWtOut] = useState<string>("");
  const [notes, setNotes] = useState("");

  const [reworkTarget, setReworkTarget] = useState(earlierStages[0]?.id ?? "");
  const [reworkReason, setReworkReason] = useState("");

  const [holdReason, setHoldReason] = useState("");

  const isPending = history.status === "PENDING";
  const isInProgress = history.status === "IN_PROGRESS";
  const isOnHold = history.status === "ON_HOLD";

  const wtLoss =
    wtIn !== "" && wtOut !== "" && !Number.isNaN(Number(wtIn)) && !Number.isNaN(Number(wtOut))
      ? (Number(wtIn) - Number(wtOut)).toFixed(3)
      : null;

  function show(res: { ok: boolean; error?: string; message?: string }) {
    if (res.ok) {
      setToast({ kind: "ok", msg: res.message ?? "Updated." });
      setTimeout(() => router.refresh(), 400);
    } else {
      setToast({ kind: "err", msg: res.error ?? "Failed" });
    }
  }

  function onStart() {
    if (!karigarId) return setToast({ kind: "err", msg: "Select a karigar first." });
    startT(async () => {
      const res = await startStage({
        historyId: history.id,
        karigarId,
        wtIn: wtIn === "" ? undefined : Number(wtIn),
        notes
      });
      show(res);
    });
  }

  function onComplete() {
    if (!karigarId) return setToast({ kind: "err", msg: "Assign a karigar." });
    if (wtOut === "") return setToast({ kind: "err", msg: "Enter weight out." });
    startT(async () => {
      const res = await completeAndAdvance({
        historyId: history.id,
        karigarId,
        wtIn: wtIn === "" ? undefined : Number(wtIn),
        wtOut: Number(wtOut),
        notes
      });
      show(res);
    });
  }

  function onRework() {
    if (!reworkTarget) return setToast({ kind: "err", msg: "Pick a stage to send back to." });
    if (reworkReason.trim().length < 3) return setToast({ kind: "err", msg: "Reason too short." });
    startT(async () => {
      const res = await sendToRework({
        historyId: history.id,
        targetStageId: reworkTarget,
        reason: reworkReason.trim()
      });
      show(res);
    });
  }

  function onHold() {
    if (holdReason.trim().length < 3) return setToast({ kind: "err", msg: "Reason too short." });
    startT(async () => {
      const res = await holdStage({ historyId: history.id, reason: holdReason.trim() });
      show(res);
    });
  }

  function onResume() {
    startT(async () => {
      const res = await resumeStage({ historyId: history.id });
      show(res);
    });
  }

  return (
    <div className="mt-3 space-y-3">
      {toast && (
        <div
          className={`rounded-lg p-3 text-sm ${
            toast.kind === "ok" ? "bg-green-50 border border-green-200 text-green-800"
                                : "bg-red-50 border border-red-200 text-red-700"
          }`}
          onClick={() => setToast(null)}
        >
          {toast.msg}
        </div>
      )}

      {mode === "main" && (
        <>
          {isOnHold ? (
            <div className="rounded-xl bg-white border p-4">
              <p className="text-sm text-amber-700 font-medium">This stage is on hold.</p>
              <button
                onClick={onResume}
                disabled={pending}
                className="mt-3 w-full rounded-lg bg-brand-600 text-white font-semibold py-3 text-base active:bg-brand-700 disabled:opacity-50"
              >
                Resume stage
              </button>
            </div>
          ) : (
            <div className="rounded-xl bg-white border p-4 space-y-3">
              <BigField label="Karigar">
                <select
                  className={bigInput}
                  value={karigarId}
                  onChange={(e) => setKarigarId(e.target.value)}
                >
                  <option value="">— select karigar —</option>
                  {karigars.map((k) => (
                    <option key={k.id} value={k.id}>{k.name}</option>
                  ))}
                </select>
              </BigField>

              <div className="grid grid-cols-2 gap-3">
                <BigField label="Weight in (g)">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.001"
                    className={bigInput}
                    value={wtIn}
                    onChange={(e) => setWtIn(e.target.value)}
                    placeholder="0.000"
                  />
                </BigField>
                <BigField label={isInProgress ? "Weight out (g) *" : "Weight out (g)"}>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.001"
                    className={bigInput}
                    value={wtOut}
                    onChange={(e) => setWtOut(e.target.value)}
                    placeholder="0.000"
                  />
                </BigField>
              </div>

              {wtLoss !== null && (
                <div className={`text-xs ${Number(wtLoss) < 0 ? "text-red-600" : "text-slate-600"}`}>
                  Weight loss: {wtLoss} g {Number(wtLoss) < 0 && "(gain — double-check!)"}
                </div>
              )}

              <BigField label="Notes">
                <textarea
                  rows={2}
                  className={bigInput}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything worth remembering…"
                />
              </BigField>

              {/* Primary action */}
              {isPending ? (
                <button
                  onClick={onStart}
                  disabled={pending}
                  className="w-full rounded-lg bg-brand-600 text-white font-semibold py-4 text-base active:bg-brand-700 disabled:opacity-50"
                >
                  {pending ? "Starting…" : "Start work"}
                </button>
              ) : (
                <button
                  onClick={onComplete}
                  disabled={pending}
                  className="w-full rounded-lg bg-green-600 text-white font-semibold py-4 text-base active:bg-green-700 disabled:opacity-50"
                >
                  {pending ? "Saving…" : "✓ Complete & advance"}
                </button>
              )}
            </div>
          )}

          {/* Secondary actions */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode("rework")}
              disabled={pending || isPending || earlierStages.length === 0 || isOnHold}
              className="rounded-lg bg-white border border-red-300 text-red-700 font-medium py-3 text-sm active:bg-red-50 disabled:opacity-40"
            >
              ↩︎ Send to rework
            </button>
            <button
              onClick={() => setMode("hold")}
              disabled={pending || isOnHold}
              className="rounded-lg bg-white border border-amber-300 text-amber-700 font-medium py-3 text-sm active:bg-amber-50 disabled:opacity-40"
            >
              ⏸ Hold
            </button>
          </div>
        </>
      )}

      {mode === "rework" && (
        <div className="rounded-xl bg-white border p-4 space-y-3">
          <h2 className="font-semibold text-red-800">Send to rework</h2>
          <BigField label="Send back to">
            <select
              className={bigInput}
              value={reworkTarget}
              onChange={(e) => setReworkTarget(e.target.value)}
            >
              {earlierStages.map((s) => (
                <option key={s.id} value={s.id}>{s.sequence}. {s.name}</option>
              ))}
            </select>
          </BigField>
          <BigField label="Reason *">
            <textarea
              rows={3}
              className={bigInput}
              value={reworkReason}
              onChange={(e) => setReworkReason(e.target.value)}
              placeholder="e.g. polishing mark on band, stone loose, size mismatch"
            />
          </BigField>
          <div className="flex gap-2">
            <button
              onClick={() => setMode("main")}
              className="flex-1 rounded-lg bg-white border py-3 text-sm"
            >Cancel</button>
            <button
              onClick={onRework}
              disabled={pending}
              className="flex-1 rounded-lg bg-red-600 text-white font-semibold py-3 text-sm active:bg-red-700 disabled:opacity-50"
            >{pending ? "Sending…" : "Confirm rework"}</button>
          </div>
        </div>
      )}

      {mode === "hold" && (
        <div className="rounded-xl bg-white border p-4 space-y-3">
          <h2 className="font-semibold text-amber-800">Put on hold</h2>
          <BigField label="Reason *">
            <textarea
              rows={3}
              className={bigInput}
              value={holdReason}
              onChange={(e) => setHoldReason(e.target.value)}
              placeholder="e.g. waiting for customer stone, size confirmation pending"
            />
          </BigField>
          <div className="flex gap-2">
            <button
              onClick={() => setMode("main")}
              className="flex-1 rounded-lg bg-white border py-3 text-sm"
            >Cancel</button>
            <button
              onClick={onHold}
              disabled={pending}
              className="flex-1 rounded-lg bg-amber-600 text-white font-semibold py-3 text-sm active:bg-amber-700 disabled:opacity-50"
            >{pending ? "Saving…" : "Confirm hold"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

const bigInput =
  "w-full rounded-lg border border-slate-300 px-3 py-3 text-base focus:border-brand-600 focus:ring-brand-600";

function BigField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
