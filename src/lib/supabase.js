import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';

const extra = (Constants.expoConfig && Constants.expoConfig.extra) || {};

export const supabase = createClient(
  extra.supabaseUrl || 'https://yjfkghrfiwwbtfguovjw.supabase.co',
  extra.supabaseKey || 'sb_publishable_eo1GTfEFLqu38r1rIxLNxg_n48EHA0O',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export const platformName = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

// Message d'erreur lisible
export function errText(e) {
  if (!e) return '';
  return e.message || e.error_description || String(e);
}
