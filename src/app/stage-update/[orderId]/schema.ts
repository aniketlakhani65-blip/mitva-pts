import { z } from "zod";

// Stone reconciliation entry
const stoneRecon = z.object({
  type: z.string(),
  qty: z.coerce.number().int().min(0)
});

export const completeStageSchema = z.object({
  historyId: z.string().min(1),        // the open StageHistory row id
  karigarId: z.string().min(1, "Assign a karigar"),
  wtIn: z.coerce.number().min(0).optional(),
  wtOut: z.coerce.number().min(0),
  stonesIssued: z.array(stoneRecon).optional(),
  stonesReturned: z.array(stoneRecon).optional(),
  notes: z.string().optional().default("")
});

export const startStageSchema = z.object({
  historyId: z.string().min(1),
  karigarId: z.string().min(1, "Assign a karigar"),
  wtIn: z.coerce.number().min(0).optional(),
  notes: z.string().optional().default("")
});

export const reworkSchema = z.object({
  historyId: z.string().min(1),
  targetStageId: z.string().min(1, "Select a stage to send back to"),
  reason: z.string().min(3, "Reason required (min 3 chars)")
});

export const holdSchema = z.object({
  historyId: z.string().min(1),
  reason: z.string().min(3, "Reason required")
});

export const resumeSchema = z.object({
  historyId: z.string().min(1)
});

export type CompleteStageInput = z.infer<typeof completeStageSchema>;
export type StartStageInput = z.infer<typeof startStageSchema>;
export type ReworkInput = z.infer<typeof reworkSchema>;
export type HoldInput = z.infer<typeof holdSchema>;
export type ResumeInput = z.infer<typeof resumeSchema>;
