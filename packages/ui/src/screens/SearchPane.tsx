// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { SearchHit } from "@iaframe/core";
import { useI18n } from "../i18n/I18nContext";
import { useItemNames } from "../names/ItemNamesContext";
import { usePlatform } from "../platform/PlatformContext";
import { SearchIcon } from "../components/icons";
import { Chips } from "../components/Chips";
import { usePreference } from "../hooks/usePreference";
import { isKindGroup, KIND_GROUPS, type KindGroup } from "../kindGroups";
import styles from "./SearchPane.module.css";

const DEBOUNCE_MS = 120;
const LIMIT = 30;

interface SearchPaneProps {
  query: string;
  onQueryChange: (query: string) => void;
  selected?: string;
  onSelect: (name: string) => void;
  /** Bumped when new data arrives, so the same query is searched again. */
  dataVersion?: string;
}

/** Search field over a listbox of matches; arrows move, Enter opens. */
export function SearchPane({ query, onQueryChange, selected, onSelect, dataVersion }: SearchPaneProps) {
  const { t } = useI18n();
  const { itemName } = useItemNames();
  const platform = usePlatform();
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [group, setGroup] = usePreference<KindGroup>("searchKinds", "all", isKindGroup);

  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      void platform.search(query, LIMIT, KIND_GROUPS[group]).then((result) => {
        if (!current) return;
        setHits(result);
        setActive(0);
      });
    }, query ? DEBOUNCE_MS : 0);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [platform, query, group, dataVersion]);

  // "/" or Ctrl+K jumps to the search field from anywhere.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
      if ((event.key === "/" && !typing) || (event.key.toLowerCase() === "k" && (event.ctrlKey || event.metaKey))) {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (hits.length === 0) return;
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActive((index) => (index + delta + hits.length) % hits.length);
    } else if (event.key === "Enter" && hits[active]) {
      event.preventDefault();
      onSelect(hits[active].name);
    } else if (event.key === "Escape" && query) {
      event.preventDefault();
      onQueryChange("");
    }
  };

  const activeId = hits[active] ? `${listId}-${active}` : undefined;

  return (
    <div className={styles.pane}>
      <div className={styles.field}>
        <SearchIcon className={styles.icon} />
        <input
          ref={inputRef}
          className={styles.input}
          type="search"
          role="combobox"
          aria-label={t.app.search}
          aria-expanded={hits.length > 0}
          aria-controls={listId}
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          placeholder={t.app.searchPlaceholder}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={onKeyDown}
          autoFocus
          spellCheck={false}
          autoComplete="off"
        />
        <Chips<KindGroup>
          label={t.app.kindFilterLabel}
          value={group}
          onChange={setGroup}
          options={(Object.keys(KIND_GROUPS) as KindGroup[]).map((value) => ({ value, label: t.app.kindGroups[value] }))}
        />
      </div>
      {query.trim() && hits.length === 0 ? (
        <p className={styles.empty}>{t.app.noResults(query.trim())}</p>
      ) : (
        <ul id={listId} role="listbox" aria-label={t.app.search} className={styles.list}>
          {hits.map((hit, index) => (
            <li
              key={hit.name}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={hit.name === selected}
              data-active={index === active}
              className={styles.hit}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setActive(index);
                onSelect(hit.name);
              }}
            >
              <span className={styles.hitNames}>
                <span className={styles.hitName}>{itemName(hit.name)}</span>
                {itemName(hit.name) !== hit.name && <span className={styles.hitAlt}>{hit.name}</span>}
              </span>
              <span className={styles.hitKind}>{t.kinds[hit.kind]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
