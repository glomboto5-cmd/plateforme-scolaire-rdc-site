import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Image, Pressable, Text, View } from 'react-native';
import { supabase, errText } from '../lib/supabase';
import { L, t } from '../lib/i18n';
import { useApp } from '../AppContext';
import { Avatar, Button, Muted, Title } from '../components/ui';
import { avatarUri } from '../lib/chat';
import { addToCart, money, productImage } from '../lib/shop';
import { ProductCard } from './ShopScreen';

export default function SellerShopScreen({ route, navigation }) {
  const { sellerId, productId } = route.params;
  const { colors, userId } = useApp();
  const [seller, setSeller] = useState(null);
  const [products, setProducts] = useState([]);
  const [focus, setFocus] = useState(null);

  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: p }] = await Promise.all([
        supabase.from('profiles').select('id,display_name,business_name,business_description,business_address,avatar_url,about').eq('id', sellerId).maybeSingle(),
        supabase.from('products').select('*').eq('seller_id', sellerId).eq('is_hidden', false).order('created_at', { ascending: false }),
      ]);
      setSeller(s);
      setProducts(p || []);
      if (productId) setFocus((p || []).find((x) => x.id === productId) || null);
      navigation.setOptions({ title: s ? s.business_name || s.display_name : L('Boutique', 'Shop') });
    })();
  }, [sellerId]);

  const add = async (p) => {
    try {
      const cartId = await addToCart(userId, p, 1);
      Alert.alert('🛒', L('Ajouté au panier', 'Added to cart'), [
        { text: L('Continuer mes achats', 'Keep shopping') },
        { text: L('Voir le panier', 'View cart'), onPress: () => navigation.navigate('Order', { id: cartId }) },
      ]);
    } catch (e) {
      Alert.alert(t('error'), errText(e));
    }
  };

  const contact = async () => {
    const { data, error } = await supabase.rpc('get_or_create_direct_conversation', { p_other: sellerId });
    if (error) return Alert.alert(t('error'), errText(error));
    navigation.navigate('Chat', { id: data });
  };

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      data={products}
      keyExtractor={(p) => p.id}
      ListHeaderComponent={
        <>
          {seller ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}>
              <Avatar uri={avatarUri(seller)} name={seller.business_name || seller.display_name} size={60} />
              <View style={{ flex: 1 }}>
                <Title style={{ fontSize: 18 }}>{seller.business_name || seller.display_name}</Title>
                {seller.business_description || seller.about ? <Muted>{seller.business_description || seller.about}</Muted> : null}
                {seller.business_address ? <Muted>📍 {seller.business_address}</Muted> : null}
              </View>
            </View>
          ) : null}
          {sellerId !== userId ? <Button title={'💬 ' + L('Écrire au vendeur', 'Message seller')} variant="ghost" onPress={contact} style={{ marginHorizontal: 16, marginBottom: 8 }} /> : null}
          {focus ? (
            <View style={{ margin: 12, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.bgAlt }}>
              {productImage(focus) ? <Image source={{ uri: productImage(focus) }} style={{ width: '100%', aspectRatio: 1 }} /> : null}
              <View style={{ padding: 14, gap: 6 }}>
                <Title style={{ fontSize: 20 }}>{focus.name}</Title>
                <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 18 }}>{money(focus.price, focus.currency)}</Text>
                {focus.description ? <Text style={{ color: colors.text }}>{focus.description}</Text> : null}
                {focus.is_available && sellerId !== userId ? <Button title={'🛒 ' + L('Ajouter au panier', 'Add to cart')} onPress={() => add(focus)} /> : null}
              </View>
            </View>
          ) : null}
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6, textTransform: 'uppercase' }}>
            {L('Catalogue', 'Catalog')} ({products.length})
          </Text>
        </>
      }
      renderItem={({ item }) => (
        <ProductCard
          p={item}
          colors={colors}
          onPress={() => setFocus(item)}
          right={
            item.is_available && sellerId !== userId ? (
              <Pressable onPress={() => add(item)} style={{ alignSelf: 'center', backgroundColor: colors.brand, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, marginLeft: 8 }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>🛒 +</Text>
              </Pressable>
            ) : null
          }
        />
      )}
    />
  );
}
