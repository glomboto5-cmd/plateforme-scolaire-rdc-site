import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, Share, Text, View } from 'react-native';
import { supabase, errText } from '../lib/supabase';
import { L, t } from '../lib/i18n';
import { useApp } from '../AppContext';
import { Avatar, Muted } from '../components/ui';
import QrImage from '../components/QrImage';
import { avatarUri } from '../lib/chat';

let CameraView = null;
let useCameraPermissions = null;
try {
  const cam = require('expo-camera');
  CameraView = cam.CameraView;
  useCameraPermissions = cam.useCameraPermissions;
} catch (e) {}

function Scanner({ onData, colors }) {
  const [perm, request] = useCameraPermissions();
  const done = useRef(false);
  if (!perm) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />;
  if (!perm.granted) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 }}>
        <Text style={{ color: colors.text, fontSize: 16, textAlign: 'center' }}>{L('Autorisez la caméra pour scanner un code QR.', 'Allow the camera to scan a QR code.')}</Text>
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
        done.current = true;
        onData(String(data), () => { done.current = false; });
      }}
    />
  );
}

export const myQrValue = (profile) => 'unichatplus://u/' + (profile && profile.handle ? profile.handle : '');

// Code QR façon WhatsApp : « Mon code » et « Scanner le code »
export default function MyQrScreen({ navigation, route }) {
  const { colors, profile, userId } = useApp();
  const [tab, setTab] = useState((route.params && route.params.tab) || 'mine');
  const canScan = CameraView && useCameraPermissions && Platform.OS !== 'web';

  const onData = async (data, retry) => {
    // Code de connexion d'un appareil → Appareils connectés
    if (/link\?code=/.test(data)) {
      navigation.replace('LinkedDevices', { code: data });
      return;
    }
    const m = /unichatplus:\/\/u\/([A-Za-z0-9_.]+)/.exec(data);
    if (!m) {
      Alert.alert(L('Code QR', 'QR code'), L("Ce code QR n'est pas un code Ange chat +.", 'Not an Ange chat + QR code.'), [{ text: 'OK', onPress: retry }]);
      return;
    }
    const { data: found, error } = await supabase.rpc('find_user', { p_handle: m[1], p_phone: null });
    const user = found && found[0];
    if (error || !user) return Alert.alert(L('Code QR', 'QR code'), error ? errText(error) : L('Compte introuvable.', 'Account not found.'), [{ text: 'OK', onPress: retry }]);
    if (user.id === userId) return Alert.alert(L('Code QR', 'QR code'), L("C'est votre propre code.", "That's your own code."), [{ text: 'OK', onPress: retry }]);
    await supabase.from('contacts').upsert({ owner_id: userId, contact_user_id: user.id, display_name: user.display_name || m[1] }, { onConflict: 'owner_id,contact_user_id', ignoreDuplicates: true });
    const { data: conv } = await supabase.rpc('get_or_create_direct_conversation', { p_other: user.id });
    if (conv) navigation.replace('Chat', { id: conv });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgAlt }}>
      <View style={{ flexDirection: 'row', backgroundColor: colors.bg }}>
        {[['mine', L('MON CODE', 'MY CODE')], ['scan', L('SCANNER LE CODE', 'SCAN CODE')]].map(([k, label]) => (
          <Pressable key={k} onPress={() => setTab(k)} style={{ flex: 1, alignItems: 'center', paddingVertical: 14, borderBottomWidth: 3, borderBottomColor: tab === k ? colors.brand : 'transparent' }}>
            <Text style={{ color: tab === k ? colors.text : colors.textMuted, fontWeight: '600' }}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'mine' ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 18, paddingTop: 44, paddingBottom: 24, paddingHorizontal: 24, alignItems: 'center', width: '100%', maxWidth: 360 }}>
            <View style={{ position: 'absolute', top: -38, borderRadius: 40, borderWidth: 4, borderColor: '#fff' }}>
              <Avatar uri={avatarUri(profile)} name={profile && profile.display_name} size={72} />
            </View>
            <Text style={{ color: '#111B21', fontSize: 22, fontWeight: '600', marginTop: 4 }}>{profile ? profile.display_name : ''}</Text>
            <Text style={{ color: '#667781', marginBottom: 16 }}>{L('Contact Ange chat +', 'Ange chat + contact')}</Text>
            <QrImage value={myQrValue(profile)} size={240}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 24 }}>😇</Text>
              </View>
            </QrImage>
            <Text style={{ color: '#667781', marginTop: 10 }}>@{profile ? profile.handle : ''}</Text>
          </View>
          <Muted style={{ textAlign: 'center', marginTop: 20 }}>
            {L("Votre code QR est privé. Si vous le partagez avec quelqu'un, cette personne pourra le scanner avec Ange chat + pour vous ajouter en tant que contact.", 'Your QR code is private. Anyone you share it with can scan it to add you.')}
          </Muted>
          <Pressable
            onPress={() => Share.share({ message: L('Ajoutez-moi sur Ange chat + : @', 'Add me on Ange chat +: @') + (profile ? profile.handle : '') + '\n' + myQrValue(profile) })}
            style={{ marginTop: 18, backgroundColor: colors.brand, borderRadius: 22, paddingHorizontal: 24, paddingVertical: 12 }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>↗️ {L('Partager mon code', 'Share my code')}</Text>
          </Pressable>
        </View>
      ) : canScan ? (
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <Scanner onData={onData} colors={colors} />
          <Text style={{ position: 'absolute', bottom: 40, left: 20, right: 20, color: '#fff', textAlign: 'center' }}>
            {L("Scannez le code QR Ange chat + d'un contact, ou celui d'un ordinateur à connecter.", 'Scan a contact’s code or a computer’s link code.')}
          </Text>
        </View>
      ) : (
        <Muted style={{ padding: 24, textAlign: 'center' }}>{L('Le scanner est disponible dans l’application Android.', 'Scanner available in the Android app.')}</Muted>
      )}
    </View>
  );
}
