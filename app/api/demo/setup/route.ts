import { NextResponse } from "next/server";
import { demoMode, seedDemo } from "@/lib/demo";

/**
 * Test site only: open /api/demo/setup?key=<DEMO_SETUP_KEY> once after the
 * database is created to add the demo accounts and sample listings.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = process.env.DEMO_SETUP_KEY;
  if (!demoMode() || !key || url.searchParams.get("key") !== key) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const result = await seedDemo(url.origin);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
