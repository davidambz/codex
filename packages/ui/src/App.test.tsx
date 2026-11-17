// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { render, screen, within } from "@testing-library/react";
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

    const relic = screen.getByRole("button", { name: "Axi A21 Relic" }).closest("div")!.parentElement!;
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
    expect(screen.queryByRole("button", { name: "Hydron" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Void Shade" })).toBeInTheDocument();
  });

  it("navigates from an item to a source and back", async () => {
    renderApp();
    await open("serration", /^Serration/i);
    await userEvent.click(await screen.findByRole("button", { name: "Hydron" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Hydron" })).toBeInTheDocument();
    expect(screen.getByText("Sedna · Defense")).toBeInTheDocument();
    expect(screen.getByText("Rotation B")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Serration" })).toBeInTheDocument();
  });

  it("says when nothing drops an item", async () => {
    renderApp();
    await open("mystery", /^Mystery/i);
    expect(await screen.findByText(/No drop table lists this item/)).toBeInTheDocument();
  });

  it("speaks Portuguese when the system does", async () => {
    renderApp(fakePlatform({ getSystemLocale: async () => "pt-BR" }));
    expect(await screen.findByText("Onde dropa?")).toBeInTheDocument();
    await open("alternox", /^Alternox/i);
    expect(await screen.findByText("~8 runs")).toBeInTheDocument();
    expect(screen.getAllByText("Farmável").length).toBeGreaterThan(0);
  });
});
