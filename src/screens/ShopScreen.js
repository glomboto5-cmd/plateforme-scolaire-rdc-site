import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Image, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase, errText } from '../lib/supabase';
import { L, t } from '../lib/i18n';
import { useApp } from '../AppContext';
import { Avatar, Muted, Title } from '../components/ui';
import { avatarUri, formatTime } from '../lib/chat';
import { addToCart, money, productImage, statusLabel } from '../lib/shop';

const SELLER = 'seller:profiles!products_seller_id_fkey(id,display_name,business_name,avatar_url)';

function Segments({ value, onChange, colors, items }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 10 }}>
      {items.map(([k, label]) => (
        <Pressable
          key={k}
          onPress={() => onChange(k)}
          style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: value === k ? colors.chipActiveBg : colors.bgAlt }}
        >
          <Text style={{ color: value === k ? colors.chipActiveText : colors.textMuted, fontWeight: '600' }}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function ProductCard({ p, colors, onPress, right }) {
  const img = productImage(p);
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', padding: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border, backgroundColor: colors.bg }}>
      {img ? (
        <Image source={{ uri: img }} style={{ width: 72, height: 72, borderRadius: 10, backgroundColor: colors.bgAlt }} />
      ) : (
        <View style={{ width: 72, height: 72, borderRadius: 10, backgroundColor: colors.bgAlt, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 28 }}>{p.kind === 'service' ? '🛠' : '📦'}</Text>
        </View>
      )}
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Title numberOfLines={1}>{p.name}</Title>
        {p.description ? <Muted numberOfLines={2}>{p.description}</Muted> : null}
        <Text style={{ color: colors.primary, fontWeight: '800', marginTop: 4 }}>{money(p.price, p.currency)}</Text>
        {p.seller ? <Muted style={{ fontSize: 12 }}>🏪 {p.seller.business_name || p.seller.display_name}</Muted> : null}
        {!p.is_available ? <Text style={{ color: colors.danger, fontSize: 12 }}>{L('Indisponible', 'Unavailable')}</Text> : null}
      </View>
      {right}
    </Pressable>
  );
}

export default function ShopScreen({ navigation }) {
  const { colors, userId } = useApp();
  const [tab, setTab] = useState('market');
  const [products, setProducts] = useState([]);
  const [mine, setMine] = useState([]);
  const [orders, setOrders] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: p }, { data: m }, { data: o }] = await Promise.all([
      supabase.from('products').select('*, ' + SELLER).neq('seller_id', userId).eq('is_hidden', false).order('created_at', { ascending: false }).limit(200),
      supabase.from('products').select('*').eq('seller_id', userId).order('created_at', { ascending: false }),
      supabase
        .from('orders')
        .select('id,order_number,status,total,currency,buyer_id,seller_id,updated_at,buyer:profiles!orders_buyer_id_fkey(display_name,avatar_url),seller:profiles!orders_seller_id_fkey(display_name,business_name,avatar_url),order_items(id)')
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .order('updated_at', { ascending: false })
        .limit(200),
    ]);
    setProducts(p || []);
    setMine(m || []);
    // Le vendeur ne voit pas les paniers non envoyés
    setOrders((o || []).filter((x) => !(x.status === 'cart' && x.seller_id === userId)));
    setLoading(false);
  }, [userId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return products;
    return products.filter((p) =>
      [p.name, p.description, p.seller && p.seller.business_name, p.seller && p.seller.display_name].some((x) => String(x || '').toLowerCase().includes(s))
    );
  }, [products, q]);

  const add = async (p) => {
    try {
      await addToCart(userId, p, 1);
      Alert.alert('🛒', L('Ajouté au panier', 'Added to cart'), [
        { text: L('Continuer', 'Continue') },
        { text: L('Voir le panier', 'View cart'), onPress: () => { setTab('orders'); load(); } },
      ]);
    } catch (e) {
      Alert.alert(t('error'), errText(e));
    }
  };

  const carts = orders.filter((o) => o.status === 'cart');
  const purchases = orders.filter((o) => o.buyer_id === userId && o.status !== 'cart');
  const sales = orders.filter((o) => o.seller_id === userId);

  const OrderRow = ({ o, asSeller }) => {
    const other = asSeller ? o.buyer : o.seller;
    const name = other ? (asSeller ? other.display_name : other.business_name || other.display_name) : '?';
    const waiting = asSeller ? ['requested'].includes(o.status) : ['accepted', 'delivered'].includes(o.status);
    return (
      <Pressable onPress={() => navigation.navigate('Order', { id: o.id })} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
        <Avatar uri={avatarUri(other)} name={name} size={44} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Title numberOfLines={1}>{name}</Title>
          <Muted>
            {o.status === 'cart' ? `🛒 ${o.order_items.length} ${L('article(s)', 'item(s)')}` : o.order_number} · {statusLabel(o.status)}
          </Muted>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{money(o.total, o.currency)}</Text>
          <Muted style={{ fontSize: 12 }}>{formatTime(o.updated_at, t)}</Muted>
          {waiting ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand, marginTop: 4 }} /> : null}
        </View>
      </Pressable>
    );
  };

  const Section = ({ title }) => (
    <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6, textTransform: 'uppercase' }}>{title}</Text>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Segments
        value={tab}
        onChange={setTab}
        colors={colors}
        items={[
          ['market', L('Acheter', 'Shop')],
          ['mine', L('Mon catalogue', 'My catalog')],
          ['orders', L('Commandes', 'Orders') + (carts.length ? ` 🛒${carts.length}` : '')],
        ]}
      />

      {tab === 'market' && (
        <FlatList
          data={shown}
          keyExtractor={(p) => p.id}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
          ListHeaderComponent={
            <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder={L('Rechercher un produit, un service ou une boutique', 'Search products, services or shops')}
                placeholderTextColor={colors.textMuted}
                style={{ backgroundColor: colors.bgAlt, color: colors.text, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15 }}
              />
            </View>
          }
          ListEmptyComponent={!loading ? <Muted style={{ padding: 20, textAlign: 'center' }}>{L("Aucun produit pour l'instant. Les catalogues des vendeurs inscrits apparaîtront ici.", 'No products yet.')}</Muted> : null}
          renderItem={({ item }) => (
            <ProductCard
              p={item}
              colors={colors}
              onPress={() => navigation.navigate('SellerShop', { sellerId: item.seller_id, productId: item.id })}
              right={
                item.is_available ? (
                  <Pressable onPress={() => add(item)} style={{ alignSelf: 'center', backgroundColor: colors.brand, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, marginLeft: 8 }}>
                    <Text style={{ color: '#fff', fontWeight: '700' }}>🛒 +</Text>
                  </Pressable>
                ) : null
              }
            />
          )}
        />
      )}

      {tab === 'mine' && (
        <FlatList
          data={mine}
          keyExtractor={(p) => p.id}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
          ListHeaderComponent={
            <Pressable onPress={() => navigation.navigate('ProductEdit', {})} style={{ margin: 12, padding: 14, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.primary, alignItems: 'center' }}>
              <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 16 }}>＋ {L('Ajouter un produit ou un service', 'Add a product or service')}</Text>
            </Pressable>
          }
          ListEmptyComponent={!loading ? <Muted style={{ padding: 20, textAlign: 'center' }}>{L('Votre catalogue est vide. Ajoutez vos produits avec photo, prix et description.', 'Your catalog is empty.')}</Muted> : null}
          renderItem={({ item }) => <ProductCard p={item} colors={colors} onPress={() => navigation.navigate('ProductEdit', { id: item.id })} right={item.is_hidden ? <Text style={{ alignSelf: 'center' }}>🙈</Text> : null} />}
        />
      )}

      {tab === 'orders' && (
        <FlatList
          data={[]}
          renderItem={null}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
          ListHeaderComponent={
            <>
              {carts.length ? <Section title={L('Mes paniers', 'My carts')} /> : null}
              {carts.map((o) => <OrderRow key={o.id} o={o} />)}
              <Section title={L('Mes ventes', 'My sales')} />
              {sales.length ? sales.map((o) => <OrderRow key={o.id} o={o} asSeller />) : <Muted style={{ paddingHorizontal: 16 }}>{L('Aucune vente pour le moment', 'No sales yet')}</Muted>}
              <Section title={L('Mes achats', 'My purchases')} />
              {purchases.length ? purchases.map((o) => <OrderRow key={o.id} o={o} />) : <Muted style={{ paddingHorizontal: 16, paddingBottom: 30 }}>{L('Aucun achat pour le moment', 'No purchases yet')}</Muted>}
            </>
          }
        />
      )}
    </View>
  );
}
