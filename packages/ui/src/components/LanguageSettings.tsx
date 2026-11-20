// Codex — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { ITEM_LANGUAGES, LANGUAGE_NAMES, type ItemLanguage } from "@codex/core";
import { useI18n } from "../i18n/I18nContext";
import { useItemNames } from "../names/ItemNamesContext";
import styles from "./LanguageSettings.module.css";

/** The language item names show in, and extra languages search understands. */
export function LanguageSettings({ busy }: { busy: boolean }) {
  const { t } = useI18n();
  const { settings, updateSettings } = useItemNames();

  const toggleSearch = (language: ItemLanguage, on: boolean) =>
    updateSettings({
      searchLanguages: on
        ? [...settings.searchLanguages, language]
        : settings.searchLanguages.filter((l) => l !== language),
    });

  return (
    <div className={styles.settings}>
      <label className={styles.field}>
        <span className="label">{t.languages.itemLanguage}</span>
        <select
          value={settings.itemLanguage}
          onChange={(event) => updateSettings({ itemLanguage: event.target.value as ItemLanguage })}
        >
          {ITEM_LANGUAGES.map((language) => (
            <option key={language} value={language}>
              {LANGUAGE_NAMES[language]}
            </option>
          ))}
        </select>
      </label>
      <fieldset className={styles.field}>
        <legend className="label">{t.languages.searchLanguages}</legend>
        <p className={styles.hint}>{t.languages.searchHint}</p>
        <div className={styles.options}>
          {ITEM_LANGUAGES.map((language) => {
            const always = language === "en" || language === settings.itemLanguage;
            return (
              <label key={language} className={styles.option}>
                <input
                  type="checkbox"
                  checked={always || settings.searchLanguages.includes(language)}
                  disabled={always}
                  onChange={(event) => toggleSearch(language, event.target.checked)}
                />
                {LANGUAGE_NAMES[language]}
              </label>
            );
          })}
        </div>
      </fieldset>
      <p className={styles.hint}>{t.languages.note}</p>
      {busy && (
        <p className={styles.busy} role="status">
          {t.languages.fetching}
        </p>
      )}
    </div>
  );
}
