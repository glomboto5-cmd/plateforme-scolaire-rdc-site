import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { L, t, tSystem } from '../lib/i18n';
import { useApp } from '../AppContext';
import { ActionSheet, Avatar, Muted, Row, Title } from '../components/ui';
import { formatTime, loadConversations, preview } from '../lib/chat';
import { invitationText, shareOnWhatsApp } from '../lib/whatsapp';

const FILTERS = ['all', 'unread', 'favorites', 'groups'];

export default function ChatsScreen({ navigation }) {
  const { colors, userId, profile } = useApp();
  const [unreadNotif, setUnreadNotif] = useState(0);
  useEffect(() => {
    const count = () =>
      supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('read_at', null)
        .then(({ count: c }) => setUnreadNotif(c || 0));
    count();
    const ch = supabase.channel('notif-badge-' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, count)
      .subscribe();
    const unsub = navigation.addListener('focus', count);
    return () => { supabase.removeChannel(ch); unsub(); };
  }, [userId, navigation]);
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [invites, setInvites] = useState(0);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [sheet, setSheet] = useState(null);

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

  const unreadTotal = items.filter((i) => i.unreadCount > 0).length;
  const groupsCount = items.filter((i) => i.type !== 'direct').length;

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter((i) => {
      if (i.archived && filter !== 'all') return false;
      if (filter === 'unread' && !i.unreadCount) return false;
      if (filter === 'favorites' && !i.pinned) return false;
      if (filter === 'groups' && i.type === 'direct') return false;
      if (s && !String(i.name || '').toLowerCase().includes(s)) return false;
      return true;
    });
  }, [items, filter, q]);

  const setMeta = async (item, patch) => {
    await supabase.from('conversation_participants').update(patch).eq('conversation_id', item.id).eq('user_id', userId);
    load();
  };

  const onLong = (item) =>
    setSheet({
      title: item.name,
      actions: [
        { label: item.pinned ? '☆  ' + t('removeFavorite') : '★  ' + t('addFavorite'), onPress: () => setMeta(item, { is_pinned: !item.pinned }) },
        { label: '✓  ' + t('markRead'), onPress: () => supabase.rpc('mark_messages', { p_conv: item.id, p_read: true }).then(load) },
        { label: (item.archived ? '📤  ' + t('unarchive') : '📥  ' + t('archive')), onPress: () => setMeta(item, { is_archived: !item.archived }) },
      ],
    });

  const menu = () =>
    setSheet({
      actions: [
        { label: '👥  ' + t('newGroup'), onPress: () => navigation.navigate('NewGroup') },
        { label: '🔗  ' + t('joinWithCode'), onPress: () => navigation.navigate('JoinGroup') },
        { label: '🟢  ' + t('inviteWhatsApp'), onPress: () => shareOnWhatsApp(invitationText(profile && profile.display_name)) },
        { label: '🔔  ' + L('Notifications', 'Notifications'), onPress: () => navigation.navigate('Notifications') },
        { label: '🤖  ' + L('Réponses automatiques', 'Auto-replies'), onPress: () => navigation.navigate('Automation') },
        { label: '🌐  ' + L('Réseaux sociaux', 'Social networks'), onPress: () => navigation.navigate('Social') },
        { label: '⚙️  ' + t('settings'), onPress: () => navigation.navigate('Settings') },
      ],
    });

  const chip = (key) => {
    const active = filter === key;
    const label = { all: t('filterAll'), unread: t('filterUnread'), favorites: t('filterFavorites'), groups: t('filterGroups') }[key];
    const count = key === 'unread' ? unreadTotal : key === 'groups' ? groupsCount : 0;
    return (
      <Pressable
        key={key}
        onPress={() => setFilter(key)}
        style={{
          flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, marginRight: 8,
          borderWidth: 1, borderColor: active ? colors.chipActiveBg : colors.border, backgroundColor: active ? colors.chipActiveBg : colors.bg,
        }}
      >
        <Text style={{ color: active ? colors.chipActiveText : colors.textMuted, fontSize: 14, fontWeight: active ? '600' : '400' }}>{label}</Text>
        {count > 0 ? <Text style={{ color: colors.textMuted, fontSize: 12, marginLeft: 6 }}>{count > 99 ? '99+' : count}</Text> : null}
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      {/* En-tête */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 }}>
        <Text style={{ flex: 1, color: colors.brand, fontSize: 26, fontWeight: '800' }}>Ange chat +</Text>
        <Pressable onPress={() => navigation.navigate('Notifications')} hitSlop={10} style={{ paddingHorizontal: 10 }}>
          <Text style={{ fontSize: 22, color: colors.text }}>🔔</Text>
          {unreadNotif > 0 ? (
            <View style={{ position: 'absolute', right: 2, top: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{unreadNotif > 99 ? '99+' : unreadNotif}</Text>
            </View>
          ) : null}
        </Pressable>
        <Pressable onPress={() => navigation.navigate('NewChat')} hitSlop={10} style={{ paddingHorizontal: 10 }}>
          <Text style={{ fontSize: 22, color: colors.text }}>📷</Text>
        </Pressable>
        <Pressable onPress={menu} hitSlop={10} style={{ paddingLeft: 10 }}>
          <Text style={{ fontSize: 24, color: colors.text, fontWeight: '700' }}>⋮</Text>
        </Pressable>
      </View>

      {/* Recherche */}
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgAlt, borderRadius: 24, marginHorizontal: 14, marginTop: 6, paddingHorizontal: 14 }}>
        <Text style={{ fontSize: 16, color: colors.textMuted }}>🔍</Text>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={t('searchChats')}
          placeholderTextColor={colors.textMuted}
          style={{ flex: 1, color: colors.text, fontSize: 16, paddingVertical: 11, paddingHorizontal: 10 }}
        />
      </View>

      {/* Filtres */}
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 12 }}>
          {FILTERS.map(chip)}
        </ScrollView>
      </View>

      {invites > 0 && (
        <Pressable onPress={() => navigation.navigate('NewChat')} style={{ backgroundColor: colors.bgAlt, padding: 12, marginHorizontal: 14, borderRadius: 12, marginBottom: 6 }}>
          <Text style={{ color: colors.brand, fontWeight: '700' }}>✉️ {t('invitations')} ({invites})</Text>
        </Pressable>
      )}

      <FlatList
        data={shown}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={
          !loading ? (
            <View style={{ padding: 40, alignItems: 'center', gap: 16 }}>
              <Muted style={{ textAlign: 'center' }}>{filter === 'all' && !q ? t('noChats') : t('noResults')}</Muted>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Row onPress={() => navigation.navigate('Chat', { id: item.id })} onLongPress={() => onLong(item)} style={{ paddingVertical: 10 }}>
            <Avatar uri={item.avatar} name={item.name} size={54} />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Title style={{ flex: 1, fontSize: 17 }} numberOfLines={1}>{item.name}</Title>
                <Text style={{ color: item.unreadCount ? colors.brand : colors.textMuted, fontSize: 12, fontWeight: item.unreadCount ? '700' : '400' }}>
                  {formatTime(item.sortAt, t)}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                <Muted style={{ flex: 1, fontSize: 15 }} numberOfLines={1}>
                  {item.archived ? '📥 ' : ''}{item.pinned ? '★ ' : ''}{item.ephemeral_mode !== 'off' ? '⏱ ' : ''}{preview(item.last, t, tSystem, userId)}
                </Muted>
                {item.unreadCount > 0 ? (
                  <View style={{ minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{item.unreadCount > 999 ? '999+' : item.unreadCount}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </Row>
        )}
      />

      {/* Bouton nouvelle discussion */}
      <Pressable
        onPress={() => navigation.navigate('NewChat')}
        style={({ pressed }) => ({
          position: 'absolute', right: 18, bottom: 18, width: 60, height: 60, borderRadius: 18,
          backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', elevation: 6, opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text style={{ color: '#fff', fontSize: 30, fontWeight: '300', marginTop: -2 }}>＋</Text>
      </Pressable>

      <ActionSheet visible={!!sheet} title={sheet && sheet.title} actions={sheet && sheet.actions} onClose={() => setSheet(null)} />
    </View>
  );
}
