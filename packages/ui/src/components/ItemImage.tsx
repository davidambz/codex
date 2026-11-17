// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { useState } from "react";
import { usePlatform } from "../platform/PlatformContext";

/** A warframe-items picture, lazy, that quietly disappears if it can't be had (offline, first run). */
export function ItemImage({ imageName, className }: { imageName?: string; className?: string }) {
  const platform = usePlatform();
  const [failed, setFailed] = useState(false);
  if (!imageName || failed) return <span className={className} data-empty="" aria-hidden />;
  return (
    <img
      className={className}
      src={platform.imageUrl(imageName)}
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}
