import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';
import { supabase, errText } from '../lib/supabase';
import { t } from '../lib/i18n';
import { useApp } from '../AppContext';
import { Avatar, Input, Muted, Row, SectionTitle, Title } from '../components/ui';
import { avatarUri, searchProfiles, PROFILE_FIELDS } from '../lib/chat';
import { invitationText, isValidPhone, openWhatsAppChat, shareOnWhatsApp } from '../lib/whatsapp';
import { loadPhoneContacts } from '../lib/phoneContacts';

export default function NewChatScreen({ navigation }) {
  const { colors, userId, profile } = useApp();
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [invites, setInvites] = useState([]);
  const [waPhone, setWaPhone] = useState('');

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

  // Contacts du téléphone (les mêmes que dans WhatsApp)
  const [phone, setPhone] = useState({ loading: true, granted: true, list: [] });
  useEffect(() => {
    let alive = true;
    loadPhoneContacts()
      .then((r) => alive && setPhone({ loading: false, ...r }))
      .catch(() => alive && setPhone({ loading: false, granted: false, list: [] }));
    return () => { alive = false; };
  }, []);

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

  const searching = q.trim().length >= 2;
  const needle = q.trim().toLowerCase();
  const people = searching ? results : contacts.map((c) => c.profiles).filter(Boolean);
  const known = new Set(people.map((p) => p.id));
  const phoneRows = phone.list
    .filter((c) => !c.profile || !known.has(c.profile.id))
    .filter((c) => !needle || c.name.toLowerCase().includes(needle) || c.phone.includes(needle.replace(/\s/g, '')));
  const rows = [
    ...people.map((p) => ({ kind: 'user', key: 'u' + p.id, profile: p })),
    ...(phoneRows.length ? [{ kind: 'header', key: 'h-phone' }] : []),
    ...phoneRows.map((c) => ({ kind: 'phone', key: 'p' + c.phone, contact: c })),
  ];
  const myName = profile && profile.display_name;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: 12 }}>
        <Input placeholder={t('searchPeople')} value={q} onChangeText={setQ} autoCapitalize="none" autoFocus />
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        initialNumToRender={25}
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

            <SectionTitle>🟢 {t('whatsappSection')}</SectionTitle>
            <View style={{ paddingHorizontal: 16, gap: 8 }}>
              <Input placeholder={t('whatsappPhone')} value={waPhone} onChangeText={setWaPhone} keyboardType="phone-pad" />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  onPress={() => (isValidPhone(waPhone) ? openWhatsAppChat(waPhone) : Alert.alert(t('error'), t('phoneInvalid')))}
                  style={{ flex: 1, backgroundColor: '#25D366', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>{t('whatsappWrite')}</Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    isValidPhone(waPhone)
                      ? openWhatsAppChat(waPhone, invitationText(profile && profile.display_name))
                      : shareOnWhatsApp(invitationText(profile && profile.display_name))
                  }
                  style={{ flex: 1, borderWidth: 1, borderColor: '#25D366', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}
                >
                  <Text style={{ color: '#25D366', fontWeight: '700' }}>{t('whatsappInvite')}</Text>
                </Pressable>
              </View>
              <Muted style={{ fontSize: 12 }}>{t('whatsappHint')}</Muted>
            </View>

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
            <SectionTitle>{searching ? t('search') : t('onUnichat')}</SectionTitle>
            {!people.length ? <Muted style={{ paddingHorizontal: 16, paddingBottom: 6 }}>{searching ? t('noResults') : t('newChatHint')}</Muted> : null}
          </>
        }
        ListFooterComponent={
          phone.loading ? (
            <Muted style={{ padding: 16 }}>{t('phoneLoading')}</Muted>
          ) : !phone.granted ? (
            <Muted style={{ padding: 16 }}>{t('phoneDenied')}</Muted>
          ) : <View style={{ height: 24 }} />
        }
        renderItem={({ item }) => {
          if (item.kind === 'header') return <SectionTitle>📱 {t('phoneContacts')}</SectionTitle>;
          if (item.kind === 'user') {
            const p = item.profile;
            return (
              <Row onPress={() => open(p.id)}>
                <Avatar uri={avatarUri(p)} name={p.display_name} />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Title>{p.display_name}{p.is_business ? ' 🏪' : ''}</Title>
                  <Muted numberOfLines={1}>@{p.handle}{p.about ? ' · ' + p.about : ''}</Muted>
                </View>
              </Row>
            );
          }
          const c = item.contact;
          if (c.profile) {
            return (
              <Row onPress={() => open(c.profile.id)}>
                <Avatar uri={avatarUri(c.profile)} name={c.name} />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Title numberOfLines={1}>{c.name}</Title>
                  <Muted numberOfLines={1}>✅ Unichat + · {c.phone}</Muted>
                </View>
              </Row>
            );
          }
          return (
            <Row>
              <Avatar name={c.name} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Title numberOfLines={1}>{c.name}</Title>
                <Muted numberOfLines={1}>{c.phone}</Muted>
              </View>
              <Pressable onPress={() => openWhatsAppChat(c.phone)} hitSlop={6} style={{ backgroundColor: '#25D366', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 14, marginRight: 6 }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>WhatsApp</Text>
              </Pressable>
              <Pressable onPress={() => openWhatsAppChat(c.phone, invitationText(myName))} hitSlop={6} style={{ borderWidth: 1, borderColor: colors.primary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14 }}>
                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>{t('invite')}</Text>
              </Pressable>
            </Row>
          );
        }}
      />
    </View>
  );
}
