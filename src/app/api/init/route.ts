import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const admin = await prisma.user.upsert({
      where: { email: "admin@mitva.local" },
      update: {},
      create: {
        name: "Aniket (Owner)",
        email: "admin@mitva.local",
        passwordHash: bcrypt.hashSync("admin123", 10),
        role: "ADMIN" as any,
      },
    });
    return NextResponse.json({ ok: true, adminId: admin.id, email: admin.email });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
