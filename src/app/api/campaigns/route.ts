import { auth } from "@/auth";
import { db } from "@/db";
import { campaigns } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { newCampaignData } from "@/lib/campaigns";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await db.select({ id: campaigns.id, name: campaigns.name, updatedAt: campaigns.updatedAt })
    .from(campaigns).where(eq(campaigns.userId, session.user.id))
    .orderBy(desc(campaigns.updatedAt));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const name = (body.name || "Nuova campagna").slice(0, 120);
  const data = body.data ?? newCampaignData(name);
  const [row] = await db.insert(campaigns)
    .values({ userId: session.user.id, name, data })
    .returning({ id: campaigns.id });
  return NextResponse.json(row, { status: 201 });
}
