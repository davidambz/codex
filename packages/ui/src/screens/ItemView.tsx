// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { useMemo, useState } from "react";
import {
  REFINEMENTS,
  type DropRow,
  type RelicRoute,
  type SourceKind,
  type WarframePart,
  type WarframeSheet,
} from "@iaframe/core";
import { useI18n } from "../i18n/I18nContext";
import { usePlatform } from "../platform/PlatformContext";
import { useQuery } from "../hooks/useQuery";
import { DropTable } from "../components/DropTable";
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

type Filter = "all" | SourceKind;

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
  const [filter, setFilter] = useState<Filter>("all");
  const [hideVaulted, setHideVaulted] = useState(false);

  const kinds = useMemo(() => {
    const seen = new Set<SourceKind>();
    for (const row of data?.deep.direct ?? []) seen.add(row.source.kind);
    return [...seen];
  }, [data]);

  if (!data) return <div className={styles.view} aria-busy="true" />;
  const { item, deep } = data;
  if (!item) return <div className={styles.view} />;

  const direct = deep.direct.filter((row) => filter === "all" || row.source.kind === filter);
  const relics = hideVaulted ? deep.relics.filter((r) => !r.info.vaulted) : deep.relics;
  const vaultedTag = item.relic ? item.relic.vaulted : item.vaulted;

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

      {item.warframe && <WarframeSections sheet={item.warframe} openItem={openItem} />}

      {deep.relics.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div>
              <h2 className="label">{t.item.relicsLabel}</h2>
              <p className={styles.hint}>{t.item.relicsHint}</p>
            </div>
            <label className={styles.check}>
              <input type="checkbox" checked={hideVaulted} onChange={(e) => setHideVaulted(e.target.checked)} />
              {t.item.hideVaulted}
            </label>
          </div>
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
            {kinds.length > 1 && (
              <Segmented<Filter>
                label={t.item.filterLabel}
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: t.item.filterAll },
                  ...kinds.map((kind) => ({ value: kind, label: t.sourceKinds[kind] })),
                ]}
              />
            )}
          </div>
          <div className={styles.panel}>
            <DropTable key={filter} rows={direct} onOpenSource={openSource} />
          </div>
        </section>
      )}

      {!item.warframe && deep.relics.length === 0 && deep.direct.length === 0 && <p className={styles.note}>{t.item.noDrops}</p>}
    </article>
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
