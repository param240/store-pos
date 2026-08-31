export const API_URL = 'http://localhost:8080';
export const WS_URL = 'ws://localhost:8080';
export const POLL_INTERVAL_MS = 5000;
export const PAGE_SIZE = 50;

// Full-catalog preload pulls larger pages (backend caps limit at 200).
export const CATALOG_PAGE_SIZE = 200;
// Products are cached in chunks to stay under Android AsyncStorage's per-value size limit.
export const CATALOG_CHUNK_SIZE = 1000;

export const PRODUCTS_KEY = 'surat_catalog_products';
export const CATEGORIES_KEY = 'surat_categories';
export const TAGS_KEY = 'surat_tags';
export const SYNC_VERSION_KEY = 'surat_last_sync_version';
