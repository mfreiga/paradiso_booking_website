"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadBarberPhoto } from "@/app/admin/(dashboard)/barbers/actions";

const MAX_SIDE = 800;

/** Downscales to ≤ 800 px (longest side) JPEG, so phone photos fit the 1 MB action limit. */
async function resize(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", 0.85),
  );
}

export function BarberPhotoUpload({ stylistId, hasPhoto }: { stylistId: string; hasPhoto: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    startTransition(async () => {
      try {
        const blob = await resize(file);
        const fd = new FormData();
        fd.set("id", stylistId);
        fd.set("photo", new File([blob], "photo.jpg", { type: "image/jpeg" }));
        const res = await uploadBarberPhoto(fd);
        if (!res.ok) setError(res.error);
        else router.refresh();
      } catch {
        setError("Das Bild konnte nicht gelesen werden. Bitte ein anderes Foto versuchen.");
      }
    });
  }

  return (
    <div>
      <input ref={input} type="file" accept="image/*" onChange={onPick} className="hidden" />
      <button
        type="button"
        disabled={pending}
        onClick={() => input.current?.click()}
        className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
      >
        {pending ? "Wird hochgeladen…" : hasPhoto ? "Foto ersetzen" : "Foto hochladen"}
      </button>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
