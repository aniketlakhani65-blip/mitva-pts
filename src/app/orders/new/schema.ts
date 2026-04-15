import { z } from "zod";

export const stoneSchema = z.object({
  type: z.string().min(1, "Stone type required"),
  shape: z.string().optional().default(""),
  size: z.string().optional().default(""),
  qty: z.coerce.number().int().min(1, "At least 1"),
  quality: z.string().optional().default(""),
  source: z.enum(["in-house", "customer"]).default("in-house")
});

export const newOrderSchema = z.object({
  // Customer: either pick an existing customer or create a new one inline
  customerId: z.string().optional(),
  newCustomer: z
    .object({
      name: z.string().min(1, "Name required"),
      phone: z.string().optional().default(""),
      email: z.string().email().optional().or(z.literal("")).default(""),
      address: z.string().optional().default(""),
      type: z.enum(["RETAIL", "WHOLESALE", "END_CUSTOMER", "INTERNAL"]).default("RETAIL")
    })
    .optional(),

  // Order details
  orderDate: z.string().min(1),             // ISO date string
  expectedDelivery: z.string().min(1),      // ISO date string
  priority: z.enum(["NORMAL", "RUSH", "VIP"]).default("NORMAL"),

  metal: z.enum(["GOLD_22K", "GOLD_18K", "GOLD_14K", "SILVER", "PLATINUM"]),
  color: z.enum(["YELLOW", "WHITE", "ROSE", "NA"]).default("YELLOW"),
  qty: z.coerce.number().int().min(1).default(1),
  grossWtEst: z.coerce.number().min(0).default(0),

  // Commercial
  quotedPrice: z.coerce.number().min(0).optional(),
  advancePaid: z.coerce.number().min(0).default(0),

  // Item + stones
  itemDescription: z.string().min(1, "Describe the item"),
  size: z.string().optional().default(""),
  stones: z.array(stoneSchema).default([]),

  specialNotes: z.string().optional().default("")
}).refine(
  (d) => !!d.customerId || !!d.newCustomer?.name,
  { message: "Select an existing customer or fill in new customer details", path: ["customerId"] }
);

export type NewOrderInput = z.infer<typeof newOrderSchema>;
export type Stone = z.infer<typeof stoneSchema>;
