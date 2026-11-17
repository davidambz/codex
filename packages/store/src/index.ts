// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

export { ingest, WFCD_DATA_URL, WFCD_INFO_URL, type FetchJson, type IngestOptions, type IngestResult } from "./ingest.ts";
export { openStore, readCatalog, readItemNames, readMeta, type Store } from "./sqlite.ts";
export { fetchCatalog, needsAcquisition, wikiPagesUrl, WARFRAMES_URL, WIKI_API_URL } from "./catalog.ts";
export { buildDatabase } from "./build.ts";
export { SCHEMA_VERSION } from "./schema.ts";
export { createDataService, type DataService, type DataServiceOptions } from "./service.ts";
