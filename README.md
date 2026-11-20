# Codex

An offline Warframe companion for Windows. Type an item, even misspelled or abbreviated, and get where it drops: mission, rotation, relic, enemy or bounty, with the exact chance and how many runs it takes on average.

Drop data comes from the [WFCD drop data](https://github.com/WFCD/warframe-drop-data) project, built from Digital Extremes' official drop tables. Codex checks it when it opens and once a day, and downloads it only when the game or the item catalog has been updated. Warframes that never drop (researched in the Dojo, quest rewards, vendors) come from WFCD's [warframe-items](https://github.com/WFCD/warframe-items) catalog, with how to get them from the [Warframe Wiki](https://wiki.warframe.com) (CC BY-SA). What each part's blueprint costs, and where the game says each resource is found, come from the game's own Public Export, which Digital Extremes publishes for community tools.

## Install

Download `CodexSetup-X.Y.Z.exe` from the [latest release](https://github.com/davidambz/codex/releases/latest) and run it. It installs for your user only, without admin rights. Codex updates itself: it checks GitHub's releases when it opens and once a day, and you can also check from Settings.

## Development

Requires Node 24 (see `.tool-versions`; the same Node that ships inside Electron).

```sh
npm ci
npm test
npm run lint
npm run typecheck
```

To build the installer on Windows: `npm run package --workspace @codex/desktop`, then `iscc apps/desktop/installer/codex.iss /DMyAppVersion=X.Y.Z` with Inno Setup 6. Releases are cut by pushing an annotated `vX.Y.Z` tag; the release workflow builds and publishes the installer, with the tag's message as the notes.

## License

GPL-3.0-or-later. Warframe is a trademark of Digital Extremes Ltd. Codex is a fan project, not affiliated with or endorsed by Digital Extremes.
