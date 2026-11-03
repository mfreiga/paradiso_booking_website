import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Public portrait of a barber. The URL stored in Stylist.photoUrl carries a
// ?v=<timestamp>, so a new upload gets a new URL and long caching is safe.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await prisma.stylist.findUnique({
    where: { id },
    select: { photoData: true, photoMime: true },
  });
  if (!s?.photoData || !s.photoMime) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(s.photoData), {
    headers: {
      "Content-Type": s.photoMime,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
