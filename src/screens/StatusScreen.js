import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { supabase, errText } from '../lib/supabase';
import { L } from '../lib/i18n';
import { useApp } from '../AppContext';
import { ActionSheet, Avatar, Button, Muted, Row, SectionTitle, Title } from '../components/ui';
import { avatarUri, formatTime } from '../lib/chat';
import { uploadFile } from '../lib/upload';
import { t } from '../lib/i18n';

const BG = ['#0E7C66', '#1F7AE0', '#8E44AD', '#D35400', '#C0392B', '#2C3E50', '#16A085'];

export default function StatusScreen({ navigation }) {
  const { colors, userId, profile } = useApp();
  const [mine, setMine] = useState([]);
  const [others, setOthers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState(false);
  const [textModal, setTextModal] = useState(false);
  const [text, setText] = useState('');
  const [bg, setBg] = useState(BG[0]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const now = new Date().toISOString();
    const { data } = await supabase
      .from('statuses')
      .select('*, author:profiles!statuses_user_id_fkey(id,display_name,avatar_url), status_views(viewer_id)')
      .gt('expires_at', now)
      .order('created_at', { ascending: true });
    const all = data || [];
    setMine(all.filter((s) => s.user_id === userId));
    const byUser = {};
    all
      .filter((s) => s.user_id !== userId)
      .forEach((s) => {
        const g = (byUser[s.user_id] = byUser[s.user_id] || { user: s.author, items: [], last: s.created_at, seen: true });
        g.items.push(s);
        g.last = s.created_at;
        if (!(s.status_views || []).some((v) => v.viewer_id === userId)) g.seen = false;
      });
    setOthers(Object.values(byUser).sort((a, b) => (a.seen - b.seen) || String(b.last).localeCompare(String(a.last))));
    setLoading(false);
  }, [userId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const postText = async () => {
    if (!text.trim()) return;
    setBusy(true);
    const { error } = await supabase.from('statuses').insert({ user_id: userId, type: 'text', text_content: text.trim(), background_color: bg });
    setBusy(false);
    if (error) return Alert.alert(t('error'), errText(error));
    setText('');
    setTextModal(false);
    load();
  };

  const postPhoto = async (camera) => {
    try {
      let res;
      if (camera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return;
        res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
      } else {
        res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.7, videoMaxDuration: 30 });
      }
      if (res.canceled || !res.assets || !res.assets[0]) return;
      const a = res.assets[0];
      const isVideo = a.type === 'video' || (a.mimeType || '').startsWith('video/');
      setBusy(true);
      const path = await uploadFile({ bucket: 'statuses', userId, uri: a.uri, mimeType: a.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'), fileName: a.fileName });
      const { error } = await supabase.from('statuses').insert({ user_id: userId, type: isVideo ? 'video' : 'image', media_path: path });
      if (error) throw error;
      load();
    } catch (e) {
      Alert.alert(t('error'), errText(e));
    }
    setBusy(false);
  };

  const myViews = mine.reduce((n, s) => n + (s.status_views || []).length, 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={others}
        keyExtractor={(g) => g.user ? g.user.id : String(g.last)}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
        ListHeaderComponent={
          <>
            <Row onPress={() => (mine.length ? navigation.navigate('StatusViewer', { items: mine, mine: true }) : setSheet(true))}>
              <View>
                <View style={{ borderWidth: mine.length ? 2.5 : 0, borderColor: colors.brand, borderRadius: 30, padding: 2 }}>
                  <Avatar uri={avatarUri(profile)} name={profile && profile.display_name} size={50} />
                </View>
                <Pressable onPress={() => setSheet(true)} style={{ position: 'absolute', right: -2, bottom: -2, backgroundColor: colors.brand, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg }}>
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14, lineHeight: 16 }}>+</Text>
                </Pressable>
              </View>
              <View style={{ marginLeft: 14, flex: 1 }}>
                <Title>{L('Mon statut', 'My status')}</Title>
                <Muted>
                  {mine.length
                    ? `${mine.length} ${L('publication(s)', 'update(s)')} · 👁 ${myViews}`
                    : L('Appuyez pour publier une mise à jour', 'Tap to add a status update')}
                </Muted>
              </View>
            </Row>
            <SectionTitle>{L('Mises à jour récentes', 'Recent updates')}</SectionTitle>
          </>
        }
        ListEmptyComponent={
          !loading ? (
            <Muted style={{ padding: 16 }}>
              {L(
                "Aucun statut pour l'instant. Les statuts de vos contacts inscrits sur Unichat + apparaîtront ici pendant 24 heures.",
                'No updates yet. Your contacts’ statuses appear here for 24 hours.'
              )}
            </Muted>
          ) : null
        }
        renderItem={({ item: g }) => (
          <Row onPress={() => navigation.navigate('StatusViewer', { items: g.items, mine: false })}>
            <View style={{ borderWidth: 2.5, borderColor: g.seen ? colors.border : colors.brand, borderRadius: 30, padding: 2 }}>
              <Avatar uri={avatarUri(g.user)} name={g.user && g.user.display_name} size={50} />
            </View>
            <View style={{ marginLeft: 14, flex: 1 }}>
              <Title>{g.user ? g.user.display_name : '?'}</Title>
              <Muted>{formatTime(g.last, t)}</Muted>
            </View>
          </Row>
        )}
      />

      <View style={{ position: 'absolute', right: 18, bottom: 18, alignItems: 'center', gap: 14 }}>
        <Pressable onPress={() => setTextModal(true)} style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: colors.bgAlt, alignItems: 'center', justifyContent: 'center', elevation: 3 }}>
          <Text style={{ fontSize: 20 }}>✏️</Text>
        </Pressable>
        <Pressable onPress={() => postPhoto(true)} disabled={busy} style={{ width: 58, height: 58, borderRadius: 18, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', elevation: 4, opacity: busy ? 0.6 : 1 }}>
          <Text style={{ fontSize: 24 }}>📷</Text>
        </Pressable>
      </View>

      <ActionSheet
        visible={sheet}
        title={L('Nouveau statut', 'New status')}
        actions={[
          { label: '✏️  ' + L('Texte', 'Text'), onPress: () => setTextModal(true) },
          { label: '📷  ' + L('Prendre une photo', 'Take a photo'), onPress: () => postPhoto(true) },
          { label: '🖼  ' + L('Photo ou vidéo de la galerie', 'Photo or video from gallery'), onPress: () => postPhoto(false) },
        ]}
        onClose={() => setSheet(false)}
      />

      <Modal visible={textModal} animationType="slide" onRequestClose={() => setTextModal(false)}>
        <View style={{ flex: 1, backgroundColor: bg, padding: 20, justifyContent: 'center' }}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={L('Écrivez un statut', 'Type a status')}
            placeholderTextColor="rgba(255,255,255,0.7)"
            multiline
            autoFocus
            maxLength={700}
            style={{ color: '#fff', fontSize: 28, textAlign: 'center', fontWeight: '600' }}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 30 }}>
            {BG.map((c) => (
              <Pressable key={c} onPress={() => setBg(c)} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c, borderWidth: c === bg ? 3 : 1, borderColor: '#fff' }} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 30 }}>
            <Button title={t('cancel')} variant="ghost" onPress={() => setTextModal(false)} style={{ flex: 1, borderColor: '#fff' }} />
            <Button title={L('Publier', 'Post')} onPress={postText} loading={busy} disabled={!text.trim()} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
