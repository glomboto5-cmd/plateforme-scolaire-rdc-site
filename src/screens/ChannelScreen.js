import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Alert, FlatList, Image, Linking, Pressable, RefreshControl, Share, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase, errText } from '../lib/supabase';
import { L, t } from '../lib/i18n';
import { useApp } from '../AppContext';
import { Avatar, Muted } from '../components/ui';
import AdCard from '../components/AdCard';
import { fetchAds, interleave, publicUrl } from '../lib/ads';
import { uploadFile } from '../lib/upload';
import { formatTime } from '../lib/chat';

export function PostCard({ post, channel, onChannel, onDelete }) {
  const { colors } = useApp();
  const media = publicUrl('channels', post.media_path);
  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 16, marginHorizontal: 12, marginVertical: 6, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
      {channel ? (
        <Pressable onPress={onChannel} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, paddingBottom: 6 }}>
          <Avatar uri={publicUrl('channels', channel.avatar_path)} name={channel.name} size={32} />
          <Text style={{ color: colors.text, fontWeight: '700', marginLeft: 10, flex: 1 }} numberOfLines={1}>{channel.name}</Text>
        </Pressable>
      ) : null}
      {media ? (
        post.media_type === 'video' ? (
          <Pressable onPress={() => Linking.openURL(media)} style={{ height: 200, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 18 }}>▶ {L('Lire la vidéo', 'Play video')}</Text>
          </Pressable>
        ) : (
          <Image source={{ uri: media }} style={{ width: '100%', aspectRatio: 1.3 }} resizeMode="cover" />
        )
      ) : null}
      {post.body ? <Text style={{ color: colors.text, fontSize: 16, padding: 12, paddingBottom: 4 }}>{post.body}</Text> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, paddingTop: 6 }}>
        <Muted style={{ flex: 1, fontSize: 12 }}>{formatTime(post.created_at, t)}</Muted>
        <Pressable onPress={() => Share.share({ message: (channel ? channel.name + ' — ' : '') + (post.body || '') + '\n\nAnge chat +' })} hitSlop={8} style={{ paddingHorizontal: 8 }}>
          <Text style={{ fontSize: 16 }}>↗️</Text>
        </Pressable>
        {onDelete ? (
          <Pressable onPress={onDelete} hitSlop={8} style={{ paddingHorizontal: 8 }}>
            <Text style={{ fontSize: 16 }}>🗑</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default function ChannelScreen({ route, navigation }) {
  const { id } = route.params;
  const { colors, userId } = useApp();
  const [ch, setCh] = useState(null);
  const [posts, setPosts] = useState([]);
  const [ads, setAds] = useState([]);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const isOwner = ch && ch.owner_id === userId;

  const load = useCallback(async () => {
    const [{ data: c }, { data: p }, { data: f }, adList] = await Promise.all([
      supabase.from('channels').select('*').eq('id', id).maybeSingle(),
      supabase.from('channel_posts').select('*').eq('channel_id', id).order('created_at', { ascending: false }).limit(100),
      supabase.from('channel_followers').select('user_id').eq('channel_id', id).eq('user_id', userId),
      fetchAds('channel', null, 3),
    ]);
    setCh(c); setPosts(p || []); setFollowing(!!(f && f.length)); setAds(adList); setLoading(false);
  }, [id, userId]);
  useEffect(() => { load(); }, [load]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: ch ? ch.name : L('Chaîne', 'Channel') });
  }, [ch, navigation]);

  const toggleFollow = async () => {
    if (following) await supabase.from('channel_followers').delete().eq('channel_id', id).eq('user_id', userId);
    else await supabase.from('channel_followers').insert({ channel_id: id, user_id: userId });
    load();
  };

  const publish = async (withMedia) => {
    try {
      let media_path = null;
      let media_type = null;
      if (withMedia) {
        const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.7, videoMaxDuration: 60 });
        if (res.canceled || !res.assets || !res.assets[0]) return;
        const a = res.assets[0];
        const isVideo = a.type === 'video' || (a.mimeType || '').startsWith('video/');
        setBusy(true);
        media_path = await uploadFile({ bucket: 'channels', userId, uri: a.uri, mimeType: a.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'), fileName: a.fileName });
        media_type = isVideo ? 'video' : 'image';
      } else if (!text.trim()) return;
      setBusy(true);
      const { error } = await supabase.from('channel_posts').insert({ channel_id: id, author_id: userId, body: text.trim(), media_path, media_type });
      if (error) throw error;
      setText('');
      load();
    } catch (e) {
      Alert.alert(t('error'), errText(e));
    }
    setBusy(false);
  };

  const changeAvatar = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
    if (res.canceled || !res.assets || !res.assets[0]) return;
    const a = res.assets[0];
    try {
      const path = await uploadFile({ bucket: 'channels', userId, uri: a.uri, mimeType: a.mimeType || 'image/jpeg', fileName: a.fileName });
      await supabase.from('channels').update({ avatar_path: path }).eq('id', id);
      load();
    } catch (e) { Alert.alert(t('error'), errText(e)); }
  };

  const del = (p) =>
    Alert.alert(L('Supprimer la publication ?', 'Delete post?'), '', [
      { text: t('cancel'), style: 'cancel' },
      { text: L('Supprimer', 'Delete'), style: 'destructive', onPress: async () => { await supabase.from('channel_posts').delete().eq('id', p.id); load(); } },
    ]);

  const rows = interleave(posts, ads, 4);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgAlt }}>
      <FlatList
        data={rows}
        keyExtractor={(x) => x.key}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
        ListHeaderComponent={
          ch ? (
            <View style={{ alignItems: 'center', padding: 20, backgroundColor: colors.bg, marginBottom: 6 }}>
              <Pressable onPress={isOwner ? changeAvatar : undefined}>
                <Avatar uri={publicUrl('channels', ch.avatar_path)} name={ch.name} size={90} />
              </Pressable>
              <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700', marginTop: 10, textAlign: 'center' }}>{ch.name}</Text>
              <Muted>{L('Chaîne', 'Channel')} · {ch.followers_count} {L('abonné(s)', 'follower(s)')}{ch.category ? ' · ' + ch.category : ''}</Muted>
              {ch.description ? <Text style={{ color: colors.text, marginTop: 8, textAlign: 'center' }}>{ch.description}</Text> : null}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                {!isOwner ? (
                  <Pressable onPress={toggleFollow} style={{ backgroundColor: following ? colors.bgAlt : colors.brand, borderRadius: 20, paddingHorizontal: 22, paddingVertical: 10 }}>
                    <Text style={{ color: following ? colors.text : '#fff', fontWeight: '700' }}>{following ? L('Abonné ✓', 'Following ✓') : L('Suivre', 'Follow')}</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => Share.share({ message: L('Suivez la chaîne « ', 'Follow the channel “') + ch.name + L(' » sur Ange chat +', '” on Ange chat +') })} style={{ backgroundColor: colors.bgAlt, borderRadius: 20, paddingHorizontal: 22, paddingVertical: 10 }}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>↗️ {L('Partager', 'Share')}</Text>
                </Pressable>
              </View>
            </View>
          ) : null
        }
        ListEmptyComponent={!loading ? <Muted style={{ padding: 20, textAlign: 'center' }}>{L('Aucune publication pour le moment.', 'No posts yet.')}</Muted> : null}
        renderItem={({ item }) =>
          item.type === 'ad' ? (
            <AdCard ad={item.ad} placement="channel" navigation={navigation} />
          ) : (
            <PostCard post={item.item} onDelete={isOwner ? () => del(item.item) : null} />
          )
        }
      />
      {isOwner ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', padding: 8, gap: 8, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Pressable onPress={() => publish(true)} disabled={busy} style={{ padding: 10 }}>
            <Text style={{ fontSize: 22 }}>🖼</Text>
          </Pressable>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={L('Publier dans la chaîne…', 'Post to channel…')}
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={4000}
            style={{ flex: 1, color: colors.text, backgroundColor: colors.bgAlt, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, maxHeight: 120 }}
          />
          <Pressable onPress={() => publish(false)} disabled={busy || !text.trim()} style={{ backgroundColor: colors.brand, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', opacity: busy || !text.trim() ? 0.5 : 1 }}>
            <Text style={{ color: '#fff', fontSize: 18 }}>➤</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
