import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase, errText } from '../lib/supabase';
import { L, t } from '../lib/i18n';
import { useApp } from '../AppContext';
import { Muted } from '../components/ui';
import { formatTime } from '../lib/chat';

let CameraView = null;
let useCameraPermissions = null;
try {
  const cam = require('expo-camera');
  CameraView = cam.CameraView;
  useCameraPermissions = cam.useCameraPermissions;
} catch (e) {}

function Scanner({ onCode, onClose, colors }) {
  const [perm, request] = useCameraPermissions();
  const done = useRef(false);
  if (!perm) return <ActivityIndicator style={{ marginTop: 40 }} color="#fff" />;
  if (!perm.granted) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 }}>
        <Text style={{ color: '#fff', fontSize: 16, textAlign: 'center' }}>{L('Autorisez la caméra pour scanner le QR code.', 'Allow the camera to scan the QR code.')}</Text>
        <Pressable onPress={request} style={{ marginTop: 16, backgroundColor: colors.brand, borderRadius: 22, paddingHorizontal: 22, paddingVertical: 12 }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>{L('Autoriser', 'Allow')}</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <CameraView
      style={{ flex: 1 }}
      facing="back"
      barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      onBarcodeScanned={({ data }) => {
        if (done.current) return;
        if (!/code=|^[A-Z0-9-]{8,9}$/i.test(String(data))) return;
        done.current = true;
        onCode(String(data));
      }}
    />
  );
}

// Appareils connectés façon WhatsApp : le téléphone reste principal, jusqu'à 4 appareils liés
export default function LinkedDevicesScreen({ route, navigation }) {
  const { colors, userId } = useApp();
  const [devices, setDevices] = useState([]);
  const [scan, setScan] = useState(false);
  const [manual, setManual] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('user_devices').select('*').eq('user_id', userId).eq('is_active', true).order('activated_at', { ascending: false });
    setDevices(data || []);
  }, [userId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const link = async (raw) => {
    setScan(false);
    setManual(false);
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('link-device', { body: { code: raw } });
    setBusy(false);
    let res = data;
    if (error) {
      try { res = await error.context.json(); } catch (e) { res = { ok: false, error: errText(error) }; }
    }
    if (!res || !res.ok) return Alert.alert(L('Connexion impossible', 'Could not link'), (res && res.error) || L('Réessayez.', 'Try again.'));
    setCode('');
    Alert.alert('✅ ' + L('Appareil connecté', 'Device linked'), res.device_name || '');
    setTimeout(load, 3000);
  };

  const unlink = (d) =>
    Alert.alert(L('Déconnecter cet appareil ?', 'Log out this device?'), d.device_name || '', [
      { text: t('cancel'), style: 'cancel' },
      { text: L('Déconnecter', 'Log out'), style: 'destructive', onPress: async () => {
        const { error } = await supabase.rpc('revoke_linked_device', { p_device: d.id });
        if (error) Alert.alert(t('error'), errText(error));
        load();
      } },
    ]);

  useEffect(() => { if (route && route.params && route.params.code) link(route.params.code); }, [route && route.params && route.params.code]);

  const primary = devices.find((d) => !d.is_linked);
  const linked = devices.filter((d) => d.is_linked);
  const canScan = CameraView && useCameraPermissions && Platform.OS !== 'web';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={{ alignItems: 'center', paddingHorizontal: 28, paddingTop: 30 }}>
        <Text style={{ fontSize: 70 }}>📱💬💻</Text>
        <Text style={{ color: colors.text, fontSize: 26, textAlign: 'center', marginTop: 18 }}>{L('Utilisez Ange chat + sur d’autres appareils', 'Use Ange chat + on other devices')}</Text>
        <Muted style={{ textAlign: 'center', marginTop: 12, fontSize: 16 }}>
          {L('Vous pouvez connecter jusqu’à 4 autres appareils à ce compte, y compris un ordinateur (Windows, Mac) et le Web.', 'Link up to 4 other devices, including Windows, Mac and Web.')}
        </Muted>
      </View>

      <Pressable onPress={() => (canScan ? setScan(true) : setManual(true))} disabled={busy} style={{ marginHorizontal: 20, marginTop: 30, backgroundColor: colors.brand, borderRadius: 28, paddingVertical: 15, alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>{L('Connecter un appareil', 'Link a device')}</Text>}
      </Pressable>
      <Pressable onPress={() => setManual(true)} style={{ alignItems: 'center', padding: 12 }}>
        <Text style={{ color: colors.primary, fontWeight: '700' }}>{L('Saisir le code à la place', 'Enter code instead')}</Text>
      </Pressable>

      {primary ? (
        <>
          <Text style={{ color: colors.textMuted, fontWeight: '700', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 6 }}>{L('Téléphone principal', 'Main phone')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 }}>
            <Text style={{ fontSize: 28, width: 44 }}>📱</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 16 }}>{primary.device_name || primary.platform}</Text>
              <Muted>{L('Actif', 'Active')}</Muted>
            </View>
          </View>
        </>
      ) : null}

      {linked.length ? <Text style={{ color: colors.textMuted, fontWeight: '700', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6 }}>{L('Appareils connectés', 'Linked devices')} ({linked.length}/4)</Text> : null}
      {linked.map((d) => (
        <Pressable key={d.id} onPress={() => unlink(d)} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 }}>
          <Text style={{ fontSize: 28, width: 44 }}>{d.platform === 'web' ? '💻' : '📱'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 16 }} numberOfLines={1}>{d.device_name || 'Navigateur'}</Text>
            <Muted>{L('Connecté ', 'Linked ')}{formatTime(d.activated_at, t)} · {L('toucher pour déconnecter', 'tap to log out')}</Muted>
          </View>
        </Pressable>
      ))}

      <Muted style={{ textAlign: 'center', padding: 24 }}>
        🔒 {L('Vos messages restent protégés sur tous vos appareils. Si vous vous connectez sur un autre téléphone, tous les appareils connectés sont déconnectés.', 'Messages stay protected. Logging in on another phone logs out all linked devices.')}
      </Muted>

      <Modal visible={scan} animationType="slide" onRequestClose={() => setScan(false)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {scan && canScan ? <Scanner colors={colors} onCode={link} onClose={() => setScan(false)} /> : null}
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 40, alignItems: 'center', gap: 12 }}>
            <Text style={{ color: '#fff', fontSize: 16, textAlign: 'center', paddingHorizontal: 30 }}>{L('Visez le QR code affiché sur l’ordinateur (Ange chat + Web)', 'Point at the QR code on the computer')}</Text>
            <Pressable onPress={() => setScan(false)} style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 22, paddingHorizontal: 24, paddingVertical: 10 }}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>{t('cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={manual} transparent animationType="fade" onRequestClose={() => setManual(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 18, padding: 20, gap: 12 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{L('Code affiché sur l’ordinateur', 'Code shown on the computer')}</Text>
            <TextInput
              value={code}
              onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 9))}
              placeholder="ABCD-1234"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              autoFocus
              style={{ color: colors.text, fontSize: 26, letterSpacing: 4, textAlign: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 10 }}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable onPress={() => setManual(false)} style={{ flex: 1, padding: 12, alignItems: 'center' }}>
                <Text style={{ color: colors.primary, fontWeight: '700' }}>{t('cancel')}</Text>
              </Pressable>
              <Pressable onPress={() => link(code)} disabled={code.replace(/-/g, '').length !== 8} style={{ flex: 1, padding: 12, alignItems: 'center', backgroundColor: colors.brand, borderRadius: 12, opacity: code.replace(/-/g, '').length !== 8 ? 0.5 : 1 }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>{L('Connecter', 'Link')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
