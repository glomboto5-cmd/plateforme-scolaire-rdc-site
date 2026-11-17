import React, { useCallback, useState } from 'react';
import { Alert, Linking, Modal, Pressable, ScrollView, Share, Switch, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase, errText } from '../lib/supabase';
import { L, t } from '../lib/i18n';
import { useApp } from '../AppContext';
import { Button, Muted, Title } from '../components/ui';
import { invitationText } from '../lib/whatsapp';

export const PLATFORMS = [
  { key: 'facebook', name: 'Facebook', icon: '📘', url: (u) => 'https://facebook.com/' + u, app: 'fb://facewebmodal/f?href=https://facebook.com/' },
  { key: 'messenger', name: 'Messenger', icon: '💬', url: (u) => 'https://m.me/' + u },
  { key: 'instagram', name: 'Instagram', icon: '📸', url: (u) => 'https://instagram.com/' + u },
  { key: 'tiktok', name: 'TikTok', icon: '🎵', url: (u) => 'https://www.tiktok.com/@' + u },
  { key: 'youtube', name: 'YouTube', icon: '▶️', url: (u) => 'https://youtube.com/@' + u },
  { key: 'x', name: 'X (Twitter)', icon: '✖️', url: (u) => 'https://x.com/' + u },
  { key: 'other', name: L('Autre réseau', 'Other network'), icon: '🌐', url: (u) => (u.startsWith('http') ? u : 'https://' + u) },
];

export function socialUrl(acc) {
  if (acc.profile_url) return acc.profile_url;
  const p = PLATFORMS.find((x) => x.key === acc.platform);
  return p && acc.username ? p.url(acc.username.replace(/^@/, '')) : null;
}

export default function SocialScreen() {
  const { colors, userId, profile } = useApp();
  const [accounts, setAccounts] = useState([]);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('social_accounts').select('*').eq('user_id', userId).order('created_at');
    setAccounts(data || []);
  }, [userId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    const u = (edit.username || '').trim();
    if (!u) return Alert.alert(t('error'), L('Indiquez votre nom d’utilisateur ou le lien de votre profil', 'Enter your username or profile link'));
    const isUrl = /^https?:\/\//i.test(u) || /\.\w{2,}\//.test(u);
    const row = {
      user_id: userId,
      platform: edit.platform,
      platform_name: edit.platform === 'other' ? (edit.platform_name || '').trim() || null : null,
      username: isUrl ? null : u.replace(/^@/, ''),
      profile_url: isUrl ? (u.startsWith('http') ? u : 'https://' + u) : null,
      external_account_id: isUrl ? u : u.replace(/^@/, '').toLowerCase(),
      status: 'connected',
      connected_at: new Date().toISOString(),
      is_public: edit.is_public,
    };
    setBusy(true);
    const { error } = edit.id ? await supabase.from('social_accounts').update(row).eq('id', edit.id) : await supabase.from('social_accounts').insert(row);
    setBusy(false);
    if (error) return Alert.alert(t('error'), errText(error));
    setEdit(null);
    load();
  };

  const remove = async () => {
    await supabase.from('social_accounts').delete().eq('id', edit.id);
    setEdit(null);
    load();
  };

  const shareOn = (p) => Share.share({ message: invitationText(profile && profile.display_name) });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bgAlt }} contentContainerStyle={{ paddingBottom: 40 }}>
      <Muted style={{ padding: 16 }}>
        {L(
          'Reliez vos comptes : ils apparaissent sur votre profil Unichat + et vos contacts peuvent vous y retrouver en un geste. Vous pouvez aussi partager vos produits, statuts et événements sur ces réseaux.',
          'Link your accounts: they appear on your Unichat + profile.'
        )}
      </Muted>
      {PLATFORMS.map((p) => {
        const list = accounts.filter((a) => a.platform === p.key);
        return (
          <View key={p.key} style={{ backgroundColor: colors.bg, marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}>
              <Text style={{ fontSize: 26, width: 42 }}>{p.icon}</Text>
              <Title style={{ flex: 1 }}>{p.name}</Title>
              <Pressable onPress={() => setEdit({ platform: p.key, username: '', is_public: true, platform_name: '' })} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, backgroundColor: colors.chipActiveBg }}>
                <Text style={{ color: colors.chipActiveText, fontWeight: '700' }}>{list.length ? '＋' : L('Relier', 'Link')}</Text>
              </Pressable>
            </View>
            {list.map((a) => (
              <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 12, paddingLeft: 56 }}>
                <Pressable style={{ flex: 1 }} onPress={() => setEdit({ ...a, username: a.profile_url || (a.username ? '@' + a.username : '') })}>
                  <Text style={{ color: colors.text, fontWeight: '600' }}>{a.platform_name ? a.platform_name + ' · ' : ''}{a.username ? '@' + a.username : a.profile_url}</Text>
                  <Muted style={{ fontSize: 12 }}>✅ {L('Relié', 'Linked')}{a.is_public ? ' · ' + L('visible sur mon profil', 'shown on profile') : ''}</Muted>
                </Pressable>
                <Pressable onPress={() => socialUrl(a) && Linking.openURL(socialUrl(a))} style={{ padding: 8 }}><Text style={{ fontSize: 18 }}>↗️</Text></Pressable>
                <Pressable onPress={() => shareOn(p)} style={{ padding: 8 }}><Text style={{ fontSize: 18 }}>📤</Text></Pressable>
              </View>
            ))}
          </View>
        );
      })}

      <Modal visible={!!edit} transparent animationType="fade" onRequestClose={() => setEdit(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 }}>
          {edit ? (
            <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 18, gap: 12 }}>
              <Title style={{ fontSize: 18 }}>{(PLATFORMS.find((x) => x.key === edit.platform) || {}).icon} {(PLATFORMS.find((x) => x.key === edit.platform) || {}).name}</Title>
              {edit.platform === 'other' ? (
                <TextInput value={edit.platform_name} onChangeText={(v) => setEdit({ ...edit, platform_name: v })} placeholder={L('Nom du réseau (ex. LinkedIn, Telegram)', 'Network name')} placeholderTextColor={colors.textMuted} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, color: colors.text, fontSize: 16 }} />
              ) : null}
              <TextInput
                value={edit.username}
                onChangeText={(v) => setEdit({ ...edit, username: v })}
                placeholder={L('@nom d’utilisateur ou lien du profil', '@username or profile link')}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, color: colors.text, fontSize: 16 }}
              />
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ flex: 1, color: colors.text }}>{L('Afficher sur mon profil', 'Show on my profile')}</Text>
                <Switch value={edit.is_public} onValueChange={(v) => setEdit({ ...edit, is_public: v })} trackColor={{ true: colors.primary }} />
              </View>
              <Button title={t('save')} onPress={save} loading={busy} />
              {edit.id ? <Button title={L('Délier ce compte', 'Unlink')} variant="danger" onPress={remove} /> : null}
              <Button title={t('cancel')} variant="ghost" onPress={() => setEdit(null)} />
            </View>
          ) : null}
        </View>
      </Modal>
    </ScrollView>
  );
}
