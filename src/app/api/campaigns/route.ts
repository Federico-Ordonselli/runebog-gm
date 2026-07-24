import { auth } from "@/auth";
import { db } from "@/db";
import { campaigns } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { newCampaignData } from "@/lib/campaigns";
import { campaignErrorMessage, prepareCampaignDocument } from "@/lib/formato-campagna";

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
  // Rigido in scrittura: nel JSONB entra solo ciò che passa il contratto, già
  // migrato alla versione corrente. Si valida anche il documento di fabbrica:
  // così newCampaignData non può divergere dal contratto senza che il primo
  // POST se ne accorga.
  const prepared = prepareCampaignDocument(body.data ?? newCampaignData(name));
  if (!prepared.ok) {
    const status = prepared.error.code === "document_too_large" ? 413 : 422;
    return NextResponse.json({
      error: "invalid_document",
      detail: { ...prepared.error, message: campaignErrorMessage(prepared.error) },
    }, { status });
  }
  const [row] = await db.insert(campaigns)
    .values({ userId: session.user.id, name, data: prepared.value })
    .returning({ id: campaigns.id });
  return NextResponse.json(row, { status: 201 });
}
