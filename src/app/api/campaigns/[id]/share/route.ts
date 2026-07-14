import { auth } from "@/auth";
import { db } from "@/db";
import { campaigns } from "@/db/schema";
import { newShareToken } from "@/lib/share";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

async function owned(id: string) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const [row] = await db.select().from(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.userId, session.user.id)));
  return row ?? null;
}

/** Crea il link del tavolo, o ne genera uno nuovo: il vecchio smette di funzionare. */
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await owned(id);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  const token = newShareToken();
  await db.update(campaigns).set({ shareToken: token }).where(eq(campaigns.id, id));
  return NextResponse.json({ token });
}

/** Chiude il tavolo: i link già distribuiti diventano 404. */
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await owned(id);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  await db.update(campaigns).set({ shareToken: null }).where(eq(campaigns.id, id));
  return NextResponse.json({ ok: true });
}
