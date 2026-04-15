import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { OrderWizard } from "./OrderWizard";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const role = (session.user as any).role;
  if (!["ADMIN", "SALES"].includes(role)) {
    return (
      <main className="p-8 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold">Not authorized</h1>
        <p className="text-sm text-slate-600 mt-2">Only Admin and Sales roles can create orders.</p>
      </main>
    );
  }

  const customers = await prisma.customer.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, phone: true, type: true }
  });

  return <OrderWizard customers={customers} />;
}
