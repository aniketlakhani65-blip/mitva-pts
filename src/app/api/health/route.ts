import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [users, orders, stages] = await Promise.all([
      prisma.user.count(),
      prisma.order.count(),
      prisma.stage.count()
    ]);
    return NextResponse.json({ ok: true, users, orders, stages });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
