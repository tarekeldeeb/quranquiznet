// Real public-domain/CC0 photos (Wikimedia Commons) of each city's best-known
// site — require() needs static literal paths, so this map can't be built
// from the city id at runtime. Shared by CityCard.tsx and pvp-journey.tsx's
// city ladder.
import type { ImageSourcePropType } from 'react-native';

export const CITY_IMAGES: Record<string, ImageSourcePropType> = {
  jakarta: require('../../assets/images/cities/jakarta.jpg'),
  kualaLumpur: require('../../assets/images/cities/kualaLumpur.jpg'),
  dhaka: require('../../assets/images/cities/dhaka.jpg'),
  delhi: require('../../assets/images/cities/delhi.jpg'),
  lahore: require('../../assets/images/cities/lahore.jpg'),
  kabul: require('../../assets/images/cities/kabul.jpg'),
  tashkent: require('../../assets/images/cities/tashkent.jpg'),
  tehran: require('../../assets/images/cities/tehran.jpg'),
  baghdad: require('../../assets/images/cities/baghdad.jpg'),
  mecca: require('../../assets/images/cities/mecca.jpg'),
  medina: require('../../assets/images/cities/medina.jpg'),
  damascus: require('../../assets/images/cities/damascus.jpg'),
  jerusalem: require('../../assets/images/cities/jerusalem.jpg'),
  istanbul: require('../../assets/images/cities/istanbul.jpg'),
  sarajevo: require('../../assets/images/cities/sarajevo.jpg'),
  cairo: require('../../assets/images/cities/cairo.jpg'),
  tripoli: require('../../assets/images/cities/tripoli.jpg'),
  tunis: require('../../assets/images/cities/tunis.jpg'),
  algiers: require('../../assets/images/cities/algiers.jpg'),
  marrakech: require('../../assets/images/cities/marrakech.jpg'),
};

// Each photo's native width/height ratio (from the shipped file's actual
// pixel dimensions) — hardcoded rather than read via Image.resolveAssetSource,
// since that's a native-only API and throws on react-native-web. Used to
// render these at full row width without ever cropping the width, only the
// height (centered) if the photo is relatively taller than the row.
export const CITY_IMAGE_ASPECT: Record<string, number> = {
  jakarta: 900 / 509,
  kualaLumpur: 900 / 501,
  dhaka: 900 / 675,
  delhi: 900 / 678,
  lahore: 900 / 722,
  kabul: 900 / 598,
  tashkent: 900 / 670,
  tehran: 900 / 675,
  baghdad: 900 / 561,
  mecca: 900 / 600,
  medina: 900 / 600,
  damascus: 900 / 675,
  jerusalem: 675 / 900,
  istanbul: 675 / 900,
  sarajevo: 600 / 900,
  cairo: 900 / 675,
  tripoli: 900 / 603,
  tunis: 900 / 577,
  algiers: 900 / 822,
  marrakech: 900 / 675,
};
