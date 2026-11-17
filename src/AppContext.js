import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, I18nManager, Linking, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from './lib/device';
import { supabase, platformName } from './lib/supabase';
import { setLanguage, deviceLanguage, t } from './lib/i18n';
import { lightColors, darkColors } from './lib/theme';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

const DEVICE_KEY = 'unichat.deviceId';

function parseParams(url) {
  const out = {};
  const parts = [];
  const h = url.indexOf('#');
  const q = url.indexOf('?');
  if (q >= 0) parts.push(url.slice(q + 1, h > q ? h : undefined));
  if (h >= 0) parts.push(url.slice(h + 1));
  parts.join('&').split('&').forEach((kv) => {
    if (!kv) return;
    const i = kv.indexOf('=');
    const k = decodeURIComponent(i >= 0 ? kv.slice(0, i) : kv);
    out[k] = decodeURIComponent((i >= 0 ? kv.slice(i + 1) : '').replace(/\+/g, ' '));
  });
  return out;
}

async function handleAuthUrl(url) {
  if (!url || !/access_token|token_hash|error|code=/.test(url)) return;
  const p = parseParams(url);
  let error = null;
  if (p.error_description || p.error) {
    error = { message: p.error_description || p.error };
  } else if (p.access_token && p.refresh_token) {
    ({ error } = await supabase.auth.setSession({ access_token: p.access_token, refresh_token: p.refresh_token }));
  } else if (p.token_hash) {
    ({ error } = await supabase.auth.verifyOtp({ token_hash: p.token_hash, type: p.type || 'email' }));
  } else if (p.code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(p.code));
  }
  if (error) Alert.alert(t('error'), error.message === 'Email link is invalid or has expired' ? t('linkExpired') : error.message);
}

export function AppProvider({ children }) {
  const scheme = useColorScheme();
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState(null);
  const [settings, setSettings] = useState(null);
  const [lang, setLang] = useState(deviceLanguage());
  const deviceIdRef = useRef(null);

  setLanguage(lang);

  const theme = settings && settings.theme !== 'system' ? settings.theme : scheme || 'light';
  const colors = theme === 'dark' ? darkColors : lightColors;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    // Connexion par le lien reçu par e-mail (unichatplus://login#access_token=...)
    Linking.getInitialURL().then((u) => u && handleAuthUrl(u));
    const linkSub = Linking.addEventListener('url', (ev) => handleAuthUrl(ev.url));
    return () => {
      sub.subscription.unsubscribe();
      linkSub.remove();
    };
  }, []);

  const userId = session ? session.user.id : null;

  const loadProfile = useCallback(async () => {
    if (!userId) return;
    const [{ data: p }, { data: s }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
    ]);
    setProfile(p);
    setSettings(s);
    if (s && s.language) setLang(s.language);
  }, [userId]);

  const signOut = useCallback(async () => {
    await AsyncStorage.removeItem(DEVICE_KEY);
    deviceIdRef.current = null;
    await supabase.auth.signOut();
    setProfile(null);
    setSettings(null);
  }, []);

  // Point 10 : un seul appareil actif
  const checkDevice = useCallback(async () => {
    if (!userId || !deviceIdRef.current) return;
    const { data } = await supabase.from('user_devices').select('is_active').eq('id', deviceIdRef.current).maybeSingle();
    if (data && !data.is_active) {
      Alert.alert(t('deviceRevoked'), t('deviceRevokedText'));
      signOut();
    }
  }, [userId, signOut]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      let stored = await AsyncStorage.getItem(DEVICE_KEY);
      if (stored) {
        const { data } = await supabase.from('user_devices').select('id,user_id,is_active').eq('id', stored).maybeSingle();
        if (!data || data.user_id !== userId) stored = null;
        else if (!data.is_active) {
          if (!cancelled) {
            Alert.alert(t('deviceRevoked'), t('deviceRevokedText'));
            signOut();
          }
          return;
        }
      }
      if (!stored) {
        const { data: id, error } = await supabase.rpc('activate_device', {
          p_platform: platformName,
          p_device_name: Device.name(),
        });
        if (!error && id) {
          stored = id;
          await AsyncStorage.setItem(DEVICE_KEY, id);
        }
      }
      deviceIdRef.current = stored;
      if (!cancelled) loadProfile();
    })();
    const sub = AppState.addEventListener('change', (st) => st === 'active' && checkDevice());
    const timer = setInterval(checkDevice, 60000);
    return () => {
      cancelled = true;
      sub.remove();
      clearInterval(timer);
    };
  }, [userId, loadProfile, checkDevice, signOut]);

  const updateSettings = useCallback(
    async (patch) => {
      setSettings((s) => ({ ...(s || {}), ...patch }));
      if (patch.language) {
        const wasRtl = I18nManager.isRTL;
        const rtl = patch.language === 'ar';
        setLang(patch.language);
        if (wasRtl !== rtl) {
          I18nManager.allowRTL(rtl);
          I18nManager.forceRTL(rtl);
          setLanguage(patch.language);
          Alert.alert(t('language'), t('restartForLanguage'));
        }
      }
      const { error } = await supabase.from('user_settings').update(patch).eq('user_id', userId);
      if (error) Alert.alert(t('error'), error.message);
    },
    [userId]
  );

  const value = useMemo(
    () => ({ ready, session, userId, profile, settings, colors, theme, lang, loadProfile, setProfile, updateSettings, signOut }),
    [ready, session, userId, profile, settings, colors, theme, lang, loadProfile, updateSettings, signOut]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
