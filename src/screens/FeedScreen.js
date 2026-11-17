import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { L } from '../lib/i18n';
import { useApp } from '../AppContext';
import { Muted } from '../components/ui';
import AdCard from '../components/AdCard';
import { PostCard } from './ChannelScreen';
import { fetchAds, interleave } from '../lib/ads';

// Fil d'actualité : publications des chaînes suivies (ou populaires) + publications sponsorisées
export default function FeedScreen({ navigation }) {
  const { colors, userId } = useApp();
  const [posts, setPosts] = useState([]);
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [popular, setPopular] = useState(false);

  const load = useCallback(async () => {
    const { data: fol } = await supabase.from('channel_followers').select('channel_id').eq('user_id', userId);
    const { data: own } = await supabase.from('channels').select('id').eq('owner_id', userId);
    const ids = [...(fol || []).map((x) => x.channel_id), ...(own || []).map((x) => x.id)];
    let q = supabase.from('channel_posts').select('*, channel:channels(id,name,avatar_path)').order('created_at', { ascending: false }).limit(80);
    if (ids.length) q = q.in('channel_id', ids);
    const [{ data }, adList] = await Promise.all([q, fetchAds('feed', null, 4)]);
    setPopular(!ids.length);
    setPosts(data || []);
    setAds(adList);
    setLoading(false);
  }, [userId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const rows = interleave(posts, ads, 3);

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bgAlt }}
      data={rows}
      keyExtractor={(x) => x.key}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
      ListHeaderComponent={
        popular ? (
          <Pressable onPress={() => navigation.navigate('Channels')} style={{ margin: 12, padding: 14, borderRadius: 14, backgroundColor: colors.chipActiveBg }}>
            <Text style={{ color: colors.chipActiveText }}>{L('Suivez des chaînes pour personnaliser votre fil. En attendant, voici les dernières publications. Toucher pour trouver des chaînes →', 'Follow channels to personalize your feed →')}</Text>
          </Pressable>
        ) : null
      }
      ListEmptyComponent={!loading ? <Muted style={{ padding: 20, textAlign: 'center' }}>{L("Rien à afficher pour l'instant.", 'Nothing yet.')}</Muted> : null}
      renderItem={({ item }) =>
        item.type === 'ad' ? (
          <AdCard ad={item.ad} placement="feed" navigation={navigation} />
        ) : (
          <PostCard post={item.item} channel={item.item.channel} onChannel={() => navigation.navigate('Channel', { id: item.item.channel_id })} />
        )
      }
    />
  );
}
