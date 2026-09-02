import Constants from 'expo-constants';

// Talk to the same machine that's serving Metro, so the API works on the iOS
// simulator, the Android emulator, and physical devices without hardcoding an
// IP. `localhost` only resolves to the dev machine on the iOS simulator - on the
// Android emulator it points at the emulator itself, which is why calls failed
// there. For a real build, point this at the deployed API instead.
const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
const API_HOST = devHost ?? 'localhost';

export const API_URL = `http://${API_HOST}:8080`;
export const WS_URL = `ws://${API_HOST}:8080`;
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
export const BUMP_QUEUE_KEY = 'surat_pending_bumps';
