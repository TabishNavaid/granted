import { ImageResponse } from "next/og";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/brand";

export const alt = `${PRODUCT_NAME}: ${PRODUCT_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#14201B";
const MUTED = "#52605A";
const RULE = "#DFE3DE";
const FELLOW = "#1E5B43";

/** The mark on a 32 unit grid, drawn with boxes so the card needs no image file. */
function Mark({ size: s, color }: { size: number; color: string }) {
  const u = s / 32;
  const box = (x: number, y: number, w: number, h: number) => <div style={{ position: "absolute", left: x * u, top: y * u, width: w * u, height: h * u, background: color }} />;
  return (
    <div style={{ position: "relative", width: s, height: s, display: "flex" }}>
      {box(5, 5, 22, 4)}
      {box(5, 5, 4, 22)}
      {box(23, 5, 4, 22)}
      {box(9, 14, 4.5, 3.5)}
      {box(18.5, 14, 4.5, 3.5)}
    </div>
  );
}

/** The sharing card: the lockup, the promise, and the sources, set like a register entry. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 72px", background: "#FFFFFF", color: INK }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Mark size={52} color={INK} />
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>{PRODUCT_NAME}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 28, borderTop: `3px solid ${INK}`, paddingTop: 32 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.04, letterSpacing: -2.5, maxWidth: 1040 }}>{PRODUCT_TAGLINE}</div>
          <div style={{ fontSize: 30, color: MUTED, maxWidth: 1040, lineHeight: 1.35 }}>Grants.gov, SAM.gov, state and city bids, NIH, NSF, and private foundations in every state. Drafted from your own records. A person approves everything.</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${RULE}`, paddingTop: 20, fontSize: 24, color: MUTED }}>
          <div>fundfellows.com</div>
          <div style={{ color: FELLOW, fontWeight: 700 }}>Free while we learn</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
