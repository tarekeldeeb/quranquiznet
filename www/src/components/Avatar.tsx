import {
  Image, Platform, StyleSheet, type ImageStyle, type StyleProp,
} from 'react-native';

interface Props {
  /** Remote profile picture URL (Google/Facebook). */
  uri?: string;
  /** Local fallback image, e.g. require('../../assets/images/app-icon.png'). */
  fallback: number;
  style?: StyleProp<ImageStyle>;
  onError?: () => void;
}

/**
 * Profile avatar with a web-safe loader.
 *
 * Google (`lh3.googleusercontent.com`) and Facebook avatar URLs reject requests
 * that carry a `Referer` header, so on web they 403 and never render through a
 * plain RN-web <Image>. We render a DOM <img referrerPolicy="no-referrer">
 * instead, which is the documented workaround. Native uses RN Image as usual.
 */
export function Avatar({ uri, fallback, style, onError }: Props) {
  if (Platform.OS === 'web' && uri) {
    const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
    return (
      <img
        src={uri}
        referrerPolicy="no-referrer"
        onError={onError}
        // RN style keys are camelCase and map cleanly onto DOM style.
        style={{ ...(flat as React.CSSProperties), objectFit: 'cover' }}
      />
    );
  }
  return <Image source={uri ? { uri } : fallback} style={style} onError={onError} />;
}
