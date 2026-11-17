// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { useDeferredValue, useMemo, useState } from "react";
import { partImage, type EquipmentCard } from "@iaframe/core";
import { Chips } from "../components/Chips";
import { FilterBar, FilterSelect, FilterText } from "../components/FilterControls";
import { ItemImage } from "../components/ItemImage";
import { CreditsIcon } from "../components/icons";
import { formatCompact, formatCount } from "../format";
import { oneOf, usePreference } from "../hooks/usePreference";
import { useQuery } from "../hooks/useQuery";
import { useI18n } from "../i18n/I18nContext";
import { useItemNames } from "../names/ItemNamesContext";
import { usePlatform } from "../platform/PlatformContext";
import {
  AVAILABILITY,
  cardAvailability,
  filterCards,
  FOUNDRY_TABS,
  PRIME_FILTERS,
  type Availability,
  type FoundryTab,
  type PrimeFilter,
} from "../foundry";
import page from "./Page.module.css";
import styles from "./Foundry.module.css";

const PAGE = 120;
const TABS = Object.keys(FOUNDRY_TABS) as FoundryTab[];

interface FoundryProps {
  dataVersion?: string;
  selected?: string;
  openItem: (name: string) => void;
}

/** Every Warframe, weapon and companion as a card: its picture, and each part lit by where it can be had. */
export function Foundry({ dataVersion, selected, openItem }: FoundryProps) {
  const { t } = useI18n();
  const { itemName } = useItemNames();
  const platform = usePlatform();
  const cards = useQuery(() => platform.listEquipment(), [platform, dataVersion]);
  const [tab, setTab] = usePreference<FoundryTab>("foundryTab", "all", oneOf(TABS));
  const [prime, setPrime] = usePreference<PrimeFilter>("foundryPrime", "all", oneOf(PRIME_FILTERS));
  const [availability, setAvailability] = usePreference<Availability>("foundryAvailability", "all", oneOf(AVAILABILITY));
  const [text, setText] = useState("");
  const deferredText = useDeferredValue(text);
  const [limit, setLimit] = useState(PAGE);

  const shown = useMemo(
    () => filterCards(cards ?? [], { tab, prime, availability, text: deferredText }, itemName),
    [cards, tab, prime, availability, deferredText, itemName],
  );
  const reset = <T,>(set: (value: T) => void) => (value: T) => {
    set(value);
    setLimit(PAGE);
  };

  return (
    <div className={page.page}>
      <header className={page.head}>
        <div className={page.titleRow}>
          <h1 className={page.title}>{t.foundry.title}</h1>
          {cards && <span className={page.count}>{t.foundry.count(shown.length, cards.length)}</span>}
        </div>
        <Chips<FoundryTab>
          label={t.foundry.tabsLabel}
          value={tab}
          onChange={reset(setTab)}
          options={TABS.map((value) => ({ value, label: t.foundry.tabs[value] }))}
        />
        <FilterBar>
          <FilterText label={t.foundry.filter} placeholder={t.foundry.filter} value={text} onChange={reset(setText)} />
          <FilterSelect<PrimeFilter>
            label={t.foundry.primeLabel}
            value={prime}
            onChange={reset(setPrime)}
            options={PRIME_FILTERS.map((value) => ({ value, label: t.foundry.prime[value] }))}
          />
          <FilterSelect<Availability>
            label={t.foundry.availabilityLabel}
            value={availability}
            onChange={reset(setAvailability)}
            options={AVAILABILITY.map((value) => ({ value, label: t.foundry.availability[value] }))}
          />
        </FilterBar>
      </header>

      {cards && shown.length === 0 && <p className={page.empty}>{t.foundry.empty}</p>}
      <ul className={styles.grid}>
        {shown.slice(0, limit).map((card) => (
          <Card key={card.name} card={card} selected={card.name === selected} openItem={openItem} />
        ))}
      </ul>
      {shown.length > limit && (
        <button type="button" className={page.more} onClick={() => setLimit((n) => n + PAGE)}>
          {t.foundry.more}
        </button>
      )}
    </div>
  );
}

function Card({ card, selected, openItem }: { card: EquipmentCard; selected: boolean; openItem: (name: string) => void }) {
  const { t, locale } = useI18n();
  const { itemName } = useItemNames();
  const availability = cardAvailability(card);
  const name = itemName(card.name);
  return (
    <li className={styles.card} data-selected={selected || undefined} data-prime={card.prime || undefined}>
      <button type="button" className={styles.open} onClick={() => openItem(card.name)} aria-pressed={selected}>
        <span className={styles.name}>{name}</span>
      </button>
      <ItemImage imageName={card.imageName} className={styles.picture} />
      {card.parts.length > 0 && (
        <ul className={styles.parts} data-dense={card.parts.length > 6 || undefined}>
          {card.parts.map((part) => {
            // Regular gear that isn't a drop is still had in game (Market, Dojo, quests...).
            const status = part.status === "none" && !card.prime ? "other" : part.status;
            const label = `${t.equipment.parts[part.label] ?? part.label}: ${t.foundry.partStatus[status]}`;
            const generic = partImage(part.label, card.prime);
            const icon = <ItemImage imageName={generic ?? card.imageName} className={styles.partIcon} />;
            return (
              <li key={part.name}>
                {status === "none" || status === "other" ? (
                  <span className={styles.part} data-status={status} data-blueprint={!generic || undefined} title={label} aria-label={label} role="img">
                    {icon}
                  </span>
                ) : (
                  <button
                    type="button"
                    className={styles.part}
                    data-status={status}
                    data-blueprint={!generic || undefined}
                    title={label}
                    aria-label={`${itemName(part.name)} · ${t.foundry.partStatus[status]}`}
                    onClick={() => openItem(part.name)}
                  >
                    {icon}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {(card.materials.length > 0 || card.credits !== undefined) && (
        <ul className={styles.materials} aria-label={t.equipment.resourcesLabel}>
          {card.materials.map((material) => {
            const label = `${formatCount(material.count, locale)}× ${itemName(material.name)}`;
            return (
              <li key={material.name} className={styles.material} title={label} aria-label={label}>
                <ItemImage imageName={material.imageName} className={styles.materialIcon} />
                {formatCount(material.count, locale)}
              </li>
            );
          })}
          {card.credits !== undefined && (
            <li
              className={styles.material}
              title={`${formatCount(card.credits, locale)} ${t.equipment.credits}`}
              aria-label={`${formatCount(card.credits, locale)} ${t.equipment.credits}`}
            >
              <CreditsIcon className={styles.materialIcon} />
              {formatCompact(card.credits, locale)}
            </li>
          )}
        </ul>
      )}
      {availability !== "mixed" && (
        <span className={styles.summary} data-availability={availability} title={card.howTo}>
          {t.foundry.summary[availability]}
        </span>
      )}
    </li>
  );
}
