import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { L } from '../lib/i18n';
import { useApp } from '../AppContext';
import * as Device from '../lib/device';
import QrImage from './QrImage';

export const LINK_KEY = 'unichat.linkRequest';

// Connexion d'un ordinateur / navigateur en scannant le QR avec le téléphone principal (comme WhatsApp Web)
export default function LinkWithPhone({ visible, onClose }) {
  const { colors } = useApp();
  const [req, setReq] = useState(null);
  const [state, setState] = useState('loading');
  const timer = useRef(null);

  const start = async () => {
    setState('loading');
    const { data, error } = await supabase.rpc('create_link_request', { p_device_name: Device.name(), p_platform: Platform.OS === 'web' ? 'web' : Platform.OS });
    if (error || !data || !data[0]) return setState('error');
    setReq(data[0]);
    setState('waiting');
  };

  useEffect(() => {
    if (!visible) return;
    start();
    return () => clearInterval(timer.current);
  }, [visible]);

  useEffect(() => {
    clearInterval(timer.current);
    if (!req || state !== 'waiting') return;
    timer.current = setInterval(async () => {
      const { data } = await supabase.rpc('poll_link_request', { p_id: req.id, p_secret: req.secret });
      const r = data && data[0];
      if (!r) return;
      if (r.status === 'expired') { clearInterval(timer.current); setState('expired'); }
      if (r.status === 'approved' && r.token_hash) {
        clearInterval(timer.current);
        setState('connecting');
        await AsyncStorage.setItem(LINK_KEY, JSON.stringify({ id: req.id, secret: req.secret }));
        const { error } = await supabase.auth.verifyOtp({ token_hash: r.token_hash, type: 'magiclink' });
        if (error) { await AsyncStorage.removeItem(LINK_KEY); setState('error'); }
      }
    }, 2000);
    return () => clearInterval(timer.current);
  }, [req, state]);

  const pretty = req ? req.code.slice(0, 4) + '-' + req.code.slice(4) : '';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: 24, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800', textAlign: 'center' }}>{L('Se connecter avec le téléphone', 'Log in with your phone')}</Text>
        <View style={{ marginTop: 18, gap: 6, maxWidth: 420 }}>
          <Text style={{ color: colors.text, fontSize: 16 }}>1. {L('Ouvrez Ange chat + sur votre téléphone', 'Open Ange chat + on your phone')}</Text>
          <Text style={{ color: colors.text, fontSize: 16 }}>2. {L('Paramètres → Appareils connectés → Connecter un appareil', 'Settings → Linked devices → Link a device')}</Text>
          <Text style={{ color: colors.text, fontSize: 16 }}>3. {L('Scannez ce QR code ou saisissez le code', 'Scan this QR code or enter the code')}</Text>
        </View>
        <View style={{ marginTop: 24, alignItems: 'center', minHeight: 240, justifyContent: 'center' }}>
          {state === 'loading' || state === 'connecting' ? <ActivityIndicator size="large" color={colors.primary} /> : null}
          {state === 'waiting' && req ? (
            <>
              <QrImage value={'unichatplus://link?code=' + req.code} size={240} />
              <Text style={{ color: colors.text, fontSize: 34, fontWeight: '800', letterSpacing: 4, marginTop: 16 }}>{pretty}</Text>
              <Text style={{ color: colors.textMuted, marginTop: 4 }}>{L('Valable 5 minutes', 'Valid for 5 minutes')}</Text>
            </>
          ) : null}
          {state === 'connecting' ? <Text style={{ color: colors.text, marginTop: 12 }}>{L('Connexion…', 'Connecting…')}</Text> : null}
          {state === 'expired' || state === 'error' ? (
            <Pressable onPress={start} style={{ backgroundColor: colors.brand, borderRadius: 22, paddingHorizontal: 22, paddingVertical: 12 }}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>{state === 'expired' ? L('Code expiré — en afficher un nouveau', 'Expired — get a new code') : L('Réessayer', 'Retry')}</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={{ color: colors.textMuted, marginTop: 20, textAlign: 'center' }}>🔒 {L('Votre téléphone reste l’appareil principal. Vous pouvez déconnecter cet appareil à tout moment depuis le téléphone.', 'Your phone stays the main device.')}</Text>
        <Pressable onPress={onClose} style={{ marginTop: 18, padding: 10 }}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>{L('Retour', 'Back')}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
