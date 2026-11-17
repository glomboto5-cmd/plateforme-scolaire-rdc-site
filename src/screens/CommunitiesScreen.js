import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase, errText } from '../lib/supabase';
import { L, t } from '../lib/i18n';
import { useApp } from '../AppContext';
import { Avatar, Button, Input, Muted, Title } from '../components/ui';

export default function CommunitiesScreen({ navigation }) {
  const { colors, userId } = useApp();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    // Groupes rattachés à une communauté dont je fais partie
    const { data: mine } = await supabase.from('conversation_participants').select('conversation_id').eq('user_id', userId);
    const ids = (mine || []).map((m) => m.conversation_id);
    const [{ data: convs }, { data: comms }] = await Promise.all([
      ids.length
        ? supabase.from('conversations').select('id,type,title,avatar_url,community_id,last_message_at').in('id', ids).not('community_id', 'is', null)
        : Promise.resolve({ data: [] }),
      supabase.from('communities').select('id,name,description,avatar_url,community_members(role,user_id)'),
    ]);
    const byId = {};
    (comms || []).forEach((c) => {
      const me = (c.community_members || []).find((m) => m.user_id === userId);
      byId[c.id] = { ...c, myRole: me ? me.role : 'member', groups: [] };
    });
    (convs || []).forEach((cv) => {
      if (!byId[cv.community_id]) byId[cv.community_id] = { id: cv.community_id, name: cv.type === 'community_announcement' ? cv.title : L('Communauté', 'Community'), groups: [], myRole: 'member' };
      byId[cv.community_id].groups.push(cv);
    });
    setItems(Object.values(byId));
    setLoading(false);
  }, [userId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc('create_community', { p_name: name.trim(), p_description: desc.trim() || null });
    setBusy(false);
    if (error) return Alert.alert(t('error'), errText(error));
    setForm(false);
    setName('');
    setDesc('');
    load();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={items}
        keyExtractor={(c) => c.id}
        onRefresh={load}
        refreshing={loading}
        ListHeaderComponent={
          <Pressable onPress={() => setForm(true)} style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 }}>
            <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: colors.bgAlt, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 24 }}>👥</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Title>{L('Nouvelle communauté', 'New community')}</Title>
              <Muted>{L('Regroupez plusieurs groupes et envoyez des annonces à tous', 'Bring groups together and send announcements')}</Muted>
            </View>
          </Pressable>
        }
        ListEmptyComponent={!loading ? <Muted style={{ padding: 16 }}>{L('Vous ne faites partie d’aucune communauté.', 'You are not in any community yet.')}</Muted> : null}
        renderItem={({ item: c }) => (
          <View style={{ borderTopWidth: 8, borderTopColor: colors.bgAlt }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 }}>
              <Avatar uri={c.avatar_url} name={c.name} size={52} />
              <View style={{ flex: 1 }}>
                <Title style={{ fontSize: 18 }}>{c.name}</Title>
                {c.description ? <Muted numberOfLines={2}>{c.description}</Muted> : null}
              </View>
            </View>
            {(c.groups || [])
              .sort((a, b) => (a.type === 'community_announcement' ? -1 : 1) - (b.type === 'community_announcement' ? -1 : 1))
              .map((g) => (
                <Pressable key={g.id} onPress={() => navigation.navigate('Chat', { id: g.id })} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 14 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.chipActiveBg, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 18 }}>{g.type === 'community_announcement' ? '📢' : '💬'}</Text>
                  </View>
                  <Title style={{ fontWeight: '500', flex: 1 }} numberOfLines={1}>
                    {g.type === 'community_announcement' ? L('Annonces', 'Announcements') : g.title}
                  </Title>
                </Pressable>
              ))}
            {['owner', 'admin'].includes(c.myRole) ? (
              <Pressable onPress={() => navigation.navigate('NewGroup', { communityId: c.id })} style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                <Text style={{ color: colors.primary, fontWeight: '700' }}>＋ {L('Ajouter un groupe à la communauté', 'Add a group')}</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      />

      <Modal visible={form} transparent animationType="fade" onRequestClose={() => setForm(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 18, gap: 12 }}>
            <Title style={{ fontSize: 18 }}>{L('Nouvelle communauté', 'New community')}</Title>
            <Input placeholder={L('Nom de la communauté', 'Community name')} value={name} onChangeText={setName} />
            <Input placeholder={L('Description', 'Description')} value={desc} onChangeText={setDesc} multiline />
            <Button title={L('Créer', 'Create')} onPress={create} loading={busy} disabled={!name.trim()} />
            <Button title={t('cancel')} variant="ghost" onPress={() => setForm(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
