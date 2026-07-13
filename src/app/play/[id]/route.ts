import { auth } from "@/auth";
import { db } from "@/db";
import { campaigns } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { readFile } from "fs/promises";
import path from "path";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return Response.redirect(new URL("/", process.env.AUTH_URL || "http://localhost:3000"));
  const [row] = await db.select().from(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.userId, session.user.id)));
  if (!row) return new Response("Campagna non trovata", { status: 404 });

  const html = await readFile(path.join(process.cwd(), "public", "app.html"), "utf8");
  // inietto stato e id PRIMA dello script dell'app: il boot li troverà in window.__cloud
  const bridge = `<script>window.__cloud = { id: ${JSON.stringify(row.id)}, state: ${JSON.stringify(row.data)} };</script>`;
  const out = html.replace("<script>", bridge + "\n<script>");
  return new Response(out, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
