import { ImageResponse } from "next/og";

/** The orange-P-on-black app icon (same as app/icon.svg) as a PNG of the given size. */
export function brandIcon(size: number) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "#f97316",
          fontSize: size * 0.62,
          fontWeight: 700,
          fontFamily: "Georgia, serif",
        }}
      >
        P
      </div>
    ),
    { width: size, height: size },
  );
}
