// Codex — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { useEffect, useState } from "react";
import type { DataStatus, UpdateStatus, UpdatesApi } from "@codex/core";
import { LanguageSettings } from "../components/LanguageSettings";
import { RefreshIcon } from "../components/icons";
import { formatDate } from "../format";
import { useI18n } from "../i18n/I18nContext";
import { usePlatform } from "../platform/PlatformContext";
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
      <UpdatesSection />
    </div>
  );
}

/** The app's version, and checking for and installing a newer one where the build can. */
function UpdatesSection() {
  const { t } = useI18n();
  const platform = usePlatform();
  const updates = platform.updates;
  const status = useUpdateStatus(updates);
  const busy = status.state === "checking" || status.state === "downloading" || status.state === "installing";
  const message = (() => {
    switch (status.state) {
      case "checking":
        return t.updates.checking;
      case "up-to-date":
        return t.updates.upToDate;
      case "available":
        return t.updates.available(status.latestVersion);
      case "downloading":
      case "installing":
        return t.updates.installing(status.latestVersion);
      case "failed":
        return t.updates.failed;
      default:
        return null;
    }
  })();
  return (
    <section className={styles.section} aria-labelledby="settings-updates">
      <h2 id="settings-updates" className={styles.heading}>
        {t.updates.title}
      </h2>
      <p className={styles.version}>{t.updates.currentVersion(platform.appVersion)}</p>
      {updates && message && (
        <p className={status.state === "failed" ? styles.error : styles.body} role="status">
          {message}
        </p>
      )}
      {updates &&
        (status.state === "available" ? (
          <button type="button" className={styles.update} onClick={() => void updates.apply().catch(() => {})}>
            {t.updates.updateNow}
          </button>
        ) : (
          <button type="button" className={styles.secondary} onClick={() => void updates.check()} disabled={busy}>
            <RefreshIcon />
            {t.updates.check}
          </button>
        ))}
    </section>
  );
}

function useUpdateStatus(updates: UpdatesApi | undefined): UpdateStatus {
  const [status, setStatus] = useState<UpdateStatus>({ state: "idle" });
  useEffect(() => {
    if (!updates) return;
    let cancelled = false;
    let pushed = false;
    // A pushed status is always newer than the first snapshot: a slow getStatus() mustn't overwrite it.
    const unsubscribe = updates.onStatus((next) => {
      pushed = true;
      setStatus(next);
    });
    void updates.getStatus().then((current) => {
      if (!cancelled && !pushed) setStatus(current);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [updates]);
  return status;
}
