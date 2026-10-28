import saved from './settings.json'
import { parseBannerSettings } from './settings-schema'
export * from './settings-schema'
export const DEFAULT_BANNER_SETTINGS = parseBannerSettings(saved)
