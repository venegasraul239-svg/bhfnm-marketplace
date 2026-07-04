"use client";

// next/image wrapper that degrades to a branded placeholder tile when the
// remote image 404s or fails to load — no broken-image icons in production.

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

export function SafeImage(props: ImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        aria-hidden
        className="flex h-full w-full items-center justify-center bg-ink-800"
      >
        <span className="font-display text-2xl font-black text-ink-600">B</span>
      </div>
    );
  }
  return <Image {...props} onError={() => setFailed(true)} />;
}
