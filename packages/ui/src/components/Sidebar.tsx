// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import type { ReactNode } from "react";
import { useI18n } from "../i18n/I18nContext";
import type { Page } from "../navigation";
import { FoundryIcon, RelicIcon, SearchIcon, SettingsIcon } from "./icons";
import styles from "./Sidebar.module.css";

const ICONS: Record<Page, ReactNode> = {
  foundry: <FoundryIcon />,
  search: <SearchIcon />,
  relics: <RelicIcon />,
  settings: <SettingsIcon />,
};

/** The app's sections; Settings sits apart at the bottom. */
export function Sidebar({ page, onPage }: { page: Page; onPage: (page: Page) => void }) {
  const { t } = useI18n();
  const item = (value: Page) => (
    <li key={value}>
      <button
        type="button"
        className={styles.item}
        aria-current={value === page ? "page" : undefined}
        onClick={() => onPage(value)}
      >
        {ICONS[value]}
        <span className={styles.text}>{t.nav.pages[value]}</span>
      </button>
    </li>
  );
  return (
    <nav className={styles.sidebar} aria-label={t.nav.label}>
      <ul className={styles.list}>{(["foundry", "search", "relics"] as const).map(item)}</ul>
      <ul className={styles.list}>{item("settings")}</ul>
    </nav>
  );
}
