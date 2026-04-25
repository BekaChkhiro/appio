import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const name = searchParams.get("name") ?? "Appio App";
  const color = searchParams.get("color") ?? "#7c3aed";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0a0a12",
          fontFamily: "sans-serif",
        }}
      >
        {/* App icon */}
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: 28,
            backgroundColor: color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 56,
            fontWeight: 700,
            color: "#ffffff",
            marginBottom: 32,
          }}
        >
          {name.charAt(0).toUpperCase()}
        </div>

        {/* App name */}
        <div
          style={{
            fontSize: 48,
            fontWeight: 700,
            color: "#ffffff",
            marginBottom: 12,
            maxWidth: 900,
            textAlign: "center",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </div>

        {/* Branding */}
        <div
          style={{
            fontSize: 22,
            color: "#a1a1aa",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          Built with Appio
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
