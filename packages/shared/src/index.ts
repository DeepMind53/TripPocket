export const APP_NAME = '트립포켓';

export {
  addDays,
  diffDays,
  fromEpochDay,
  isLocalDate,
  parseTypedTime,
  todayIn,
  toEpochDay,
  weekday,
  type LocalDate,
  type LocalTime,
} from './date/localDate';
export { nightsBetween } from './date/tripLength';
export {
  dayNumberOf,
  daysUntil,
  getTripDays,
  getTripStatus,
  type TripStatus,
} from './date/tripDays';
export { uuidv7 } from './id/uuidv7';
export { compareKeys, keyBetween, keysBetween } from './order/fractionalIndex';
export * from './schema/entities';
export {
  allCities,
  choseong,
  findCityByName,
  findCountry,
  normalize,
  popularCities,
  searchPlaces,
  type CityInfo,
  type CountryInfo,
  type PlaceHit,
} from './data/places';
export {
  DEVICE_SETTINGS,
  parseSettings,
  SETTINGS_DEFAULTS,
  type Settings,
  pickSynced,
  SYNCED_SETTINGS,
} from './settings/settings';
export {
  BACKUP_FORMAT,
  BACKUP_SCHEMA_VERSION,
  BACKUP_TABLE_NAMES,
  parseBackup,
  type BackupFile,
  type BackupTable,
  type ParsedBackup,
} from './backup/backup';
export {
  parsePush,
  parseRecord,
  SYNC_BATCH,
  SYNC_TABLES,
  TRIP_SCOPED,
  USER_SCOPED,
  type PullResult,
  type TripRole,
  type PushChange,
  type PushResult,
  type SyncRecord,
  type SyncTable,
} from './sync/sync';
export {
  COUNTRY_CURRENCY,
  fromKrw,
  HUNDRED_UNIT,
  parseEximRow,
  POPULAR_CURRENCIES,
  toKrw,
  type FxSnapshot,
  mergeFallbackRates,
  upcomingTripCurrencies,
} from './fx/fx';
export {
  choosePeriod,
  countByPeriod,
  DEFAULT_RULE,
  PERIOD_MONTHS,
  withinMonths,
  type PeriodMonths,
  type PeriodRule,
} from './ai/periods';
export { toPublicTrip, type PublicTrip } from './share/share';
export {
  isOutsideHours,
  rankPlaces,
  similarity,
  type PlaceDetails,
  type PlaceSource,
  type PlaceSummary,
} from './places/placeSearch';
export { RouteEtaBody, type Coords, type RouteEta } from './places/route';
export {
  alertQuery,
  MAX_ALERT_POINTS,
  notableAlerts,
  pointsByCountry,
  topAlertLevel,
  MOFA_SAFETY_URL,
  POINT_ALERT_COUNTRIES,
  roundAlertPoint,
  WEATHER_WARNING_LINKS,
  WMO_SEVERE_WEATHER,
  warningLinkFor,
  type AlertKind,
  type AlertLevel,
  type AlertSource,
  type AlertsResponse,
  type DestinationAlert,
} from './alerts/alerts';
export {
  buildRecommendations,
  type AiCategory,
  type CategoryResult,
  type ExtractedPlace,
  type Recommendation,
  type SourcePost,
  AI_CATEGORIES,
  pickRadius,
  RADIUS_TIERS_KM,
} from './ai/recommend';
export { distanceKm, formatDistance, inKorea, walkMinutes, type LatLng } from './geo/distance';
export { cleanShortText, NICKNAME_MAX, normalizeNickname } from './user/nickname';
export { findAirport, searchAirports, type Airport } from './data/airports';
export { flagEmoji } from './data/flag';
export * from './reviews/reviews';
export * from './data/essentials';
export * from './data/phrases';
export * from './data/emergency';
export { DEFAULT_PUSH_PREFS, PUSH_KINDS, type PushKind, type PushPrefs } from './push/push';
