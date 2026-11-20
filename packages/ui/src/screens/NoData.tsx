// Codex — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import type { DataStatus } from "@codex/core";
import { useI18n } from "../i18n/I18nContext";
import { Button } from "../components/Button";
import styles from "./Home.module.css";

/** First run: nothing to search until the drop tables are in. */
export function NoData({ status, onRetry }: { status: DataStatus; onRetry: () => void }) {
  const { t } = useI18n();
  const failed = !status.busy && status.outcome === "failed";
  return (
    <div className={styles.home} aria-busy={status.busy}>
      <h1 className={styles.title}>{t.data.noDataTitle}</h1>
      <p className={styles.body}>{t.data.noDataBody}</p>
      {failed && (
        <>
          <p role="alert">{t.data.noDataFailed(status.error ?? "")}</p>
          <div>
            <Button variant="primary" onClick={onRetry}>
              {t.data.retry}
            </Button>
          </div>
        </>
      )}
      <p className={styles.credit}>{t.data.credit}</p>
    </div>
  );
}
