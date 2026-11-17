// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { useDeferredValue, useMemo, useState } from "react";
import { RELIC_TIERS, tokenize, type RelicListEntry } from "@iaframe/core";
import { Chips } from "../components/Chips";
import { FilterBar, FilterSelect, FilterText } from "../components/FilterControls";
import { oneOf, usePreference } from "../hooks/usePreference";
import { useQuery } from "../hooks/useQuery";
import { useI18n } from "../i18n/I18nContext";
import { useItemNames } from "../names/ItemNamesContext";
import { usePlatform } from "../platform/PlatformContext";
import page from "./Page.module.css";
import styles from "./RelicsPage.module.css";

const PAGE = 90;
const TIERS = ["all", ...RELIC_TIERS] as const;
type TierFilter = (typeof TIERS)[number];
const VAULTED = ["all", "open", "vaulted"] as const;
type VaultedFilter = (typeof VAULTED)[number];

interface RelicsPageProps {
  dataVersion?: string;
  selected?: string;
  openItem: (name: string) => void;
}

/** Every relic, with what it holds; farmable ones first. */
export function RelicsPage({ dataVersion, selected, openItem }: RelicsPageProps) {
  const { t } = useI18n();
  const { itemName } = useItemNames();
  const platform = usePlatform();
  const relics = useQuery(() => platform.listRelics(), [platform, dataVersion]);
  const [tier, setTier] = usePreference<TierFilter>("relicsTier", "all", oneOf(TIERS));
  const [vaulted, setVaulted] = usePreference<VaultedFilter>("relicsVaulted", "open", oneOf(VAULTED));
  const [text, setText] = useState("");
  const deferredText = useDeferredValue(text);
  const [limit, setLimit] = useState(PAGE);

  const shown = useMemo(() => {
    const words = tokenize(deferredText);
    return (relics ?? []).filter((relic) => {
      if (tier !== "all" && relic.tier !== tier) return false;
      if (vaulted === "open" && relic.vaulted) return false;
      if (vaulted === "vaulted" && !relic.vaulted) return false;
      if (words.length === 0) return true;
      const names = [relic.name, itemName(relic.name), ...relic.rewards.flatMap((r) => [r.item, itemName(r.item)])];
      const tokens = tokenize(names.join(" "));
      return words.every((word) => tokens.some((token) => token.startsWith(word)));
    });
  }, [relics, tier, vaulted, deferredText, itemName]);
  const reset = <T,>(set: (value: T) => void) => (value: T) => {
    set(value);
    setLimit(PAGE);
  };

  return (
    <div className={page.page}>
      <header className={page.head}>
        <div className={page.titleRow}>
          <h1 className={page.title}>{t.relics.title}</h1>
          {relics && <span className={page.count}>{t.relics.count(shown.length, relics.length)}</span>}
        </div>
        <Chips<TierFilter>
          label={t.relics.tierLabel}
          value={tier}
          onChange={reset(setTier)}
          options={TIERS.map((value) => ({ value, label: value === "all" ? t.item.tierAll : value }))}
        />
        <FilterBar>
          <FilterText label={t.relics.filter} placeholder={t.relics.filter} value={text} onChange={reset(setText)} />
          <FilterSelect<VaultedFilter>
            label={t.relics.vaultedLabel}
            value={vaulted}
            onChange={reset(setVaulted)}
            options={VAULTED.map((value) => ({ value, label: t.relics.vaulted[value] }))}
          />
        </FilterBar>
      </header>

      {relics && shown.length === 0 && <p className={page.empty}>{t.relics.empty}</p>}
      <ul className={styles.grid}>
        {shown.slice(0, limit).map((relic) => (
          <RelicCard key={relic.name} relic={relic} selected={relic.name === selected} openItem={openItem} />
        ))}
      </ul>
      {shown.length > limit && (
        <button type="button" className={page.more} onClick={() => setLimit((n) => n + PAGE)}>
          {t.relics.more}
        </button>
      )}
    </div>
  );
}

function RelicCard({
  relic,
  selected,
  openItem,
}: {
  relic: RelicListEntry;
  selected: boolean;
  openItem: (name: string) => void;
}) {
  const { t } = useI18n();
  const { itemName } = useItemNames();
  return (
    <li className={styles.card} data-selected={selected || undefined} data-vaulted={relic.vaulted || undefined}>
      <div className={styles.cardHead}>
        <button type="button" className={styles.relicName} onClick={() => openItem(relic.name)} aria-pressed={selected}>
          {itemName(relic.name)}
        </button>
        {relic.vaulted && <span className={styles.vaulted}>{t.relics.vaultedTag}</span>}
      </div>
      <ul className={styles.rewards}>
        {relic.rewards.map((reward) => (
          <li key={reward.item}>
            <button
              type="button"
              className={styles.reward}
              data-rarity={reward.rarity}
              title={t.relics.rarity[reward.rarity]}
              onClick={() => openItem(reward.item)}
            >
              {itemName(reward.item)}
            </button>
          </li>
        ))}
      </ul>
    </li>
  );
}

