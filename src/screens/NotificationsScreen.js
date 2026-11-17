import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { L, t } from '../lib/i18n';
import { useApp } from '../AppContext';
import { Muted, Title } from '../components/ui';
import { formatTime } from '../lib/chat';
import { statusLabel } from '../lib/shop';

const ICON = { order: '🛍️', payment: '💰', call: '📞', group_invitation: '✉️', message: '💬', delivery: '🚚', event: '📅', system: 'ℹ️' };

function describe(n) {
  const d = n.data || {};
  if (n.type === 'order') return L('Commande', 'Order') + ' ' + (n.title || '') + (d.status ? ' · ' + statusLabel(d.status) : '');
  if (n.type === 'payment') return L('Paiement', 'Payment') + ' ' + (n.title || '') + (d.status === 'confirmed' ? ' · ' + L('confirmé', 'confirmed') : '');
  return n.title || n.type;
}

export default function NotificationsScreen({ navigation }) {
  const { colors, userId } = useApp();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(200);
    setItems(data || []);
    setLoading(false);
  }, [userId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    const ch = supabase
      .channel('notif-screen-' + userId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, load]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={async () => { await supabase.rpc('mark_all_notifications_read'); load(); }} hitSlop={10} style={{ paddingHorizontal: 12 }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>{L('Tout lire', 'Read all')}</Text>
        </Pressable>
      ),
    });
  }, [navigation, load]);

  const open = async (n) => {
    if (!n.read_at) {
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id);
      setItems((x) => x.map((i) => (i.id === n.id ? { ...i, read_at: new Date().toISOString() } : i)));
    }
    const d = n.data || {};
    if (d.order_id) return navigation.navigate('Order', { id: d.order_id });
    if (d.conversation_id) return navigation.navigate('Chat', { id: d.conversation_id });
    if (n.type === 'group_invitation') return navigation.navigate('NewChat');
    if (d.event_id) return navigation.navigate('Event', { id: d.event_id });
  };

  const remove = async (n) => {
    await supabase.from('notifications').delete().eq('id', n.id);
    setItems((x) => x.filter((i) => i.id !== n.id));
  };

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      data={items}
      keyExtractor={(n) => n.id}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
      ListEmptyComponent={!loading ? <Muted style={{ padding: 20, textAlign: 'center' }}>{L('Aucune notification', 'No notifications')}</Muted> : null}
      renderItem={({ item: n }) => (
        <Pressable onPress={() => open(n)} onLongPress={() => remove(n)} style={{ flexDirection: 'row', padding: 14, backgroundColor: n.read_at ? colors.bg : colors.chipActiveBg, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
          <Text style={{ fontSize: 24, width: 36 }}>{ICON[n.type] || '🔔'}</Text>
          <View style={{ flex: 1 }}>
            <Title style={{ fontWeight: n.read_at ? '400' : '700' }}>{describe(n)}</Title>
            {n.body ? <Muted numberOfLines={2}>{n.body}</Muted> : null}
            <Muted style={{ fontSize: 12, marginTop: 2 }}>{formatTime(n.created_at, t)}</Muted>
          </View>
        </Pressable>
      )}
    />
  );
}
