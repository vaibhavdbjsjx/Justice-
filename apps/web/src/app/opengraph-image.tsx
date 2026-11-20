import { ImageResponse } from "next/og";

export const alt = "Lexa: Understand your legal situation in minutes";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The card shown when a Lexa link is shared. */
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#1f1e1d",
          color: "#f5f4ef",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 40 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "#c15f3c",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
              fontWeight: 700,
              color: "white",
            }}
          >
            L
          </div>
          Lexa
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 76, lineHeight: 1.08, letterSpacing: -2, maxWidth: 980 }}>
            Understand your legal situation in minutes.
          </div>
          <div style={{ fontSize: 30, color: "#e08e70" }}>
            Plain-language answers, scoped to where you live.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
