// Codex — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import type { ReactNode } from "react";
import { SearchIcon } from "./icons";
import styles from "./FilterControls.module.css";

/** A row of filters above a list; wraps on narrow windows. */
export function FilterBar({ children }: { children: ReactNode }) {
  return <div className={styles.bar}>{children}</div>;
}

interface FilterSelectProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

export function FilterSelect<T extends string>({ label, value, options, onChange }: FilterSelectProps<T>) {
  return (
    <label className={styles.select}>
      <span className="label">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FilterText({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className={styles.text}>
      <SearchIcon className={styles.textIcon} />
      <input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && value) {
            event.preventDefault();
            event.stopPropagation();
            onChange("");
          }
        }}
        spellCheck={false}
        autoComplete="off"
      />
    </div>
  );
}

export function FilterCheck({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={styles.check}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}
