// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DataStatus, Platform } from "@iaframe/core";
import { App } from "./App";
import { I18nProvider } from "./i18n/I18nProvider";
import { PlatformContext } from "./platform/PlatformContext";
import { fakePlatform } from "./test/fakePlatform";

function renderApp(platform: Platform = fakePlatform()) {
  render(
    <PlatformContext.Provider value={platform}>
      <I18nProvider>
        <App />
      </I18nProvider>
    </PlatformContext.Provider>,
  );
  return platform;
}

/** Types into the search, waits for the match and opens it with Enter. */
async function open(query: string, name: RegExp) {
  await userEvent.type(await screen.findByRole("combobox"), query);
  await screen.findByRole("option", { name });
  await userEvent.keyboard("{Enter}");
}

// Most tests are about the drop search; the sections have their own.
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("iaframe:page", JSON.stringify("search"));
});

describe("App", () => {
  it("explains the first download while there is no data", async () => {
    renderApp(fakePlatform({ status: { busy: true } }));
    expect(await screen.findByText("Getting the drop tables")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("offers a retry when the first download failed", async () => {
    const updateData = vi.fn(async (): Promise<DataStatus> => ({ busy: true }));
    renderApp(fakePlatform({ status: { busy: false, outcome: "failed", error: "offline" }, updateData }));
    expect(await screen.findByRole("alert")).toHaveTextContent("offline");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(updateData).toHaveBeenCalled();
  });

  it("shows the data date and searches", async () => {
    renderApp();
    expect(await screen.findByText("Tables from Nov 17, 2026")).toBeInTheDocument();
    await userEvent.type(await screen.findByRole("combobox"), "alternox");
    expect(await screen.findByRole("option", { name: /Alternox Prime Stock/ })).toBeInTheDocument();
  });

  it("opens a prime part with its relics, refinements and where they drop", async () => {
    renderApp();
    await open("alternox", /^Alternox/i);
    expect(await screen.findByRole("heading", { level: 1, name: "Alternox Prime Stock" })).toBeInTheDocument();

    const relics = screen.getByRole("heading", { name: "Relics" }).closest("section")!;
    const relic = within(relics).getByRole("button", { name: "Axi A21 Relic" }).closest("div")!.parentElement!;
    expect(within(relic).getByText("Radiant")).toBeInTheDocument();
    expect(within(relic).getByText("10%")).toBeInTheDocument();
    expect(within(relic).getByRole("button", { name: "Hydron" })).toBeInTheDocument();
    expect(within(relic).getByText("~8 runs")).toBeInTheDocument();
    expect(within(relic).getByText("90%: 18")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Meso A9 Relic" })).toBeInTheDocument();
  });

  it("hides vaulted relics on request", async () => {
    renderApp();
    await open("alternox", /^Alternox/i);
    await screen.findByRole("button", { name: "Meso A9 Relic" });
    await userEvent.click(screen.getByRole("checkbox", { name: "Hide vaulted relics" }));
    expect(screen.queryByRole("button", { name: "Meso A9 Relic" })).not.toBeInTheDocument();
  });

  it("filters direct drops by source type and explains enemy chances", async () => {
    renderApp();
    await open("serration", /^Serration/i);
    await screen.findByRole("heading", { level: 1, name: "Serration" });
    expect(screen.getByText("0.332%")).toHaveAttribute("title", "The enemy drops from this table 3% of the time; this item is 11.1% of it");
    await userEvent.click(screen.getByRole("radio", { name: "Enemy" }));
    const table = screen.getByRole("table");
    expect(within(table).queryByRole("button", { name: "Hydron" })).not.toBeInTheDocument();
    expect(within(table).getByRole("button", { name: "Void Shade" })).toBeInTheDocument();
  });

  it("navigates from an item to a source and back", async () => {
    renderApp();
    await open("serration", /^Serration/i);
    await userEvent.click(within(await screen.findByRole("table")).getByRole("button", { name: "Hydron" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Hydron" })).toBeInTheDocument();
    expect(screen.getByText("Sedna · Defense")).toBeInTheDocument();
    expect(screen.getByText("Rotation B")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Serration" })).toBeInTheDocument();
  });

  it("sums up the best bet before the tables", async () => {
    renderApp();
    await open("alternox", /^Alternox/i);
    const best = (await screen.findByRole("heading", { name: "Best bet" })).closest("section")!;
    expect(within(best).getByRole("button", { name: "Axi A21 Relic" })).toBeInTheDocument();
    expect(within(best).getByText("2% Intact · 10% Radiant")).toBeInTheDocument();
    expect(within(best).getByText(/Farm the relic at Hydron · Sedna · Rotation C/)).toBeInTheDocument();
  });

  it("sorts the drop table from its headers, and remembers it", async () => {
    renderApp();
    await open("serration", /^Serration/i);
    const names = () =>
      within(screen.getByRole("table"))
        .getAllByRole("button")
        .filter((b) => !b.closest("th"))
        .map((b) => b.textContent);
    expect(names()).toEqual(["Hydron", "Void Shade"]);
    await userEvent.click(screen.getByRole("button", { name: /^Chance/ }));
    expect(names()).toEqual(["Void Shade", "Hydron"]);
    expect(screen.getByRole("columnheader", { name: /Chance/ })).toHaveAttribute("aria-sort", "ascending");
    await userEvent.click(screen.getByRole("button", { name: /^Source/ }));
    expect(names()).toEqual(["Hydron", "Void Shade"]);
    expect(JSON.parse(localStorage.getItem("iaframe:dropSort")!)).toEqual({ key: "source", direction: "asc" });
  });

  it("filters the drop table by planet, rotation, text and hides events", async () => {
    renderApp();
    await open("gara chassis", /^Gara Chassis/i);
    await screen.findByRole("heading", { level: 1, name: "Gara Chassis Blueprint" });
    const rows = () => within(screen.getByRole("table")).getAllByRole("row").length - 1;
    expect(rows()).toBe(4);

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Planet" }), "Sedna");
    expect(rows()).toBe(2);
    expect(screen.getByText("2 of 4")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Rotation" }), "C");
    expect(rows()).toBe(1);
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(rows()).toBe(4);

    await userEvent.type(screen.getByRole("searchbox", { name: "Filter sources" }), "cetus");
    expect(rows()).toBe(1);
    await userEvent.clear(screen.getByRole("searchbox", { name: "Filter sources" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Hide events" }));
    expect(rows()).toBe(3);

    await userEvent.type(screen.getByRole("searchbox", { name: "Filter sources" }), "zzz");
    expect(screen.getByText("No source matches these filters.")).toBeInTheDocument();
  });

  it("filters search results by type", async () => {
    renderApp();
    await userEvent.type(await screen.findByRole("combobox"), "nezha");
    await screen.findByRole("option", { name: /Nezha Prime Chassis/ });
    await userEvent.click(screen.getByRole("radio", { name: "Warframes" }));
    await waitFor(() => expect(screen.queryByRole("option", { name: /Nezha Prime Chassis/ })).not.toBeInTheDocument());
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("narrows weapon results down to one kind of weapon", async () => {
    renderApp();
    await userEvent.type(await screen.findByRole("combobox"), "prime");
    await screen.findByRole("option", { name: /War Prime/ });
    await userEvent.click(screen.getByRole("radio", { name: "Weapons" }));
    await waitFor(() => expect(screen.queryByRole("option", { name: /Nezha/ })).not.toBeInTheDocument());
    expect(screen.getAllByRole("option")).toHaveLength(2);
    await userEvent.click(screen.getByRole("radio", { name: "Secondary" }));
    await waitFor(() => expect(screen.queryByRole("option", { name: /War Prime/ })).not.toBeInTheDocument());
    expect(screen.getByRole("option", { name: /Lex Prime/ })).toBeInTheDocument();
  });

  it("shows a weapon with no parts in the drop tables and how to get it", async () => {
    renderApp();
    await open("war prime", /War Prime/);
    expect(await screen.findByRole("heading", { level: 1, name: "War Prime" })).toBeInTheDocument();
    expect(screen.getAllByText("Melee").length).toBeGreaterThan(0);
    expect(screen.getByText("It isn't built from parts, or the catalog doesn't list them.")).toBeInTheDocument();
    expect(screen.getByText(/Hunhow's Trinket/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "See War" })).toBeInTheDocument();
  });

  it("filters a source's rewards by name", async () => {
    renderApp();
    await open("serration", /^Serration/i);
    await userEvent.click(within(await screen.findByRole("table")).getByRole("button", { name: "Hydron" }));
    await screen.findByRole("heading", { level: 1, name: "Hydron" });
    await userEvent.type(screen.getByRole("searchbox", { name: "Filter rewards" }), "endo");
    expect(screen.getByText("1 of 12")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Serration" })).not.toBeInTheDocument();
  });

  it("shows item names in the chosen language and searches them", async () => {
    const platform = renderApp();
    await userEvent.click(await screen.findByRole("button", { name: "Settings" }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Show item names in" }), "pt");
    expect(screen.getByRole("checkbox", { name: "Português" })).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox", { name: "Español" }));
    expect(await platform.getSettings()).toEqual({ itemLanguage: "pt", searchLanguages: ["es"] });

    await userEvent.click(screen.getByRole("button", { name: "Drop search" }));
    await open("impulso", /Impulso Arcano/);
    expect(await screen.findByRole("heading", { level: 1, name: "Impulso Arcano" })).toBeInTheDocument();
    expect(screen.getByText("In English: Arcane Momentum")).toBeInTheDocument();
  });

  it("shows relic names translated where they appear", async () => {
    renderApp(fakePlatform({ settings: { itemLanguage: "pt", searchLanguages: [] } }));
    await open("alternox", /^Alternox/i);
    const relics = (await screen.findByRole("heading", { name: "Relics" })).closest("section")!;
    expect(within(relics).getByRole("button", { name: "Relíquia Axi A21" })).toBeInTheDocument();
  });

  it("says when nothing drops an item", async () => {
    renderApp();
    await open("mystery", /^Mystery/i);
    expect(await screen.findByText(/No drop table lists this item/)).toBeInTheDocument();
  });

  it("shows a Warframe's blueprints, how to get it, and its Prime", async () => {
    renderApp();
    await open("nezha", /^Nezha(?! Prime)/);
    expect(await screen.findByRole("heading", { level: 1, name: "Nezha" })).toBeInTheDocument();
    expect(screen.getAllByText("Not in the drop tables")).toHaveLength(4);
    expect(screen.getByText(/researched from the Tenno Lab/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open on the wiki" })).toHaveAttribute("href", "https://wiki.warframe.com/w/Nezha");

    await userEvent.click(screen.getByRole("button", { name: "See Nezha Prime" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Nezha Prime" })).toBeInTheDocument();
    expect(screen.getByText("Vaulted · 8 relics, none farmable")).toBeInTheDocument();
    expect(screen.getByText("Relics · 2 of 5 farmable")).toBeInTheDocument();
    expect(screen.getByText("Drops · up to 12.5%")).toBeInTheDocument();
    expect(screen.queryByText("How to get it")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Nezha Prime Chassis Blueprint" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Nezha Prime Chassis Blueprint" })).toBeInTheDocument();
  });

  it("starts on the Foundry and remembers the section", async () => {
    localStorage.clear();
    renderApp();
    expect(await screen.findByRole("heading", { level: 1, name: "Foundry" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Foundry" })).toHaveAttribute("aria-current", "page");
    await userEvent.click(screen.getByRole("button", { name: "Relics" }));
    expect(localStorage.getItem("iaframe:page")).toBe(JSON.stringify("relics"));
  });

  it("shows equipment as cards with their parts, by category and availability", async () => {
    localStorage.setItem("iaframe:page", JSON.stringify("foundry"));
    renderApp();
    expect(await screen.findByRole("button", { name: "Nezha Prime" })).toBeInTheDocument();
    expect(screen.getByText("4 items")).toBeInTheDocument();
    // Nezha Prime: neuroptics drop, chassis from farmable relics, the rest vaulted.
    expect(screen.getByRole("button", { name: "Nezha Prime Chassis Blueprint · farmable relics" })).toBeInTheDocument();
    // A Prime's part no drop table names is greyed out; a regular frame's is had some other way.
    expect(screen.getByRole("img", { name: "Receiver: not a drop (bought, quest, research...)" })).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: /Market, Dojo, quest or vendor/ })).toHaveLength(4);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Availability" }), "farmable");
    expect(screen.getByRole("button", { name: "Nezha" })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Availability" }), "all");

    await userEvent.click(screen.getByRole("radio", { name: "Melee" }));
    expect(screen.getByText("1 of 4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "War Prime" })).toBeInTheDocument();
    // How to get it, from the wiki, on hover.
    expect(screen.getByText("Other ways to get it", { selector: "span" })).toHaveAttribute(
      "title",
      "War Prime is acquired upon crafting Hunhow's Trinket.",
    );

    await userEvent.click(screen.getByRole("radio", { name: "All" }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Availability" }), "vaulted");
    expect(screen.getByRole("button", { name: "Nezha Prime" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nezha" })).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Availability" }), "all");
    await userEvent.type(screen.getByRole("searchbox", { name: "Filter by name" }), "lex");
    expect(await screen.findByText("1 of 4")).toBeInTheDocument();
  });

  it("opens a card in the side panel and closes it", async () => {
    localStorage.setItem("iaframe:page", JSON.stringify("foundry"));
    renderApp();
    await userEvent.click(await screen.findByRole("button", { name: "Nezha Prime" }));
    const panel = screen.getByRole("complementary", { name: "Details" });
    expect(await within(panel).findByRole("heading", { level: 1, name: "Nezha Prime" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nezha Prime", pressed: true })).toBeInTheDocument();

    await userEvent.click(within(panel).getByRole("button", { name: "Nezha Prime Chassis Blueprint" }));
    expect(await within(panel).findByRole("heading", { level: 1, name: "Nezha Prime Chassis Blueprint" })).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole("button", { name: "Back" }));
    expect(await within(panel).findByRole("heading", { level: 1, name: "Nezha Prime" })).toBeInTheDocument();

    await userEvent.click(within(panel).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("complementary", { name: "Details" })).not.toBeInTheDocument();
  });

  it("lists relics, farmable first by default, filtered by tier and reward", async () => {
    localStorage.setItem("iaframe:page", JSON.stringify("relics"));
    renderApp();
    expect(await screen.findByRole("button", { name: "Axi A21 Relic" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Meso A9 Relic" })).not.toBeInTheDocument();
    expect(screen.getByText("2 of 3")).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Vaulted" }), "all");
    expect(screen.getByRole("button", { name: "Meso A9 Relic" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Lith" }));
    expect(screen.getByText("1 of 3")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "All" }));
    await userEvent.type(screen.getByRole("searchbox", { name: "Filter by relic or reward" }), "alternox");
    await waitFor(() => expect(screen.queryByRole("button", { name: "Lith N3 Relic" })).not.toBeInTheDocument());

    await userEvent.click(screen.getAllByRole("button", { name: "Alternox Prime Stock" })[0]);
    const panel = screen.getByRole("complementary", { name: "Details" });
    expect(await within(panel).findByRole("heading", { level: 1, name: "Alternox Prime Stock" })).toBeInTheDocument();
  });

  it("speaks Portuguese when the system does", async () => {
    renderApp(fakePlatform({ getSystemLocale: async () => "pt-BR" }));
    expect(await screen.findByText("Onde dropa?")).toBeInTheDocument();
    await open("alternox", /^Alternox/i);
    expect(await screen.findByText("~8 runs")).toBeInTheDocument();
    expect(screen.getAllByText("Farmável").length).toBeGreaterThan(0);
  });
});
