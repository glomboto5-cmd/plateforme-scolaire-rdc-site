import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';
import { supabase, errText } from '../lib/supabase';
import { t } from '../lib/i18n';
import { useApp } from '../AppContext';
import { Avatar, Input, Muted, Row, SectionTitle, Title } from '../components/ui';
import { avatarUri, searchProfiles, PROFILE_FIELDS } from '../lib/chat';

export default function NewChatScreen({ navigation }) {
  const { colors, userId } = useApp();
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [invites, setInvites] = useState([]);

  const loadSide = useCallback(async () => {
    const [{ data: c }, { data: inv }] = await Promise.all([
      supabase
        .from('contacts')
        .select('id,display_name,is_blocked,contact_user_id,profiles!contacts_contact_user_id_fkey(' + PROFILE_FIELDS + ')')
        .eq('owner_id', userId)
        .eq('is_blocked', false)
        .not('contact_user_id', 'is', null)
        .order('display_name'),
      supabase
        .from('group_invitations')
        .select('id,created_at,expires_at,inviter:profiles!group_invitations_inviter_id_fkey(display_name,avatar_url)')
        .eq('invitee_id', userId)
        .eq('status', 'pending'),
    ]);
    setContacts(c || []);
    setInvites(inv || []);
  }, [userId]);

  useEffect(() => { loadSide(); }, [loadSide]);

  useEffect(() => {
    const h = setTimeout(async () => setResults(await searchProfiles(q, userId)), 300);
    return () => clearTimeout(h);
  }, [q, userId]);

  const open = async (otherId) => {
    const { data, error } = await supabase.rpc('get_or_create_direct_conversation', { p_other: otherId });
    if (error) return Alert.alert(t('error'), errText(error));
    navigation.replace('Chat', { id: data });
  };

  const respond = async (inv, accept) => {
    const { error } = await supabase.rpc('respond_group_invitation', { p_invitation: inv.id, p_accept: accept });
    if (error) Alert.alert(t('error'), errText(error));
    loadSide();
  };

  const people = q.trim().length >= 2 ? results : contacts.map((c) => c.profiles).filter(Boolean);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: 12 }}>
        <Input placeholder={t('searchPeople')} value={q} onChangeText={setQ} autoCapitalize="none" autoFocus />
      </View>
      <FlatList
        data={people}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            <Row onPress={() => navigation.replace('NewGroup')}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 20 }}>👥</Text>
              </View>
              <Title style={{ marginLeft: 12 }}>{t('newGroup')}</Title>
            </Row>
            <Row onPress={() => navigation.replace('JoinGroup')}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 20 }}>🔗</Text>
              </View>
              <Title style={{ marginLeft: 12 }}>{t('joinWithCode')}</Title>
            </Row>
            {invites.length > 0 && <SectionTitle>{t('invitations')}</SectionTitle>}
            {invites.map((inv) => (
              <View key={inv.id} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}>
                <Avatar uri={avatarUri(inv.inviter)} name={inv.inviter && inv.inviter.display_name} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Title>{inv.inviter ? inv.inviter.display_name : '?'}</Title>
                  <Muted>{t('group')}</Muted>
                </View>
                <Pressable onPress={() => respond(inv, true)} style={{ backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, marginRight: 6 }}>
                  <Text style={{ color: '#fff', fontWeight: '600' }}>{t('accept')}</Text>
                </Pressable>
                <Pressable onPress={() => respond(inv, false)} style={{ paddingHorizontal: 10, paddingVertical: 8 }}>
                  <Text style={{ color: colors.danger }}>{t('decline')}</Text>
                </Pressable>
              </View>
            ))}
            <SectionTitle>{q.trim().length >= 2 ? t('search') : t('contacts')}</SectionTitle>
          </>
        }
        ListEmptyComponent={<Muted style={{ padding: 16 }}>{q.trim().length >= 2 ? t('noResults') : t('newChatHint')}</Muted>}
        renderItem={({ item }) => (
          <Row onPress={() => open(item.id)}>
            <Avatar uri={avatarUri(item)} name={item.display_name} />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Title>{item.display_name}{item.is_business ? ' 🏪' : ''}</Title>
              <Muted numberOfLines={1}>@{item.handle}{item.about ? ' · ' + item.about : ''}</Muted>
            </View>
          </Row>
        )}
      />
    </View>
  );
}
