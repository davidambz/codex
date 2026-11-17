// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { useCallback, useRef, useState } from "react";
import { Header } from "./components/Header";
import { BackIcon } from "./components/icons";
import { useDataStatus } from "./hooks/useDataStatus";
import { useSystemTheme } from "./hooks/useSystemTheme";
import { useI18n } from "./i18n/I18nContext";
import { ItemNamesProvider } from "./names/ItemNamesProvider";
import { useItemNames } from "./names/ItemNamesContext";
import type { View } from "./navigation";
import { Home } from "./screens/Home";
import { ItemView } from "./screens/ItemView";
import { NoData } from "./screens/NoData";
import { SearchPane } from "./screens/SearchPane";
import { SourceView } from "./screens/SourceView";
import styles from "./App.module.css";

/**
 * Search on the left, details on the right. On a narrow window only one
 * shows at a time: the details, with a back button, once something is open.
 */
export function App() {
  useSystemTheme();
  const { status, update } = useDataStatus();
  // Any rebuild (new drops, or names in a new language) is new data.
  const dataVersion = status.info ? `${status.info.hash}@${status.info.ingestedAt}` : undefined;
  return (
    <ItemNamesProvider dataVersion={dataVersion}>
      <Screens status={status} update={update} />
    </ItemNamesProvider>
  );
}

function Screens({ status, update }: ReturnType<typeof useDataStatus>) {
  const { t } = useI18n();
  const { version: dataVersion } = useItemNames();
  const [query, setQuery] = useState("");
  const [stack, setStack] = useState<View[]>([]);
  const detailRef = useRef<HTMLElement>(null);
  const view = stack.at(-1);

  const go = useCallback((next: View, reset = false) => {
    setStack((current) => (reset ? [next] : [...current, next]));
    detailRef.current?.scrollTo?.({ top: 0 });
  }, []);
  const openItem = useCallback((name: string) => go({ kind: "item", name }), [go]);
  const openSource = useCallback((key: string) => go({ kind: "source", key }), [go]);
  const back = () => setStack((current) => current.slice(0, -1));

  if (!status.info) {
    return (
      <div className={styles.app}>
        <Header status={status} onUpdate={update} />
        <main className={styles.single}>
          <NoData status={status} onRetry={update} />
        </main>
      </div>
    );
  }

  return (
    <div className={styles.app}>
      <Header status={status} onUpdate={update} />
      <main className={styles.split} data-detail={view ? "open" : "closed"}>
        <aside className={styles.search}>
          <SearchPane
            query={query}
            onQueryChange={setQuery}
            selected={view?.kind === "item" ? view.name : undefined}
            onSelect={(name) => go({ kind: "item", name }, true)}
            dataVersion={dataVersion}
          />
        </aside>
        <section className={styles.detail} ref={detailRef}>
          {view && (
            <nav className={styles.crumbs}>
              <button type="button" className={styles.back} onClick={back}>
                <BackIcon />
                {t.app.back}
              </button>
            </nav>
          )}
          {!view && <Home onExample={setQuery} />}
          {view?.kind === "item" && (
            <ItemView
              key={view.name}
              name={view.name}
              dataVersion={dataVersion}
              openItem={openItem}
              openSource={openSource}
            />
          )}
          {view?.kind === "source" && (
            <SourceView
              key={view.key}
              sourceKey={view.key}
              dataVersion={dataVersion}
              openItem={openItem}
              openSource={openSource}
            />
          )}
        </section>
      </main>
    </div>
  );
}
