// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { useCallback, useRef, useState } from "react";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { BackIcon, CloseIcon } from "./components/icons";
import { useDataStatus } from "./hooks/useDataStatus";
import { usePreference } from "./hooks/usePreference";
import { useSystemTheme } from "./hooks/useSystemTheme";
import { useI18n } from "./i18n/I18nContext";
import { ItemNamesProvider } from "./names/ItemNamesProvider";
import { useItemNames } from "./names/ItemNamesContext";
import { isPage, type Page, type View } from "./navigation";
import { Foundry } from "./screens/Foundry";
import { Home } from "./screens/Home";
import { ItemView } from "./screens/ItemView";
import { NoData } from "./screens/NoData";
import { RelicsPage } from "./screens/RelicsPage";
import { SearchPane } from "./screens/SearchPane";
import { SettingsPage } from "./screens/SettingsPage";
import { SourceView } from "./screens/SourceView";
import styles from "./App.module.css";

/**
 * Sections on the left, the chosen one in the middle, and whatever was
 * opened from it (an item, a source) in a panel on the right.
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
  const [page, setPage] = usePreference<Page>("page", "foundry", isPage);
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
  // From a page, a fresh start; from inside the panel, one more step back.
  const showItem = useCallback((name: string) => go({ kind: "item", name }, true), [go]);
  const back = () => setStack((current) => current.slice(0, -1));
  const close = () => setStack([]);
  const selected = view?.kind === "item" ? view.name : undefined;

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
      <div className={styles.shell} data-detail={view ? "open" : "closed"}>
        <Sidebar page={page} onPage={setPage} />
        <main className={styles.main}>
          {page === "foundry" && <Foundry dataVersion={dataVersion} selected={selected} openItem={showItem} />}
          {page === "search" && (
            <div className={styles.searchPage}>
              <SearchPane
                query={query}
                onQueryChange={setQuery}
                selected={selected}
                onSelect={showItem}
                dataVersion={dataVersion}
              />
              {!query && <Home onExample={setQuery} />}
            </div>
          )}
          {page === "relics" && <RelicsPage dataVersion={dataVersion} selected={selected} openItem={showItem} />}
          {page === "settings" && <SettingsPage status={status} onUpdate={update} />}
        </main>
        {view && (
          <aside className={styles.detail} ref={detailRef} aria-label={t.nav.detail}>
            <nav className={styles.crumbs}>
              {stack.length > 1 ? (
                <button type="button" className={styles.back} onClick={back}>
                  <BackIcon />
                  {t.app.back}
                </button>
              ) : (
                <span />
              )}
              <button type="button" className={styles.close} onClick={close} aria-label={t.nav.close} title={t.nav.close}>
                <CloseIcon />
              </button>
            </nav>
            {view.kind === "item" && (
              <ItemView
                key={view.name}
                name={view.name}
                dataVersion={dataVersion}
                openItem={openItem}
                openSource={openSource}
              />
            )}
            {view.kind === "source" && (
              <SourceView
                key={view.key}
                sourceKey={view.key}
                dataVersion={dataVersion}
                openItem={openItem}
                openSource={openSource}
              />
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
