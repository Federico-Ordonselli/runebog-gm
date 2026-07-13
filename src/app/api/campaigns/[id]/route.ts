import { auth } from "@/auth";
import { db } from "@/db";
import { campaigns } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

const MAX_BYTES = 4 * 1024 * 1024; // limite body Vercel ~4.5MB: immagini enormi → storage esterno in v2

async function owned(id: string) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const [row] = await db.select().from(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.userId, session.user.id)));
  return row ?? null;
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await owned(id);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await owned(id);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  const text = await req.text();
  if (text.length > MAX_BYTES)
    return NextResponse.json({ error: "campagna troppo grande: sposta le immagini fuori dal JSON" }, { status: 413 });
  let body: any;
  try { body = JSON.parse(text); } catch { return NextResponse.json({ error: "json non valido" }, { status: 400 }); }
  const data = body.data;
  if (!data?.root || !Array.isArray(data.checklist) || !Array.isArray(data.players))
    return NextResponse.json({ error: "formato non valido" }, { status: 400 });
  const name = (data.root.title || row.name).slice(0, 120);
  await db.update(campaigns)
    .set({ data, name, updatedAt: new Date() })
    .where(eq(campaigns.id, id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await owned(id);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  await db.delete(campaigns).where(eq(campaigns.id, id));
  return NextResponse.json({ ok: true });
}
