// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { useEffect, useId, useRef, useState } from "react";
import { ITEM_LANGUAGES, LANGUAGE_NAMES, type ItemLanguage } from "@iaframe/core";
import { useI18n } from "../i18n/I18nContext";
import { useItemNames } from "../names/ItemNamesContext";
import { GlobeIcon } from "./icons";
import styles from "./LanguagePanel.module.css";

/** The header's language button and its panel: the language item names show in, and extra search languages. */
export function LanguagePanel({ busy }: { busy: boolean }) {
  const { t } = useI18n();
  const { settings, updateSettings } = useItemNames();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggleSearch = (language: ItemLanguage, on: boolean) =>
    updateSettings({
      searchLanguages: on
        ? [...settings.searchLanguages, language]
        : settings.searchLanguages.filter((l) => l !== language),
    });

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.button}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        title={t.languages.open}
        aria-label={t.languages.open}
      >
        <GlobeIcon />
        <span className={styles.code}>{settings.itemLanguage.toUpperCase()}</span>
      </button>
      {open && (
        <div id={panelId} role="dialog" aria-label={t.languages.title} className={styles.panel}>
          <label className={styles.field}>
            <span className="label">{t.languages.itemLanguage}</span>
            <select
              value={settings.itemLanguage}
              onChange={(event) => updateSettings({ itemLanguage: event.target.value as ItemLanguage })}
              autoFocus
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
      )}
    </div>
  );
}
