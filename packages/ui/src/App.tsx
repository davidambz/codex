// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { useEffect, useState } from "react";
import type { DataStatus, Platform, SearchHit } from "@iaframe/core";

// Placeholder screen proving the desktop plumbing end to end; the real
// search UI replaces it.
export function App({ platform }: { platform: Platform }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [status, setStatus] = useState<DataStatus>({ busy: false });

  useEffect(() => {
    void platform.getDataStatus().then(setStatus);
    return platform.onDataStatus(setStatus);
  }, [platform]);

  useEffect(() => {
    let current = true;
    void platform.search(query).then((result) => current && setHits(result));
    return () => {
      current = false;
    };
  }, [platform, query, status.info?.hash]);

  return (
    <main>
      <h1>IAFrame</h1>
      <p data-testid="status">
        {status.busy ? "Updating…" : status.info ? `${status.info.items} items` : "No data yet"}
      </p>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" />
      <ul>
        {hits.map((hit) => (
          <li key={hit.name}>{hit.name}</li>
        ))}
      </ul>
    </main>
  );
}
