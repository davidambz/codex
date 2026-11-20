// Codex — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import type { DataStatus } from "@codex/core";
import { LanguageSettings } from "../components/LanguageSettings";
import { RefreshIcon } from "../components/icons";
import { formatDate } from "../format";
import { useI18n } from "../i18n/I18nContext";
import page from "./Page.module.css";
import styles from "./SettingsPage.module.css";

export function SettingsPage({ status, onUpdate }: { status: DataStatus; onUpdate: () => void }) {
  const { t, locale } = useI18n();
  const info = status.info;
  return (
    <div className={page.page}>
      <h1 className={page.title}>{t.settings.title}</h1>
      <section className={styles.section} aria-labelledby="settings-languages">
        <h2 id="settings-languages" className={styles.heading}>
          {t.settings.languagesTitle}
        </h2>
        <LanguageSettings busy={status.busy} />
      </section>
      <section className={styles.section} aria-labelledby="settings-data">
        <h2 id="settings-data" className={styles.heading}>
          {t.settings.dataTitle}
        </h2>
        <p className={styles.body}>{t.settings.dataBody}</p>
        {info && (
          <dl className={styles.facts}>
            <dt className="label">{t.data.label}</dt>
            <dd>{t.data.updatedOn(formatDate(info.sourceModified || info.ingestedAt || "", locale))}</dd>
          </dl>
        )}
        <button type="button" className={styles.update} onClick={onUpdate} disabled={status.busy}>
          <RefreshIcon />
          {status.busy ? t.data.checking : t.data.update}
        </button>
        <p className={styles.body}>{t.data.credit}</p>
      </section>
    </div>
  );
}
