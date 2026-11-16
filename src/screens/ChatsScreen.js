import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { t, tSystem } from '../lib/i18n';
import { useApp } from '../AppContext';
import { Avatar, Muted, Row, Title } from '../components/ui';
import { formatTime, loadConversations, preview } from '../lib/chat';

export default function ChatsScreen({ navigation }) {
  const { colors, userId } = useApp();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [invites, setInvites] = useState(0);

  const load = useCallback(async () => {
    try {
      setItems(await loadConversations(userId));
      const { count } = await supabase
        .from('group_invitations')
        .select('id', { count: 'exact', head: true })
        .eq('invitee_id', userId)
        .eq('status', 'pending');
      setInvites(count || 0);
    } catch (e) {
      // réseau indisponible : on garde la liste actuelle
    }
    setLoading(false);
  }, [userId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    const ch = supabase
      .channel('chats-' + userId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_participants', filter: `user_id=eq.${userId}` }, () => load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_invitations', filter: `invitee_id=eq.${userId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, load]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => navigation.navigate('NewChat')} hitSlop={12} style={{ paddingHorizontal: 12 }}>
          <Text style={{ color: '#fff', fontSize: 26, fontWeight: '300' }}>＋</Text>
        </Pressable>
      ),
    });
  }, [navigation]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {invites > 0 && (
        <Pressable onPress={() => navigation.navigate('NewChat')} style={{ backgroundColor: colors.bgAlt, padding: 14 }}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>✉️ {t('invitations')} ({invites})</Text>
        </Pressable>
      )}
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
        ListEmptyComponent={
          !loading ? (
            <View style={{ padding: 40, alignItems: 'center', gap: 16 }}>
              <Muted>{t('noChats')}</Muted>
              <Pressable onPress={() => navigation.navigate('NewChat')} style={{ backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 22 }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>{t('startChat')}</Text>
              </Pressable>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Row onPress={() => navigation.navigate('Chat', { id: item.id })}>
            <Avatar uri={item.avatar} name={item.name} size={50} />
            <View style={{ flex: 1, marginLeft: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border, paddingBottom: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Title style={{ flex: 1 }} numberOfLines={1}>
                  {item.pinned ? '📌 ' : ''}{item.name}
                </Title>
                <Text style={{ color: item.unread ? colors.primary : colors.textMuted, fontSize: 12 }}>{formatTime(item.sortAt, t)}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                <Muted style={{ flex: 1 }} numberOfLines={1}>
                  {item.ephemeral_mode !== 'off' ? '⏱ ' : ''}{preview(item.last, t, tSystem, userId)}
                </Muted>
                {item.unread && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginLeft: 8 }} />}
              </View>
            </View>
          </Row>
        )}
      />
    </View>
  );
}
