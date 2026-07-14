import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** Green NS mark — matches @ns-suite/ui NsMark */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#9dc41a",
          borderRadius: 6,
          color: "#111111",
          fontSize: 14,
          fontWeight: 900,
          letterSpacing: "-0.04em",
          fontFamily:
            "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        NS
      </div>
    ),
    { ...size },
  );
}
