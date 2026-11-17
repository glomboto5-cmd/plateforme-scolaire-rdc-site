import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { L } from '../lib/i18n';
import { useApp } from '../AppContext';
import { Avatar, Muted, Row, SectionTitle, Title } from '../components/ui';
import AdCard from '../components/AdCard';
import { ChannelRow } from './ChannelsScreen';
import { fetchAds, publicUrl } from '../lib/ads';
import { avatarUri } from '../lib/chat';

// Découvrir : chaînes, entreprises, produits — avec publicités et résultats sponsorisés pertinents
export default function DiscoverScreen({ navigation }) {
  const { colors, userId } = useApp();
  const [q, setQ] = useState('');
  const [channels, setChannels] = useState([]);
  const [shops, setShops] = useState([]);
  const [products, setProducts] = useState([]);
  const [people, setPeople] = useState([]);
  const [ads, setAds] = useState([]);
  const [searchAds, setSearchAds] = useState([]);
  const timer = useRef(null);

  const loadHome = useCallback(async () => {
    const [{ data: ch }, { data: biz }, { data: prod }, adList] = await Promise.all([
      supabase.from('channels').select('*').order('followers_count', { ascending: false }).limit(10),
      supabase.from('profiles').select('id,display_name,business_name,business_category,avatar_url').eq('is_business', true).neq('id', userId).limit(12),
      supabase.from('products').select('id,name,price,currency,image_paths,seller_id').eq('is_available', true).eq('is_hidden', false).order('created_at', { ascending: false }).limit(12),
      fetchAds('discover', null, 2),
    ]);
    setChannels(ch || []); setShops(biz || []); setProducts(prod || []); setAds(adList); setPeople([]); setSearchAds([]);
  }, [userId]);

  const search = useCallback(async (text) => {
    const s = text.trim().replace(/[%,()]/g, ' ');
    if (s.length < 2) return loadHome();
    const like = '%' + s + '%';
    const [{ data: ch }, { data: biz }, { data: prod }, { data: ppl }, adList] = await Promise.all([
      supabase.from('channels').select('*').or(`name.ilike.${like},description.ilike.${like},category.ilike.${like}`).limit(15),
      supabase.from('profiles').select('id,display_name,business_name,business_category,avatar_url').eq('is_business', true).or(`business_name.ilike.${like},business_category.ilike.${like},display_name.ilike.${like}`).limit(15),
      supabase.from('products').select('id,name,price,currency,image_paths,seller_id').eq('is_available', true).eq('is_hidden', false).ilike('name', like).limit(15),
      supabase.from('profiles').select('id,display_name,handle,avatar_url').or(`handle.ilike.${like},display_name.ilike.${like}`).neq('id', userId).limit(10),
      fetchAds('search', s, 2),
    ]);
    setChannels(ch || []); setShops(biz || []); setProducts(prod || []); setPeople(ppl || []); setSearchAds(adList); setAds([]);
  }, [userId, loadHome]);

  useEffect(() => { loadHome(); }, [loadHome]);
  const onChange = (v) => { setQ(v); clearTimeout(timer.current); timer.current = setTimeout(() => search(v), 400); };

  const searching = q.trim().length >= 2;
  const openPerson = async (p) => {
    const { data } = await supabase.rpc('get_or_create_direct_conversation', { p_other: p.id });
    if (data) navigation.navigate('Chat', { id: data });
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} keyboardShouldPersistTaps="handled">
      <View style={{ padding: 12 }}>
        <TextInput
          value={q}
          onChangeText={onChange}
          placeholder={L('Rechercher chaînes, entreprises, produits, personnes', 'Search channels, businesses, products, people')}
          placeholderTextColor={colors.textMuted}
          style={{ backgroundColor: colors.bgAlt, color: colors.text, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 11, fontSize: 16 }}
        />
      </View>

      {searching && searchAds.map((ad) => <AdCard key={ad.id} ad={ad} placement="search" navigation={navigation} compact />)}
      {!searching && ads[0] ? <AdCard ad={ads[0]} placement="discover" navigation={navigation} /> : null}

      {channels.length ? <SectionTitle>{L('Chaînes', 'Channels')}</SectionTitle> : null}
      {channels.map((c) => <ChannelRow key={c.id} c={c} onPress={() => navigation.navigate('Channel', { id: c.id })} />)}

      {shops.length ? <SectionTitle>{L('Entreprises et commerces', 'Businesses')}</SectionTitle> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 12 }}>
        {shops.map((s) => (
          <Pressable key={s.id} onPress={() => navigation.navigate('SellerShop', { sellerId: s.id })} style={{ width: 110, alignItems: 'center' }}>
            <Avatar uri={avatarUri(s)} name={s.business_name || s.display_name} size={64} />
            <Text style={{ color: colors.text, fontWeight: '600', marginTop: 6, textAlign: 'center' }} numberOfLines={2}>{s.business_name || s.display_name}</Text>
            {s.business_category ? <Muted style={{ fontSize: 12 }}>{s.business_category}</Muted> : null}
          </Pressable>
        ))}
      </ScrollView>

      {products.length ? <SectionTitle>{L('Produits', 'Products')}</SectionTitle> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 12 }}>
        {products.map((p) => (
          <Pressable key={p.id} onPress={() => navigation.navigate('SellerShop', { sellerId: p.seller_id, productId: p.id })} style={{ width: 140 }}>
            <View style={{ width: 140, height: 140, borderRadius: 12, backgroundColor: colors.bgAlt, overflow: 'hidden' }}>
              {p.image_paths && p.image_paths[0] ? <Image source={{ uri: publicUrl('products', p.image_paths[0]) }} style={{ width: '100%', height: '100%' }} /> : null}
            </View>
            <Text style={{ color: colors.text, marginTop: 6 }} numberOfLines={1}>{p.name}</Text>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{p.price} {p.currency}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {people.length ? <SectionTitle>{L('Personnes', 'People')}</SectionTitle> : null}
      {people.map((p) => (
        <Row key={p.id} onPress={() => openPerson(p)}>
          <Avatar uri={avatarUri(p)} name={p.display_name} size={44} />
          <View style={{ marginLeft: 12 }}>
            <Title>{p.display_name}</Title>
            {p.handle ? <Muted>@{p.handle}</Muted> : null}
          </View>
        </Row>
      ))}

      {!searching && ads[1] ? <AdCard ad={ads[1]} placement="discover" navigation={navigation} /> : null}
      {searching && !channels.length && !shops.length && !products.length && !people.length ? (
        <Muted style={{ padding: 20, textAlign: 'center' }}>{L('Aucun résultat.', 'No results.')}</Muted>
      ) : null}
      <View style={{ height: 30 }} />
    </ScrollView>
  );
}
