import { NextResponse } from "next/server";

// We use an anonymous, free, reliable KV store over HTTP (kvdb.io)
// with a unique bucket ID to store shared profile JSONs.
const BUCKET_ID = "ot_share_bucket_899a4564";
const KV_URL = `https://kvdb.io/${BUCKET_ID}`;

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function POST(request: Request) {
  try {
    const { token, data } = await request.json();

    if (!token || !data) {
      return NextResponse.json({ error: "Missing token or data" }, { status: 400 });
    }

    // Save data to kvdb.io
    const response = await fetch(`${KV_URL}/${token}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to store data in KV: ${response.statusText}`);
    }

    return NextResponse.json({ success: true }, {
      headers: {
        "Access-Control-Allow-Origin": "*",
      }
    });
  } catch (error: any) {
    console.error("Export profile save error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    // Fetch data from kvdb.io
    const response = await fetch(`${KV_URL}/${token}`);

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: "Profile not found or expired" }, { status: 404 });
      }
      throw new Error(`Failed to fetch data from KV: ${response.statusText}`);
    }

    const data = await response.json();

    return NextResponse.json(data, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error: any) {
    console.error("Export profile fetch error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
