// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { useMemo, useState } from "react";
import {
  REFINEMENTS,
  bestBet,
  dropFacets,
  filterDrops,
  filterRelics,
  relicTiers,
  sortDrops,
  sortRelics,
  type BestBet,
  type DropFilter,
  type DropRow,
  type DropSortKey,
  type RelicRoute,
  type RelicSortKey,
  type RelicTier,
  type Rotation,
  type SortDirection,
  type SourceKind,
  type WarframePart,
  type WarframeSheet,
} from "@iaframe/core";
import { useI18n } from "../i18n/I18nContext";
import { usePlatform } from "../platform/PlatformContext";
import { useQuery } from "../hooks/useQuery";
import { DropTable, Runs } from "../components/DropTable";
import { FilterBar, FilterCheck, FilterSelect, FilterText } from "../components/FilterControls";
import { isBoolean, oneOf, usePreference } from "../hooks/usePreference";
import { Chance } from "../components/Chance";
import { Segmented } from "../components/Segmented";
import { Tag } from "../components/Tag";
import { formatChance } from "../format";
import type { Navigate } from "../navigation";
import styles from "./Detail.module.css";

interface ItemViewProps extends Navigate {
  name: string;
  dataVersion?: string;
}

type Kind = "all" | SourceKind;
type RotationChoice = "all" | Rotation;
type TierChoice = "all" | RelicTier;

const SORT_KEYS = ["chance", "source", "when"] as const satisfies readonly DropSortKey[];
const RELIC_SORTS = ["radiant", "intact", "name"] as const satisfies readonly RelicSortKey[];
interface DropSort {
  key: DropSortKey;
  direction: SortDirection;
}
const DEFAULT_SORT: DropSort = { key: "chance", direction: "desc" };
const isSort = (value: unknown): value is DropSort =>
  typeof value === "object" &&
  value !== null &&
  oneOf(SORT_KEYS)((value as { key?: unknown }).key) &&
  oneOf(["asc", "desc"] as const)((value as { direction?: unknown }).direction);

export function ItemView({ name, dataVersion, openItem, openSource }: ItemViewProps) {
  const { t } = useI18n();
  const platform = usePlatform();
  const data = useQuery(
    async () => {
      const [item, deep] = await Promise.all([platform.getItem(name), platform.getDropsDeep(name)]);
      return { item, deep };
    },
    [platform, name, dataVersion],
  );

  // Per item: reset when another item opens (the view is keyed by name).
  const [kind, setKind] = useState<Kind>("all");
  const [location, setLocation] = useState("");
  const [rotation, setRotation] = useState<RotationChoice>("all");
  const [text, setText] = useState("");
  const [tier, setTier] = useState<TierChoice>("all");
  // Remembered: how someone likes to read the tables.
  const [sort, setSort] = usePreference<DropSort>("dropSort", DEFAULT_SORT, isSort);
  const [hideEvents, setHideEvents] = usePreference("hideEvents", false, isBoolean);
  const [hideConditional, setHideConditional] = usePreference("hideConditional", false, isBoolean);
  const [hideVaulted, setHideVaulted] = usePreference("hideVaulted", false, isBoolean);
  const [relicSort, setRelicSort] = usePreference<RelicSortKey>("relicSort", "radiant", oneOf(RELIC_SORTS));

  const facets = useMemo(() => dropFacets(data?.deep.direct ?? []), [data]);
  const tiers = useMemo(() => relicTiers(data?.deep.relics ?? []), [data]);
  const bet = useMemo(() => (data ? bestBet(data.deep) : {}), [data]);

  if (!data) return <div className={styles.view} aria-busy="true" />;
  const { item, deep } = data;
  if (!item) return <div className={styles.view} />;

  const filter: DropFilter = {
    kind: kind === "all" ? undefined : kind,
    location: location || undefined,
    rotation: rotation === "all" ? undefined : rotation,
    hideEvents,
    hideConditional,
    text,
  };
  const direct = sortDrops(filterDrops(deep.direct, filter), sort.key, sort.direction);
  const relics = sortRelics(
    filterRelics(deep.relics, { hideVaulted, tiers: tier === "all" ? undefined : [tier] }),
    relicSort,
  );
  const vaultedTag = item.relic ? item.relic.vaulted : item.vaulted;
  const filtered = Boolean(kind !== "all" || location || rotation !== "all" || text.trim() || hideEvents || hideConditional);
  const clearFilters = () => {
    setKind("all");
    setLocation("");
    setRotation("all");
    setText("");
    setHideEvents(false);
    setHideConditional(false);
  };
  const onSort = (key: DropSortKey) =>
    setSort(
      sort.key === key
        ? { key, direction: sort.direction === "asc" ? "desc" : "asc" }
        : { key, direction: key === "chance" ? "desc" : "asc" },
    );
  const many = deep.direct.length > 3;

  return (
    <article className={styles.view}>
      <header className={styles.head}>
        <div className={styles.tags}>
          <Tag>{t.kinds[item.kind]}</Tag>
          {vaultedTag !== undefined && <Tag lamp={!vaultedTag}>{vaultedTag ? t.item.vaulted : t.item.obtainable}</Tag>}
        </div>
        <h1 className={styles.title}>{item.name}</h1>
        {item.warframe?.counterpart && (
          <div className={styles.headActions}>
            <button type="button" className={styles.link} onClick={() => openItem(item.warframe!.counterpart!)}>
              {t.warframe.counterpart(item.warframe.counterpart)}
            </button>
          </div>
        )}
        {item.relic && (
          <div className={styles.headActions}>
            {item.relic.vaulted && <p className={styles.note}>{t.item.relicVaultedNote}</p>}
            <button
              type="button"
              className={styles.link}
              onClick={() => openSource(`relic:${item.relic!.tier} ${item.relic!.code}`)}
            >
              {t.item.contents}
            </button>
          </div>
        )}
      </header>

      {!item.relic && (bet.direct || bet.relic) && (
        <BestBetPanel bet={bet} openItem={openItem} openSource={openSource} />
      )}

      {item.warframe && <WarframeSections sheet={item.warframe} openItem={openItem} />}

      {deep.relics.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div>
              <h2 className="label">{t.item.relicsLabel}</h2>
              <p className={styles.hint}>{t.item.relicsHint}</p>
            </div>
          </div>
          <FilterBar>
            <FilterSelect<RelicSortKey>
              label={t.item.relicSortLabel}
              value={relicSort}
              onChange={setRelicSort}
              options={RELIC_SORTS.map((key) => ({ value: key, label: t.item.relicSorts[key] }))}
            />
            {tiers.length > 1 && (
              <FilterSelect<TierChoice>
                label={t.item.tierLabel}
                value={tier}
                onChange={setTier}
                options={[
                  { value: "all", label: t.item.tierAll },
                  ...tiers.map((value) => ({ value, label: value })),
                ]}
              />
            )}
            <FilterCheck label={t.item.hideVaulted} checked={hideVaulted} onChange={setHideVaulted} />
            {relics.length !== deep.relics.length && (
              <span className={styles.count}>{t.item.shownOf(relics.length, deep.relics.length)}</span>
            )}
          </FilterBar>
          <div className={styles.relics}>
            {relics.map((route) => (
              <RelicCard key={route.relic} route={route} openItem={openItem} openSource={openSource} />
            ))}
          </div>
        </section>
      )}

      {deep.direct.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className="label">{item.relic ? t.item.relicSourcesLabel : t.item.directLabel}</h2>
            {facets.kinds.length > 1 && (
              <Segmented<Kind>
                label={t.item.filterLabel}
                value={kind}
                onChange={setKind}
                options={[
                  { value: "all", label: t.item.filterAll },
                  ...facets.kinds.map((value) => ({ value, label: t.sourceKinds[value] })),
                ]}
              />
            )}
          </div>
          {(many || facets.hasEvents || facets.hasConditional) && (
            <FilterBar>
              {many && (
                <FilterText
                  label={t.item.textFilterLabel}
                  placeholder={t.item.textFilterPlaceholder}
                  value={text}
                  onChange={setText}
                />
              )}
              {facets.locations.length > 1 && (
                <FilterSelect
                  label={t.item.planetLabel}
                  value={location}
                  onChange={setLocation}
                  options={[
                    { value: "", label: t.item.planetAll },
                    ...facets.locations.map((value) => ({ value, label: value })),
                  ]}
                />
              )}
              {facets.rotations.length > 1 && (
                <FilterSelect<RotationChoice>
                  label={t.item.rotationLabel}
                  value={rotation}
                  onChange={setRotation}
                  options={[
                    { value: "all", label: t.item.rotationAll },
                    ...facets.rotations.map((value) => ({ value, label: value })),
                  ]}
                />
              )}
              {facets.hasEvents && <FilterCheck label={t.item.hideEvents} checked={hideEvents} onChange={setHideEvents} />}
              {facets.hasConditional && (
                <FilterCheck label={t.item.hideConditional} checked={hideConditional} onChange={setHideConditional} />
              )}
              {filtered && (
                <>
                  <span className={styles.count}>{t.item.shownOf(direct.length, deep.direct.length)}</span>
                  <button type="button" className={styles.clear} onClick={clearFilters}>
                    {t.item.clearFilters}
                  </button>
                </>
              )}
            </FilterBar>
          )}
          {direct.length > 0 ? (
            <div className={styles.panel}>
              <DropTable
                key={JSON.stringify([filter, sort])}
                rows={direct}
                onOpenSource={openSource}
                sort={sort}
                onSort={onSort}
              />
            </div>
          ) : (
            <p className={styles.note}>{t.item.noMatches}</p>
          )}
        </section>
      )}

      {!item.warframe && deep.relics.length === 0 && deep.direct.length === 0 && <p className={styles.note}>{t.item.noDrops}</p>}
    </article>
  );
}

function BestBetPanel({ bet, openItem, openSource }: { bet: BestBet } & Navigate) {
  const { t, locale } = useI18n();
  const where = (row: DropRow) =>
    [row.source.location, row.rotation && t.table.rotation(row.rotation), row.stage].filter(Boolean).join(" · ");
  return (
    <section className={styles.section} aria-labelledby="best-bet">
      <h2 id="best-bet" className="label">
        {t.item.bestLabel}
      </h2>
      <div className={styles.bets}>
        {bet.direct && (
          <div className={styles.bet}>
            <span className="label">{t.item.bestDirect}</span>
            <button type="button" className={styles.betName} onClick={() => openSource(bet.direct!.source.key)}>
              {bet.direct.source.name}
            </button>
            <span className={styles.betWhere}>{where(bet.direct)}</span>
            <div className={styles.betNumbers}>
              <Chance chance={bet.direct.chance} />
              <Runs chance={bet.direct.chance} unit={t.attempts[bet.direct.source.kind]} />
            </div>
          </div>
        )}
        {bet.relic && (
          <div className={styles.bet}>
            <span className="label">{t.item.bestRelic}</span>
            <button type="button" className={styles.betName} onClick={() => openItem(bet.relic!.route.relic)}>
              {bet.relic.route.relic}
            </button>
            <span className={styles.betWhere}>
              {t.item.bestRelicChances(
                formatChance(bet.relic.route.chances.Intact ?? 0, locale),
                formatChance(bet.relic.route.chances.Radiant ?? 0, locale),
              )}
            </span>
            {bet.relic.source ? (
              <span className={styles.betWhere}>
                {t.item.bestRelicWhere(
                  [bet.relic.source.source.name, where(bet.relic.source)].filter(Boolean).join(" · "),
                )}{" "}
                <span className={styles.betChance}>{formatChance(bet.relic.source.chance, locale)}</span>
              </span>
            ) : (
              <span className={styles.betWhere}>{t.item.bestRelicNoSource}</span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function RelicCard({ route, openItem, openSource }: { route: RelicRoute } & Navigate) {
  const { t } = useI18n();
  const sources: DropRow[] = route.sources;
  return (
    <div className={styles.relic} data-vaulted={route.info.vaulted}>
      <div className={styles.relicHead}>
        <span className="lamp" data-lit={!route.info.vaulted} />
        <button type="button" className={styles.relicName} onClick={() => openItem(route.relic)}>
          {route.relic}
        </button>
        <Tag>{route.info.vaulted ? t.item.vaulted : t.item.obtainable}</Tag>
        {route.rarity && <span className={styles.rarity}>{route.rarity}</span>}
      </div>
      <dl className={styles.refinements}>
        {REFINEMENTS.map((refinement) => (
          <div key={refinement} className={styles.refinement}>
            <dt className="label">{t.refinements[refinement]}</dt>
            <dd>{route.chances[refinement] !== undefined ? <Chance chance={route.chances[refinement]!} /> : "—"}</dd>
          </div>
        ))}
      </dl>
      {sources.length > 0 && (
        <div className={styles.relicSources}>
          <h3 className="label">{t.item.whereLabel}</h3>
          <DropTable rows={sources} onOpenSource={openSource} page={3} />
        </div>
      )}
    </div>
  );
}

function WarframeSections({ sheet, openItem }: { sheet: WarframeSheet; openItem: (name: string) => void }) {
  const { t } = useI18n();
  const anyMissing = sheet.parts.some((part) => part.status === "none");
  return (
    <>
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div>
            <h2 className="label">{t.warframe.partsLabel}</h2>
            {anyMissing && sheet.acquisition && <p className={styles.hint}>{t.warframe.noneHint}</p>}
          </div>
        </div>
        <ul className={`${styles.panel} ${styles.parts}`}>
          {sheet.parts.map((part) => (
            <PartRow key={part.name} part={part} openItem={openItem} />
          ))}
        </ul>
      </section>

      {sheet.acquisition && (
        <section className={styles.section}>
          <h2 className="label">{t.warframe.howLabel}</h2>
          <div className={styles.prose}>
            {sheet.acquisition.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
          <p className={styles.hint}>
            {t.warframe.wikiCredit}{" "}
            {sheet.wikiUrl && (
              <a href={sheet.wikiUrl} target="_blank" rel="noreferrer">
                {t.warframe.openWiki}
              </a>
            )}
          </p>
        </section>
      )}
    </>
  );
}

function PartRow({ part, openItem }: { part: WarframePart; openItem: (name: string) => void }) {
  const { t, locale } = useI18n();
  const status =
    part.status === "drops"
      ? t.warframe.drops(part.bestChance !== undefined ? formatChance(part.bestChance, locale) : "?")
      : part.status === "relics"
        ? t.warframe.relics(part.openRelics ?? 0, part.relics ?? 0)
        : part.status === "vaulted"
          ? t.warframe.vaulted(part.relics ?? 0)
          : t.warframe.none;
  const lit = part.status === "drops" || part.status === "relics";
  return (
    <li className={styles.part}>
      <span className="label">{t.warframe.slots[part.slot]}</span>
      {part.status === "none" ? (
        <span className={styles.partName}>{part.name}</span>
      ) : (
        <button type="button" className={`${styles.partName} ${styles.partLink}`} onClick={() => openItem(part.name)}>
          {part.name}
        </button>
      )}
      <span className={styles.partStatus}>
        <span className="lamp" data-lit={lit} />
        {status}
      </span>
    </li>
  );
}
