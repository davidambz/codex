// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { useI18n } from "../i18n/I18nContext";
import styles from "./Home.module.css";

const EXAMPLES = ["khora p chassi", "nezha", "serration", "axi a21", "vitus essence"];

/** The empty detail pane: what to type, with a few examples to click. */
export function Home({ onExample }: { onExample: (query: string) => void }) {
  const { t } = useI18n();
  return (
    <div className={styles.home}>
      <h1 className={styles.title}>{t.home.title}</h1>
      <p className={styles.body}>{t.home.body}</p>
      <div className={styles.examples}>
        <span className="label">{t.home.examplesLabel}</span>
        {EXAMPLES.map((example) => (
          <button key={example} type="button" className={styles.example} onClick={() => onExample(example)}>
            {example}
          </button>
        ))}
      </div>
      <p className={styles.credit}>{t.data.credit}</p>
    </div>
  );
}
