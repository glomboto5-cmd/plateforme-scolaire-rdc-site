import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase, errText } from '../lib/supabase';
import { t, LANGUAGES } from '../lib/i18n';
import { useApp } from '../AppContext';
import { ActionSheet, Avatar, Button, Input, Muted, Row, SectionTitle, Title } from '../components/ui';
import { avatarUri } from '../lib/chat';
import { uploadFile } from '../lib/upload';

export default function ProfileScreen() {
  const { colors, userId, profile, settings, setProfile, updateSettings, signOut, loadProfile } = useApp();
  const [name, setName] = useState('');
  const [about, setAbout] = useState('');
  const [isBusiness, setIsBusiness] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [sheet, setSheet] = useState(null);

  useEffect(() => {
    if (!profile) return;
    setName(profile.display_name || '');
    setAbout(profile.about || '');
    setIsBusiness(!!profile.is_business);
    setBusinessName(profile.business_name || '');
  }, [profile]);

  useEffect(() => {
    supabase.from('account_details').select('phone_e164').eq('user_id', userId).maybeSingle().then(({ data }) => setPhone((data && data.phone_e164) || ''));
  }, [userId]);

  const save = async () => {
    if (!name.trim()) return Alert.alert(t('error'), t('nameRequired'));
    setSaving(true);
    const patch = { display_name: name.trim(), about: about.trim() || null, is_business: isBusiness, business_name: isBusiness ? businessName.trim() || null : null };
    const { data, error } = await supabase.from('profiles').update(patch).eq('id', userId).select().single();
    let err = error;
    const ph = phone.replace(/[\s-]/g, '');
    if (!err && ph && !/^\+[1-9][0-9]{6,14}$/.test(ph)) err = { message: 'Format international requis, ex. +243812345678' };
    if (!err) {
      const r = await supabase.from('account_details').update({ phone_e164: ph || null }).eq('user_id', userId);
      err = r.error;
    }
    setSaving(false);
    if (err) return Alert.alert(t('error'), errText(err));
    if (data) setProfile(data);
    Alert.alert(t('saved'));
  };

  const changePhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
    if (res.canceled || !res.assets) return;
    try {
      const a = res.assets[0];
      const path = await uploadFile({ bucket: 'avatars', userId, uri: a.uri, mimeType: a.mimeType || 'image/jpeg', fileName: a.fileName });
      const { error } = await supabase.from('profiles').update({ avatar_url: path }).eq('id', userId);
      if (error) throw error;
      loadProfile();
    } catch (e) {
      Alert.alert(t('error'), errText(e));
    }
  };

  const choose = (title, options, current, onPick) =>
    setSheet({ title, actions: options.map((o) => ({ label: (o.value === current ? '● ' : '○ ') + o.label, onPress: () => onPick(o.value) })) });

  const vis = [
    { value: 'everyone', label: t('everyone') },
    { value: 'contacts', label: t('contacts') },
    { value: 'nobody', label: t('nobody') },
  ];
  const s = settings || {};
  const langLabel = (LANGUAGES.find((l) => l.code === s.language) || LANGUAGES[0]).label;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bgAlt }} keyboardShouldPersistTaps="handled">
      <View style={{ alignItems: 'center', padding: 20, backgroundColor: colors.bg }}>
        <Pressable onPress={changePhoto}>
          <Avatar uri={avatarUri(profile)} name={profile && profile.display_name} size={96} />
          <Text style={{ color: colors.primary, textAlign: 'center', marginTop: 8 }}>{t('changePhoto')}</Text>
        </Pressable>
        {profile ? <Muted style={{ marginTop: 6 }}>{t('handle')} : @{profile.handle}</Muted> : null}
      </View>

      <SectionTitle>{t('profile')}</SectionTitle>
      <View style={{ padding: 16, gap: 10, backgroundColor: colors.bg }}>
        <Input placeholder={t('name')} value={name} onChangeText={setName} />
        <Input placeholder={t('about')} value={about} onChangeText={setAbout} />
        <Input placeholder={t('phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Title style={{ flex: 1, fontWeight: '400' }}>{t('business')}</Title>
          <Switch value={isBusiness} onValueChange={setIsBusiness} trackColor={{ true: colors.primary }} />
        </View>
        {isBusiness && <Input placeholder={t('businessName')} value={businessName} onChangeText={setBusinessName} />}
        <Button title={t('save')} onPress={save} loading={saving} />
      </View>

      <SectionTitle>{t('settings')}</SectionTitle>
      <Row onPress={() => choose(t('language'), LANGUAGES.map((l) => ({ value: l.code, label: l.label })), s.language, (v) => updateSettings({ language: v, language_auto: false }))}>
        <Title style={{ flex: 1, fontWeight: '400' }}>🌐 {t('language')}</Title>
        <Muted>{langLabel}</Muted>
      </Row>
      <Row onPress={() => choose(t('theme'), [{ value: 'system', label: t('system') }, { value: 'light', label: t('light') }, { value: 'dark', label: t('dark') }], s.theme, (v) => updateSettings({ theme: v }))}>
        <Title style={{ flex: 1, fontWeight: '400' }}>🎨 {t('theme')}</Title>
        <Muted>{t(s.theme || 'system')}</Muted>
      </Row>

      <SectionTitle>{t('privacy')}</SectionTitle>
      <Row>
        <Title style={{ flex: 1, fontWeight: '400' }}>{t('readReceipts')}</Title>
        <Switch value={s.read_receipts !== false} onValueChange={(v) => updateSettings({ read_receipts: v })} trackColor={{ true: colors.primary }} />
      </Row>
      <Row onPress={() => choose(t('whoCanAddMe'), vis, s.group_add_permission, (v) => updateSettings({ group_add_permission: v }))}>
        <Title style={{ flex: 1, fontWeight: '400' }}>{t('whoCanAddMe')}</Title>
        <Muted>{t(s.group_add_permission === 'contacts' ? 'contacts' : s.group_add_permission || 'contacts')}</Muted>
      </Row>

      <View style={{ padding: 16, paddingBottom: 40 }}>
        <Button title={t('logout')} variant="danger" onPress={signOut} />
        <Muted style={{ textAlign: 'center', marginTop: 16, fontSize: 12 }}>Ange chat + · v1.0.0</Muted>
      </View>

      <ActionSheet visible={!!sheet} title={sheet && sheet.title} actions={sheet && sheet.actions} onClose={() => setSheet(null)} />
    </ScrollView>
  );
}
