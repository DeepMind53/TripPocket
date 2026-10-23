export const APP_NAME = '트립포켓';

export {
  addDays,
  diffDays,
  fromEpochDay,
  isLocalDate,
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
  flagEmoji,
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
export {
  buildRecommendations,
  type AiCategory,
  type CategoryResult,
  type ExtractedPlace,
  type Recommendation,
  type SourcePost,
} from './ai/recommend';
export { distanceKm, formatDistance, walkMinutes, type LatLng } from './geo/distance';
