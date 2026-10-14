import { NextResponse } from "next/server";
import { demoMode, seedDemo } from "@/lib/demo";

/**
 * Test site only: open /api/demo/setup?key=<DEMO_SETUP_KEY> once after the
 * database is created to add the demo accounts and sample listings.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = process.env.DEMO_SETUP_KEY;
  if (!demoMode()) {
    return NextResponse.json({ error: "Demo mode is off. Set the build variable NEXT_PUBLIC_DEMO_MODE to 1 and redeploy." }, { status: 404 });
  }
  if (!key) {
    return NextResponse.json({ error: "DEMO_SETUP_KEY isn't set on this worker." }, { status: 404 });
  }
  if (url.searchParams.get("key") !== key) {
    return NextResponse.json({ error: "That key doesn't match DEMO_SETUP_KEY." }, { status: 403 });
  }
  try {
    const result = await seedDemo(url.origin);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
