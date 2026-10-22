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
