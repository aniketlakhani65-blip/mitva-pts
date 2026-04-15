"use server";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth/next";
import { revalidatePath } from "next/cache";
import {
  completeStageSchema, startStageSchema, reworkSchema, holdSchema, resumeSchema,
  type CompleteStageInput, type StartStageInput, type ReworkInput, type HoldInput, type ResumeInput
} from "./schema";

type ActionResult = { ok: true; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Not authenticated");
  const role = (session.user as any).role as string;
  if (!["ADMIN", "DEPARTMENT_HEAD", "KARIGAR", "QC", "SALES"].includes(role)) {
    throw new Error("Forbidden");
  }
  return { userId: (session.user as any).id as string, role };
}

function flattenErrors(issues: { path: (string | number)[]; message: string }[]) {
  const out: Record<string, string[]> = {};
  for (const i of issues) {
    const key = i.path.join(".") || "_root";
    (out[key] ||= []).push(i.message);
  }
  return out;
}

/** Start work on a pending stage: assign karigar, record wt-in, flip PENDING → IN_PROGRESS. */
export async function startStage(raw: StartStageInput): Promise<ActionResult> {
  try {
    const { userId } = await requireAuth();
    const parsed = startStageSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "Invalid input", fieldErrors: flattenErrors(parsed.error.issues) };
    const d = parsed.data;

    await prisma.$transaction(async (tx: any) => {
      const h = await tx.stageHistory.findUnique({ where: { id: d.historyId } });
      if (!h) throw new Error("Stage record not found");
      if (h.status !== "PENDING" && h.status !== "ON_HOLD") {
        throw new Error(`Cannot start a stage in status ${h.status}`);
      }
      await tx.stageHistory.update({
        where: { id: d.historyId },
        data: {
          karigarId: d.karigarId,
          wtIn: d.wtIn ?? h.wtIn,
          status: "IN_PROGRESS",
          inAt: h.inAt ?? new Date(),
          notes: d.notes ? `${h.notes ? h.notes + "\n" : ""}${d.notes}` : h.notes,
          recordedById: userId
        }
      });
      await tx.auditLog.create({
        data: {
          userId, entity: "StageHistory", entityId: d.historyId, action: "UPDATE",
          after: JSON.stringify({ event: "start", karigarId: d.karigarId, wtIn: d.wtIn })
        }
      });
    });

    revalidatePath(`/orders/${(await resolveOrderId(d.historyId))}`);
    revalidatePath("/stage-update");
    return { ok: true, message: "Started." };
  } catch (e: any) {
    return { ok: false, error: e.message ?? "Failed to start stage" };
  }
}

/** Complete the current stage and move the order to the next stage in sequence. */
export async function completeAndAdvance(raw: CompleteStageInput): Promise<ActionResult> {
  try {
    const { userId } = await requireAuth();
    const parsed = completeStageSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "Invalid input", fieldErrors: flattenErrors(parsed.error.issues) };
    const d = parsed.data;

    await prisma.$transaction(async (tx: any) => {
      const h = await tx.stageHistory.findUnique({
        where: { id: d.historyId },
        include: { stage: true, order: true }
      });
      if (!h) throw new Error("Stage record not found");
      if (h.status === "COMPLETED") throw new Error("Stage already completed");

      const now = new Date();
      const wtIn = d.wtIn ?? h.wtIn;
      const wtLoss = (wtIn != null && d.wtOut != null) ? Number((Number(wtIn) - Number(d.wtOut)).toFixed(3)) : null;

      // 1. Close the current stage row
      await tx.stageHistory.update({
        where: { id: d.historyId },
        data: {
          karigarId: d.karigarId,
          wtIn: wtIn ?? null,
          wtOut: d.wtOut,
          wtLoss,
          stonesIssued: d.stonesIssued?.length ? JSON.stringify(d.stonesIssued) : h.stonesIssued ?? undefined,
          stonesReturned: d.stonesReturned?.length ? JSON.stringify(d.stonesReturned) : undefined,
          notes: d.notes ? `${h.notes ? h.notes + "\n" : ""}${d.notes}` : h.notes,
          status: "COMPLETED",
          outAt: now,
          recordedById: userId
        }
      });

      // 2. Find the next stage
      const next = await tx.stage.findFirst({
        where: { sequence: { gt: h.stage.sequence }, active: true },
        orderBy: { sequence: "asc" }
      });

      if (next) {
        // 3a. Open the next stage and set pointer
        await tx.stageHistory.create({
          data: {
            orderId: h.orderId,
            stageId: next.id,
            inAt: now,
            status: "PENDING",
            wtIn: d.wtOut,         // carry over final weight as starting weight for next stage
            recordedById: userId
          }
        });
        await tx.order.update({
          where: { id: h.orderId },
          data: { currentStageId: next.id }
        });
      } else {
        // 3b. No next stage — order is ready for dispatch / completed
        await tx.order.update({
          where: { id: h.orderId },
          data: {
            status: "READY_FOR_DISPATCH",
            currentStageId: null,
            grossWtFinal: d.wtOut
          }
        });
      }

      await tx.auditLog.create({
        data: {
          userId, entity: "StageHistory", entityId: d.historyId, action: "STAGE_OUT",
          after: JSON.stringify({ wtOut: d.wtOut, nextStageId: next?.id ?? null })
        }
      });
    });

    const orderId = await resolveOrderId(raw.historyId);
    revalidatePath(`/orders/${orderId}`);
    revalidatePath(`/stage-update/${orderId}`);
    revalidatePath("/stage-update");
    revalidatePath("/");
    return { ok: true, message: "Advanced to next stage." };
  } catch (e: any) {
    return { ok: false, error: e.message ?? "Failed to complete stage" };
  }
}

/** Send the order back to an earlier stage for rework. */
export async function sendToRework(raw: ReworkInput): Promise<ActionResult> {
  try {
    const { userId } = await requireAuth();
    const parsed = reworkSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "Invalid input", fieldErrors: flattenErrors(parsed.error.issues) };
    const d = parsed.data;

    await prisma.$transaction(async (tx: any) => {
      const h = await tx.stageHistory.findUnique({
        where: { id: d.historyId },
        include: { stage: true }
      });
      if (!h) throw new Error("Stage record not found");

      const target = await tx.stage.findUnique({ where: { id: d.targetStageId } });
      if (!target) throw new Error("Target stage not found");
      if (target.sequence >= h.stage.sequence) throw new Error("Rework target must be an earlier stage");

      const now = new Date();

      // Close current stage with REWORK status
      await tx.stageHistory.update({
        where: { id: d.historyId },
        data: {
          status: "REWORK",
          outAt: now,
          reworkReason: d.reason,
          recordedById: userId
        }
      });

      // Open a new row at the target stage, linking back via reworkFromId
      await tx.stageHistory.create({
        data: {
          orderId: h.orderId,
          stageId: target.id,
          inAt: now,
          status: "PENDING",
          reworkFromId: h.id,
          reworkReason: d.reason,
          recordedById: userId
        }
      });

      await tx.order.update({
        where: { id: h.orderId },
        data: { currentStageId: target.id }
      });

      await tx.auditLog.create({
        data: {
          userId, entity: "StageHistory", entityId: d.historyId, action: "UPDATE",
          after: JSON.stringify({ event: "rework", targetStageId: target.id, reason: d.reason })
        }
      });
    });

    const orderId = await resolveOrderId(raw.historyId);
    revalidatePath(`/orders/${orderId}`);
    revalidatePath(`/stage-update/${orderId}`);
    revalidatePath("/stage-update");
    return { ok: true, message: "Sent for rework." };
  } catch (e: any) {
    return { ok: false, error: e.message ?? "Failed to send to rework" };
  }
}

/** Put the current stage on hold. */
export async function holdStage(raw: HoldInput): Promise<ActionResult> {
  try {
    const { userId } = await requireAuth();
    const parsed = holdSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "Invalid input", fieldErrors: flattenErrors(parsed.error.issues) };
    const d = parsed.data;

    await prisma.$transaction(async (tx: any) => {
      const h = await tx.stageHistory.findUnique({ where: { id: d.historyId } });
      if (!h) throw new Error("Stage record not found");
      if (h.status === "COMPLETED") throw new Error("Cannot hold a completed stage");

      await tx.stageHistory.update({
        where: { id: d.historyId },
        data: {
          status: "ON_HOLD",
          notes: `${h.notes ? h.notes + "\n" : ""}HOLD: ${d.reason}`,
          recordedById: userId
        }
      });
      await tx.order.update({
        where: { id: h.orderId },
        data: { status: "ON_HOLD" }
      });
      await tx.auditLog.create({
        data: {
          userId, entity: "StageHistory", entityId: d.historyId, action: "UPDATE",
          after: JSON.stringify({ event: "hold", reason: d.reason })
        }
      });
    });

    const orderId = await resolveOrderId(raw.historyId);
    revalidatePath(`/orders/${orderId}`);
    revalidatePath(`/stage-update/${orderId}`);
    revalidatePath("/stage-update");
    return { ok: true, message: "Put on hold." };
  } catch (e: any) {
    return { ok: false, error: e.message ?? "Failed to hold stage" };
  }
}

/** Resume an on-hold stage back to IN_PROGRESS. */
export async function resumeStage(raw: ResumeInput): Promise<ActionResult> {
  try {
    const { userId } = await requireAuth();
    const parsed = resumeSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "Invalid input", fieldErrors: flattenErrors(parsed.error.issues) };
    const d = parsed.data;

    await prisma.$transaction(async (tx: any) => {
      const h = await tx.stageHistory.findUnique({ where: { id: d.historyId } });
      if (!h) throw new Error("Stage record not found");
      if (h.status !== "ON_HOLD") throw new Error("Stage is not on hold");

      await tx.stageHistory.update({
        where: { id: d.historyId },
        data: { status: h.karigarId ? "IN_PROGRESS" : "PENDING", recordedById: userId }
      });
      await tx.order.update({
        where: { id: h.orderId },
        data: { status: "IN_PROGRESS" }
      });
      await tx.auditLog.create({
        data: {
          userId, entity: "StageHistory", entityId: d.historyId, action: "UPDATE",
          after: JSON.stringify({ event: "resume" })
        }
      });
    });

    const orderId = await resolveOrderId(raw.historyId);
    revalidatePath(`/orders/${orderId}`);
    revalidatePath(`/stage-update/${orderId}`);
    revalidatePath("/stage-update");
    return { ok: true, message: "Resumed." };
  } catch (e: any) {
    return { ok: false, error: e.message ?? "Failed to resume stage" };
  }
}

// -- helpers ------------------------------------------------------------------

async function resolveOrderId(historyId: string): Promise<string> {
  const h = await prisma.stageHistory.findUnique({
    where: { id: historyId }, select: { orderId: true }
  });
  return h?.orderId ?? "";
}
