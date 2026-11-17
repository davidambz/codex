// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { useState } from "react";
import { tokenize, type SourceItemRow } from "@iaframe/core";
import { useI18n } from "../i18n/I18nContext";
import { useItemNames } from "../names/ItemNamesContext";
import { usePlatform } from "../platform/PlatformContext";
import { useQuery } from "../hooks/useQuery";
import { Chance } from "../components/Chance";
import { Runs } from "../components/DropTable";
import { Tag } from "../components/Tag";
import { FilterBar, FilterText } from "../components/FilterControls";
import type { Navigate } from "../navigation";
import styles from "./Detail.module.css";

interface SourceViewProps extends Navigate {
  sourceKey: string;
  dataVersion?: string;
}

/** What one mission, relic, enemy or bounty drops, grouped by rotation, stage or refinement. */
export function SourceView({ sourceKey, dataVersion, openItem }: SourceViewProps) {
  const { t } = useI18n();
  const { itemName } = useItemNames();
  const platform = usePlatform();
  const details = useQuery(() => platform.getSource(sourceKey), [platform, sourceKey, dataVersion]);
  const [text, setText] = useState("");
  if (!details) return <div className={styles.view} aria-busy={details === undefined} />;
  const { source, drops } = details;

  const words = tokenize(text);
  const shown = words.length
    ? drops.filter((row) => {
        const tokens = [...tokenize(row.item), ...tokenize(itemName(row.item))];
        return words.every((word) => tokens.some((token) => token.startsWith(word)));
      })
    : drops;

  const groups = new Map<string, SourceItemRow[]>();
  for (const row of shown) {
    const title =
      [row.rotation && t.source.rotationGroup(row.rotation), row.stage, row.refinement && t.refinements[row.refinement]]
        .filter(Boolean)
        .join(" · ") || t.source.noRotation;
    groups.set(title, [...(groups.get(title) ?? []), row]);
  }

  return (
    <article className={styles.view}>
      <header className={styles.head}>
        <div className={styles.tags}>
          <Tag>{t.sourceKinds[source.kind]}</Tag>
          {source.isEvent && <Tag>{t.table.event}</Tag>}
        </div>
        <h1 className={styles.title}>{source.kind === "relic" ? itemName(source.name) : source.name}</h1>
        {source.kind === "relic" && itemName(source.name) !== source.name && (
          <p className={styles.subtitle}>{t.languages.english(source.name)}</p>
        )}
        {(source.location || source.gameMode) && (
          <p className={styles.subtitle}>{[source.location, source.gameMode].filter(Boolean).join(" · ")}</p>
        )}
      </header>
      {drops.length > 10 && (
        <FilterBar>
          <FilterText label={t.source.filterLabel} placeholder={t.source.filterPlaceholder} value={text} onChange={setText} />
          {shown.length !== drops.length && <span className={styles.count}>{t.item.shownOf(shown.length, drops.length)}</span>}
        </FilterBar>
      )}
      {shown.length === 0 && <p className={styles.note}>{t.source.noMatches}</p>}
      <div className={styles.groups}>
        {[...groups].map(([title, rows]) => (
          <section key={title} className={styles.section}>
            <h2 className="label">{title}</h2>
            <ul className={styles.panel + " " + styles.rewardList}>
              {rows.map((row, index) => (
                <li key={`${row.item}-${index}`} className={styles.reward}>
                  <button type="button" className={styles.rewardName} onClick={() => openItem(row.item)}>
                    {row.quantity ? `${row.quantity}× ` : ""}
                    {itemName(row.item)}
                  </button>
                  <span className={styles.rarity}>{row.rarity}</span>
                  <Chance chance={row.chance} conditional={row.conditional} />
                  {!row.conditional && <Runs chance={row.chance} unit={t.attempts[source.kind]} />}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </article>
  );
}
