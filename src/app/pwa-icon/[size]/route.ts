import { brandIcon } from "@/lib/brand-icon";

const SIZES = new Set([192, 512]);

// Icons referenced by the web app manifests.
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Number((await params).size);
  if (!SIZES.has(size)) return new Response("Not found", { status: 404 });
  const res = brandIcon(size);
  res.headers.set("Cache-Control", "public, max-age=604800");
  return res;
}
