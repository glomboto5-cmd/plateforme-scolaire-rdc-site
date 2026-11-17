import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { L, t } from '../lib/i18n';
import { useApp } from '../AppContext';
import { Avatar } from '../components/ui';
import { avatarUri, formatTime } from '../lib/chat';
import { signedUrl } from '../lib/upload';

const DURATION = 6000;

export default function StatusViewerScreen({ route, navigation }) {
  const { items, mine } = route.params;
  const { userId } = useApp();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [url, setUrl] = useState(null);
  const [viewers, setViewers] = useState(null);
  const timer = useRef(null);
  const s = items[index];

  useEffect(() => {
    if (!s) return navigation.goBack();
    setUrl(null);
    setViewers(null);
    if (s.media_path) signedUrl('statuses', s.media_path).then(setUrl);
    if (!mine && s.user_id !== userId) {
      supabase.from('status_views').upsert({ status_id: s.id, viewer_id: userId }, { onConflict: 'status_id,viewer_id', ignoreDuplicates: true }).then(() => {});
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(next, DURATION);
    return () => clearTimeout(timer.current);
  }, [index]);

  const next = () => (index + 1 < items.length ? setIndex(index + 1) : navigation.goBack());
  const prev = () => (index > 0 ? setIndex(index - 1) : null);

  const showViewers = async () => {
    clearTimeout(timer.current);
    const { data } = await supabase
      .from('status_views')
      .select('viewed_at, viewer:profiles!status_views_viewer_id_fkey(display_name)')
      .eq('status_id', s.id)
      .order('viewed_at', { ascending: false });
    setViewers(data || []);
  };

  const remove = () =>
    Alert.alert(L('Supprimer ce statut ?', 'Delete this status?'), '', [
      { text: t('cancel'), style: 'cancel' },
      {
        text: L('Supprimer', 'Delete'),
        style: 'destructive',
        onPress: async () => {
          await supabase.from('statuses').delete().eq('id', s.id);
          navigation.goBack();
        },
      },
    ]);

  if (!s) return null;
  const author = s.author || {};

  return (
    <View style={{ flex: 1, backgroundColor: s.type === 'text' ? s.background_color || '#0E7C66' : '#000' }}>
      <View style={{ flexDirection: 'row', gap: 4, paddingTop: insets.top + 8, paddingHorizontal: 8 }}>
        {items.map((_, i) => (
          <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= index ? '#fff' : 'rgba(255,255,255,0.35)' }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
        <Pressable onPress={() => navigation.goBack()} style={{ paddingRight: 10 }}>
          <Text style={{ color: '#fff', fontSize: 24 }}>←</Text>
        </Pressable>
        <Avatar uri={avatarUri(author)} name={author.display_name} size={36} />
        <View style={{ marginLeft: 10, flex: 1 }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>{mine ? L('Mon statut', 'My status') : author.display_name}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>{formatTime(s.created_at, t)}</Text>
        </View>
        {mine ? (
          <Pressable onPress={remove} style={{ padding: 6 }}>
            <Text style={{ fontSize: 20 }}>🗑</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        {s.type === 'text' ? (
          <Text style={{ color: '#fff', fontSize: 28, fontWeight: '600', textAlign: 'center', padding: 24 }}>{s.text_content}</Text>
        ) : s.type === 'image' ? (
          url ? <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : null
        ) : (
          <Pressable onPress={() => url && require('react-native').Linking.openURL(url)}>
            <Text style={{ color: '#fff', fontSize: 18 }}>▶ {L('Lire la vidéo', 'Play video')}</Text>
          </Pressable>
        )}
        {s.caption ? <Text style={{ color: '#fff', position: 'absolute', bottom: 30, paddingHorizontal: 20, textAlign: 'center' }}>{s.caption}</Text> : null}
      </View>

      <Pressable onPress={prev} style={{ position: 'absolute', left: 0, top: 120, bottom: 120, width: '30%' }} />
      <Pressable onPress={next} style={{ position: 'absolute', right: 0, top: 120, bottom: 120, width: '70%' }} />

      {mine ? (
        <Pressable onPress={showViewers} style={{ alignItems: 'center', paddingBottom: insets.bottom + 16, paddingTop: 10 }}>
          <Text style={{ color: '#fff', fontSize: 15 }}>👁 {(s.status_views || []).length} {L('vue(s)', 'view(s)')}</Text>
        </Pressable>
      ) : null}

      {viewers ? (
        <Pressable onPress={() => { setViewers(null); timer.current = setTimeout(next, DURATION); }} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, paddingBottom: insets.bottom + 18, maxHeight: '60%' }}>
            <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 10 }}>{L('Vu par', 'Viewed by')} ({viewers.length})</Text>
            {viewers.length === 0 ? <Text style={{ color: '#667781' }}>{L('Personne pour le moment', 'No views yet')}</Text> : null}
            {viewers.map((v, i) => (
              <Text key={i} style={{ paddingVertical: 6, fontSize: 15 }}>
                {v.viewer ? v.viewer.display_name : '?'} · <Text style={{ color: '#667781' }}>{formatTime(v.viewed_at, t)}</Text>
              </Text>
            ))}
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}
