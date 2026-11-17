import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { L, t } from '../lib/i18n';
import { useApp } from '../AppContext';
import { Avatar, Muted, Title } from '../components/ui';
import { avatarUri, formatTime, loadConversation } from '../lib/chat';
import { startCall } from '../lib/calls';

export default function CallsScreen({ navigation }) {
  const { colors, userId } = useApp();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('calls')
      .select('id,media,status,started_at,answered_at,ended_at,initiator_id,conversation_id,conversations(type,title,conversation_participants(user_id,profiles!conversation_participants_user_id_fkey(display_name,avatar_url)))')
      .order('started_at', { ascending: false })
      .limit(100);
    setCalls(data || []);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const peerOf = (c) => {
    const parts = (c.conversations && c.conversations.conversation_participants) || [];
    const o = parts.find((p) => p.user_id !== userId);
    return o && o.profiles ? o.profiles : { display_name: (c.conversations && c.conversations.title) || '?' };
  };

  const recall = async (c, media) => {
    const conv = await loadConversation(c.conversation_id, userId);
    startCall(navigation, conv, media || c.media, userId);
  };

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      data={calls}
      keyExtractor={(c) => c.id}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
      ListHeaderComponent={
        <Muted style={{ padding: 16, paddingBottom: 6 }}>
          {L('Pour appeler, ouvrez une discussion privée et touchez 📞 (vocal) ou 📹 (vidéo).', 'To call, open a private chat and tap 📞 or 📹.')}
        </Muted>
      }
      ListEmptyComponent={!loading ? <Muted style={{ padding: 16 }}>{L('Aucun appel pour le moment', 'No calls yet')}</Muted> : null}
      renderItem={({ item: c }) => {
        const peer = peerOf(c);
        const outgoing = c.initiator_id === userId;
        const missed = !outgoing && ['missed', 'declined'].includes(c.status) && !c.answered_at;
        const dur = c.answered_at && c.ended_at ? Math.max(0, Math.round((new Date(c.ended_at) - new Date(c.answered_at)) / 1000)) : 0;
        return (
          <Pressable onPress={() => recall(c)} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}>
            <Avatar uri={avatarUri(peer)} name={peer.display_name} size={50} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Title style={{ color: missed ? colors.danger : colors.text }}>{peer.display_name}</Title>
              <Muted>
                <Text style={{ color: missed ? colors.danger : colors.brand }}>{outgoing ? '↗' : '↙'} </Text>
                {formatTime(c.started_at, t)}
                {dur ? ' · ' + Math.floor(dur / 60) + ':' + String(dur % 60).padStart(2, '0') : ''}
                {missed ? ' · ' + L('manqué', 'missed') : ''}
              </Muted>
            </View>
            <Pressable onPress={() => recall(c, c.media)} hitSlop={10} style={{ padding: 8 }}>
              <Text style={{ fontSize: 22 }}>{c.media === 'video' ? '📹' : '📞'}</Text>
            </Pressable>
          </Pressable>
        );
      }}
    />
  );
}
