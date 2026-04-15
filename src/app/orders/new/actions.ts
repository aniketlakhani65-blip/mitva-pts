"use server";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth/next";
import { nextJobNo } from "@/lib/jobNo";
import { newOrderSchema, type NewOrderInput } from "./schema";
import { revalidatePath } from "next/cache";

export type CreateOrderResult =
  | { ok: true; orderId: string; jobNo: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function createOrder(raw: NewOrderInput): Promise<CreateOrderResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: "Not authenticated" };

  const role = (session.user as any).role;
  if (!["ADMIN", "SALES"].includes(role)) {
    return { ok: false, error: "You do not have permission to create orders." };
  }

  const parsed = newOrderSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "_root";
      (fieldErrors[key] ||= []).push(issue.message);
    }
    return { ok: false, error: "Please correct the highlighted fields.", fieldErrors };
  }
  const data = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Resolve customer (create if needed)
      let customerId = data.customerId;
      if (!customerId) {
        const nc = data.newCustomer!;
        const created = await tx.customer.create({
          data: {
            name: nc.name.trim(),
            phone: nc.phone || null,
            email: nc.email || null,
            address: nc.address || null,
            type: nc.type
          }
        });
        customerId = created.id;
      } else {
        const existing = await tx.customer.findUnique({ where: { id: customerId } });
        if (!existing) throw new Error("Customer not found");
      }

      // 2. Job number
      const jobNo = await nextJobNo();

      // 3. Find the "Order Booking" stage (first stage in workflow)
      const bookingStage = await tx.stage.findFirst({ orderBy: { sequence: "asc" } });
      if (!bookingStage) throw new Error("No stages configured — seed the database first.");

      // 4. Create order + item
      const order = await tx.order.create({
        data: {
          jobNo,
          customerId,
          orderDate: new Date(data.orderDate),
          expectedDelivery: new Date(data.expectedDelivery),
          priority: data.priority,
          status: "IN_PROGRESS",
          metal: data.metal,
          color: data.color,
          qty: data.qty,
          grossWtEst: data.grossWtEst,
          quotedPrice: data.quotedPrice ?? null,
          advancePaid: data.advancePaid,
          specialNotes: data.specialNotes || null,
          createdById: (session.user as any).id,
          currentStageId: bookingStage.id,
          items: {
            create: [
              {
                description: data.itemDescription,
                size: data.size || null,
                qty: data.qty,
                stonesJson: data.stones.length ? JSON.stringify(data.stones) : undefined
              }
            ]
          }
        }
      });

      // 5. Open the Booking stage row (completed since booking happens at order creation)
      const now = new Date();
      await tx.stageHistory.create({
        data: {
          orderId: order.id,
          stageId: bookingStage.id,
          inAt: now,
          outAt: now,
          status: "COMPLETED",
          recordedById: (session.user as any).id,
          notes: "Order booked"
        }
      });

      // 6. Move pointer to the next stage (if any) and open it
      const nextStage = await tx.stage.findFirst({
        where: { sequence: { gt: bookingStage.sequence } },
        orderBy: { sequence: "asc" }
      });
      if (nextStage) {
        await tx.order.update({
          where: { id: order.id },
          data: { currentStageId: nextStage.id }
        });
        await tx.stageHistory.create({
          data: {
            orderId: order.id,
            stageId: nextStage.id,
            inAt: now,
            status: "PENDING",
            recordedById: (session.user as any).id
          }
        });
      }

      // 7. Audit log
      await tx.auditLog.create({
        data: {
          userId: (session.user as any).id,
          entity: "Order",
          entityId: order.id,
          action: "CREATE",
          after: JSON.stringify({ jobNo, customerId, metal: data.metal, qty: data.qty })
        }
      });

      return { id: order.id, jobNo: order.jobNo };
    });

    revalidatePath("/");
    revalidatePath("/orders");

    return { ok: true, orderId: result.id, jobNo: result.jobNo };
  } catch (err: any) {
    console.error("createOrder failed:", err);
    return { ok: false, error: err.message || "Failed to create order" };
  }
}

/** Small helper loaded by the form to pick customers without a separate API route. */
export async function searchCustomers(query: string) {
  const q = query.trim();
  return prisma.customer.findMany({
    where: q
      ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] }
      : {},
    orderBy: { name: "asc" },
    take: 10,
    select: { id: true, name: true, phone: true, type: true }
  });
}
