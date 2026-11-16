import { Platform } from 'react-native';

export function name() {
  if (Platform.OS === 'web') {
    try {
      return (navigator.userAgent || 'Navigateur').slice(0, 80);
    } catch (e) {
      return 'Navigateur';
    }
  }
  const c = Platform.constants || {};
  return [c.Manufacturer || c.Brand, c.Model || c.systemName, Platform.Version].filter(Boolean).join(' ');
}
