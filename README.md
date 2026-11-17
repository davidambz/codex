# IAFrame

An offline Warframe companion for Windows. Type an item, even misspelled or abbreviated, and get where it drops: mission, rotation, relic, enemy or bounty, with the exact chance and how many runs it takes on average.

Drop data comes from the [WFCD drop data](https://github.com/WFCD/warframe-drop-data) project, built from Digital Extremes' official drop tables. IAFrame checks it when it opens and once a day, and downloads it only when the game has been updated.

> Work in progress. A later phase adds an optional assistant that answers questions in plain language using a local model (Ollama), with every number taken from the same local database.

## Development

Requires Node 24 (see `.tool-versions`; the same Node that ships inside Electron).

```sh
npm ci
npm test
npm run lint
npm run typecheck
```

## License

GPL-3.0-or-later. Warframe is a trademark of Digital Extremes Ltd. IAFrame is a fan project, not affiliated with or endorsed by Digital Extremes.
