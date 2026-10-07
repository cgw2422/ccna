import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getStorage } from "@/lib/storage";

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const user = await getApiUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const filename = decodeURIComponent((await params).name);
  const asset = await prisma.mediaAsset.findUnique({ where: { userId_filename: { userId: user.id, filename } } });
  if (!asset) return new NextResponse("Not found", { status: 404 });
  const data = await getStorage().get(asset.storageKey);
  if (!data) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(data as unknown as BodyInit, {
    headers: {
      "Content-Type": asset.contentType,
      "Cache-Control": "private, max-age=86400",
      ETag: `"${asset.sha1 ?? asset.id}"`,
      // SVGs could carry scripts — sandbox them.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
