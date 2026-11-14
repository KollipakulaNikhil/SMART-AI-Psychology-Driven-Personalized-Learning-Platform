import { NextResponse } from "next/server";

/** Liveness only — no version, uptime or dependency detail for a stranger to read. */
export async function GET() {
  return NextResponse.json({ success: true, data: { status: "ok" } });
}
