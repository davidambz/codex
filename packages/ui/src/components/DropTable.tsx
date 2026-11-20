// Codex — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { useState } from "react";
import { expectedRuns, runsForConfidence, type DropRow, type DropSortKey, type SortDirection } from "@codex/core";
import { formatChance, formatCount } from "../format";
import { useI18n } from "../i18n/I18nContext";
import { useItemNames } from "../names/ItemNamesContext";
import type { Strings } from "../i18n";
import { Chance } from "./Chance";
import { Tag } from "./Tag";
import styles from "./DropTable.module.css";

const PAGE = 12;

interface DropTableProps {
  rows: DropRow[];
  onOpenSource: (key: string) => void;
  /** Rows shown before "show more". */
  page?: number;
  /** Makes the headers sort buttons; the rows are expected already sorted this way. */
  sort?: { key: DropSortKey; direction: SortDirection };
  onSort?: (key: DropSortKey) => void;
}

/** Where something drops: source, when, chance, and how many tries that means. */
export function DropTable({ rows, onOpenSource, page = PAGE, sort, onSort }: DropTableProps) {
  const { t, locale } = useI18n();
  const { itemName } = useItemNames();
  const [shown, setShown] = useState(page);
  const visible = rows.slice(0, shown);

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <Header column="source" label={t.table.source} sort={sort} onSort={onSort} />
            <Header column="when" label={t.table.detail} sort={sort} onSort={onSort} />
            <Header column="chance" label={t.table.chance} sort={sort} onSort={onSort} numeric />
            <th className={`label ${styles.num} ${styles.runsCol}`}>{t.table.runs}</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row, index) => (
            <tr key={`${row.source.key}-${row.rotation}-${row.refinement}-${row.stage}-${index}`}>
              <td>
                <button type="button" className={styles.source} onClick={() => onOpenSource(row.source.key)}>
                  {row.source.kind === "relic" ? itemName(row.source.name) : row.source.name}
                </button>
                <span className={styles.where}>
                  {[row.source.location, row.source.gameMode, t.sourceKinds[row.source.kind]].filter(Boolean).join(" · ")}
                  {row.source.isEvent && <Tag>{t.table.event}</Tag>}
                  {row.sourceVaulted !== undefined && (
                    <Tag lamp={!row.sourceVaulted}>{row.sourceVaulted ? t.item.vaulted : t.item.obtainable}</Tag>
                  )}
                </span>
              </td>
              <td className={styles.detail}>{detail(row, t)}</td>
              <td className={styles.num}>
                <Chance
                  chance={row.chance}
                  conditional={row.conditional}
                  title={
                    row.enemyChance !== undefined && row.tableChance !== undefined && row.enemyChance < 100
                      ? t.table.enemyChance(formatChance(row.enemyChance, locale), formatChance(row.tableChance, locale))
                      : undefined
                  }
                />
              </td>
              <td className={`${styles.num} ${styles.runsCol}`}>
                {!row.conditional && <Runs chance={row.chance} unit={t.attempts[row.source.kind]} />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > shown && (
        <button type="button" className={styles.more} onClick={() => setShown((n) => n + page * 4)}>
          {t.item.showMore(rows.length - shown)}
        </button>
      )}
    </div>
  );
}

function Header({
  column,
  label,
  sort,
  onSort,
  numeric,
}: {
  column: DropSortKey;
  label: string;
  sort?: DropTableProps["sort"];
  onSort?: (key: DropSortKey) => void;
  numeric?: boolean;
}) {
  const { t } = useI18n();
  const className = `label${numeric ? ` ${styles.num}` : ""}`;
  if (!onSort) return <th className={className}>{label}</th>;
  const active = sort?.key === column;
  return (
    <th
      className={className}
      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}
    >
      <button
        type="button"
        className={styles.sort}
        data-active={active}
        title={t.table.sortBy(label.toLowerCase())}
        onClick={() => onSort(column)}
      >
        {label}
        <span aria-hidden="true" className={styles.arrow}>
          {active ? (sort.direction === "asc" ? "\u25B2" : "\u25BC") : "\u25BD"}
        </span>
      </button>
    </th>
  );
}

export function Runs({ chance, unit }: { chance: number; unit: string }) {
  const { t, locale } = useI18n();
  return (
    <span className={styles.runs}>
      <span>{t.table.average(formatCount(expectedRuns(chance), locale), unit)}</span>
      <span className={styles.ninety}>{t.table.forNinety(formatCount(runsForConfidence(chance), locale))}</span>
    </span>
  );
}

function detail(row: DropRow, t: Strings): string {
  const parts: string[] = [];
  if (row.rotation) parts.push(t.table.rotation(row.rotation));
  if (row.stage) parts.push(row.stage);
  if (row.refinement) parts.push(t.refinements[row.refinement]);
  if (row.quantity) parts.push(`×${row.quantity}`);
  return parts.join(" · ");
}
