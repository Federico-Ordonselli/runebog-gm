import { db } from "@/db";
import { campaigns } from "@/db/schema";
import { projectForPlayers } from "@/lib/share";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * Lo stato del tavolo, per il polling dell'app. Sola lettura: qui non esiste una PATCH,
 * e non è una svista — è il modo in cui la sola lettura viene garantita. Nascondere i
 * pulsanti di modifica nell'interfaccia non impedirebbe a nessuno di chiamare l'API.
 */
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [row] = await db.select().from(campaigns).where(eq(campaigns.shareToken, token));
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  const state = projectForPlayers(row.data as any);
  if (!state) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json(
    { name: row.name, state, updatedAt: row.updatedAt },
    // il link è segreto: che non finisca in nessuna cache condivisa lungo la strada
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
