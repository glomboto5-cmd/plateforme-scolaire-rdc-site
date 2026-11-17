import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, RefreshControl, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase, errText } from '../lib/supabase';
import { L, t } from '../lib/i18n';
import { useApp } from '../AppContext';
import { Avatar, Button, Input, Muted, Row, SectionTitle, Title } from '../components/ui';
import AdCard from '../components/AdCard';
import { fetchAds, publicUrl } from '../lib/ads';

export const CHANNEL_CATEGORIES = ['Actualités', 'Divertissement', 'Sport', 'Business', 'Éducation', 'Technologie', 'Mode', 'Cuisine', 'Musique', 'Autre'];

export function ChannelRow({ c, onPress, right }) {
  return (
    <Row onPress={onPress}>
      <Avatar uri={publicUrl('channels', c.avatar_path)} name={c.name} size={50} />
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Title numberOfLines={1}>{c.name}</Title>
        <Muted>{(c.followers_count || 0) + ' ' + L('abonné(s)', 'follower(s)')}{c.category ? ' · ' + c.category : ''}</Muted>
      </View>
      {right}
    </Row>
  );
}

export default function ChannelsScreen({ navigation }) {
  const { colors, userId, profile } = useApp();
  const [mine, setMine] = useState([]);
  const [followed, setFollowed] = useState([]);
  const [suggested, setSuggested] = useState([]);
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [create, setCreate] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [cat, setCat] = useState('Actualités');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [{ data: own }, { data: fol }, { data: top }, adList] = await Promise.all([
      supabase.from('channels').select('*').eq('owner_id', userId).order('created_at'),
      supabase.from('channel_followers').select('channel:channels(*)').eq('user_id', userId),
      supabase.from('channels').select('*').order('followers_count', { ascending: false }).limit(30),
      fetchAds('channel', null, 1),
    ]);
    const f = (fol || []).map((x) => x.channel).filter(Boolean);
    const known = new Set([...(own || []).map((c) => c.id), ...f.map((c) => c.id)]);
    setMine(own || []);
    setFollowed(f);
    setSuggested((top || []).filter((c) => !known.has(c.id)));
    setAds(adList);
    setLoading(false);
  }, [userId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const follow = async (c) => {
    const { error } = await supabase.from('channel_followers').insert({ channel_id: c.id, user_id: userId });
    if (error) return Alert.alert(t('error'), errText(error));
    load();
  };

  const createChannel = async () => {
    if (name.trim().length < 2) return;
    setBusy(true);
    const { data, error } = await supabase.from('channels').insert({ owner_id: userId, name: name.trim(), description: desc.trim(), category: cat, country_code: profile && profile.country_code }).select('id').single();
    setBusy(false);
    if (error) return Alert.alert(t('error'), errText(error));
    setCreate(false); setName(''); setDesc('');
    navigation.navigate('Channel', { id: data.id });
  };

  const sections = [
    { key: 'h-mine', type: 'title', title: L('Mes chaînes', 'My channels') },
    ...mine.map((c) => ({ key: 'm' + c.id, type: 'channel', c })),
    { key: 'create', type: 'create' },
    { key: 'h-fol', type: 'title', title: L('Chaînes suivies', 'Following') },
    ...(followed.length ? followed.map((c) => ({ key: 'f' + c.id, type: 'channel', c })) : [{ key: 'nofol', type: 'empty', text: L('Vous ne suivez encore aucune chaîne.', 'Not following any channel yet.') }]),
    ...(ads[0] ? [{ key: 'ad', type: 'ad', ad: ads[0] }] : []),
    { key: 'h-sug', type: 'title', title: L('Trouver des chaînes', 'Find channels') },
    ...suggested.map((c) => ({ key: 's' + c.id, type: 'suggest', c })),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={sections}
        keyExtractor={(x) => x.key}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
        renderItem={({ item }) => {
          if (item.type === 'title') return <SectionTitle>{item.title}</SectionTitle>;
          if (item.type === 'empty') return <Muted style={{ paddingHorizontal: 16 }}>{item.text}</Muted>;
          if (item.type === 'ad') return <AdCard ad={item.ad} placement="channel" navigation={navigation} compact />;
          if (item.type === 'create')
            return (
              <Row onPress={() => setCreate(true)}>
                <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 26 }}>+</Text>
                </View>
                <Title style={{ marginLeft: 14 }}>{L('Créer une chaîne', 'Create channel')}</Title>
              </Row>
            );
          const c = item.c;
          return (
            <ChannelRow
              c={c}
              onPress={() => navigation.navigate('Channel', { id: c.id })}
              right={item.type === 'suggest' ? (
                <Pressable onPress={() => follow(c)} style={{ backgroundColor: colors.chipActiveBg, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7 }}>
                  <Text style={{ color: colors.chipActiveText, fontWeight: '700' }}>{L('Suivre', 'Follow')}</Text>
                </Pressable>
              ) : null}
            />
          );
        }}
      />

      <Modal visible={create} animationType="slide" transparent onRequestClose={() => setCreate(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.card, padding: 18, borderTopLeftRadius: 18, borderTopRightRadius: 18, gap: 12 }}>
            <Title style={{ fontSize: 18 }}>{L('Nouvelle chaîne', 'New channel')}</Title>
            <Muted>{L('Une chaîne diffuse vos publications à tous ses abonnés. Votre numéro reste privé.', 'A channel broadcasts your posts to followers. Your number stays private.')}</Muted>
            <Input value={name} onChangeText={setName} placeholder={L('Nom de la chaîne', 'Channel name')} maxLength={80} />
            <Input value={desc} onChangeText={setDesc} placeholder={L('Description', 'Description')} multiline maxLength={500} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {CHANNEL_CATEGORIES.map((x) => (
                <Pressable key={x} onPress={() => setCat(x)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: cat === x ? colors.chipActiveBg : colors.bgAlt }}>
                  <Text style={{ color: cat === x ? colors.chipActiveText : colors.text }}>{x}</Text>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title={t('cancel')} variant="ghost" onPress={() => setCreate(false)} style={{ flex: 1 }} />
              <Button title={L('Créer', 'Create')} onPress={createChannel} loading={busy} disabled={name.trim().length < 2} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
