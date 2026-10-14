import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { CATEGORIES, UNITS } from "./constants";
import type { ListingDraft } from "./types";

const FIELD_NAMES = ["title", "category", "quantity", "unit", "condition", "grade", "specs", "price"] as const;

const DraftSchema = z.object({
  is_building_material: z
    .boolean()
    .describe("false if the photos show no construction material, tool or fixture"),
  title: z.string().describe("Short buyer-facing title with size and quantity, e.g. '40 sheets 1/2 in drywall, 4x8'"),
  category: z.enum(CATEGORIES),
  quantity: z.number().describe("How many units are visible or stated; your best count"),
  unit: z.enum(UNITS),
  condition: z.enum(["new", "like_new", "used", "salvage"]),
  grade: z.enum(["structural", "non_structural", "scrap"]),
  specs: z
    .array(z.object({ name: z.string(), value: z.string() }))
    .describe("Up to 6 useful specs read from labels or obvious from the item: dimensions, thickness, gauge, brand, rating, colour"),
  description: z.string().describe("Two short sentences a contractor would want: what it is, state, anything notable. No sales fluff."),
  price_low_cad: z.number(),
  price_high_cad: z.number(),
  suggested_price_cad: z.number(),
  uncertain_fields: z
    .array(z.enum(FIELD_NAMES))
    .describe("Fields you are not confident about from the photos; the seller will be asked to check them"),
});

const SYSTEM = `You write listings for TradeGrade, a Toronto marketplace where contractors sell leftover construction material from job sites to other contractors and DIYers nearby.

From the seller's photos, fill in the listing. Read labels, stamps, bundle tags and packaging to get exact product names, sizes and counts. Count visible units when you can; if a stack's depth is hidden, estimate and mark quantity as uncertain.

Pricing: surplus sells at roughly 40 to 70% of new retail in Toronto, lower for used, opened or weathered material, and near zero for scrap. Give a low-high range in CAD and a suggested price that would sell within a few days. Round to sensible numbers ($5 steps under $100, $10 or $25 steps above).

Grade: "structural" for load-bearing lumber, steel, engineered wood and anything rated; "non_structural" for finishes, drywall, insulation, fixtures, tools; "scrap" for offcuts and salvage.

Put a field in uncertain_fields whenever you are guessing rather than reading it from the photo. If the photos do not show building material, set is_building_material to false and fill the other fields with your best guess.`;

export class DraftError extends Error {}

export async function draftListingFromPhotos(images: { data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" }[]): Promise<ListingDraft> {
  const client = new Anthropic({ timeout: 25_000, maxRetries: 1 });

  const response = await client.messages.parse({
    model: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
    max_tokens: 4000,
    system: SYSTEM,
    output_config: { effort: "low", format: zodOutputFormat(DraftSchema) },
    messages: [
      {
        role: "user",
        content: [
          ...images.map((img) => ({
            type: "image" as const,
            source: { type: "base64" as const, media_type: img.mediaType, data: img.data },
          })),
          { type: "text", text: `Here ${images.length === 1 ? "is the photo" : `are ${images.length} photos`} of what I'm selling. Draft the listing.` },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new DraftError("Claude couldn't read these photos");
  }
  return response.parsed_output;
}

/** AI_MODE=mock: a canned draft for testing without an API key. */
export function mockDraft(): ListingDraft {
  return {
    is_building_material: true,
    title: "40 sheets 1/2 in drywall, 4x8",
    category: "Drywall",
    quantity: 40,
    unit: "sheets",
    condition: "new",
    grade: "non_structural",
    specs: [
      { name: "Size", value: "4 ft x 8 ft" },
      { name: "Thickness", value: "1/2 in" },
      { name: "Type", value: "Regular, light-weight" },
      { name: "Brand", value: "CGC Sheetrock (from bundle tag)" },
    ],
    description: "Two unopened bundles left over from a condo fit-out, stored indoors on a skid. Edges and paper are clean.",
    price_low_cad: 280,
    price_high_cad: 400,
    suggested_price_cad: 340,
    uncertain_fields: ["quantity", "price"],
  };
}
