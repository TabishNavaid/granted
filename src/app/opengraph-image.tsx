import { ImageResponse } from "next/og";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/brand";

export const alt = `${PRODUCT_NAME}: ${PRODUCT_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The sharing card: the name, the tagline, white paper, blue ink. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#ffffff", color: "#24318A", fontFamily: "Georgia, serif" }}>
        <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1 }}>{PRODUCT_NAME}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 88, fontWeight: 800, lineHeight: 1, letterSpacing: -3, maxWidth: 1000 }}>{PRODUCT_TAGLINE}</div>
          <div style={{ fontSize: 32, color: "#4a5aa8", maxWidth: 1000 }}>Find grants you can win, draft from your own facts, keep every deadline. You approve everything.</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
