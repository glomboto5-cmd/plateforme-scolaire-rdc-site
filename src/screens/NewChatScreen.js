import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Alert, FlatList, Linking, Platform, Pressable, Text, TextInput, View } from 'react-native';
import * as Contacts from 'expo-contacts';
import { supabase, errText } from '../lib/supabase';
import { L, t } from '../lib/i18n';
import { useApp } from '../AppContext';
import { ActionSheet, Avatar, Input, Muted, Title } from '../components/ui';
import { avatarUri, searchProfiles, PROFILE_FIELDS } from '../lib/chat';
import { invitationText, isValidPhone, openWhatsAppChat, shareOnWhatsApp, cleanPhone } from '../lib/whatsapp';
import { loadPhoneContacts } from '../lib/phoneContacts';

function sendSms(phone, text) {
  const sep = Platform.OS === 'ios' ? '&' : '?';
  return Linking.openURL('sms:' + phone + (text ? sep + 'body=' + encodeURIComponent(text) : ''));
}

export default function NewChatScreen({ navigation }) {
  const { colors, userId, profile } = useApp();
  const [q, setQ] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [invites, setInvites] = useState([]);
  const [sheet, setSheet] = useState(null);
  const [phone, setPhone] = useState({ loading: true, granted: true, list: [] });
  const myName = profile && profile.display_name;

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

  const loadPhone = useCallback(() => {
    loadPhoneContacts()
      .then((r) => setPhone({ loading: false, ...r }))
      .catch(() => setPhone({ loading: false, granted: false, list: [] }));
  }, []);

  useEffect(() => { loadSide(); loadPhone(); }, [loadSide, loadPhone]);

  useEffect(() => {
    const h = setTimeout(async () => setResults(await searchProfiles(q, userId)), 300);
    return () => clearTimeout(h);
  }, [q, userId]);

  const total = phone.list.length + contacts.length;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>{L('Sélectionner un contact', 'Select contact')}</Text>
          <Text style={{ color: '#E0F2EE', fontSize: 13 }}>{total} {L('contacts', 'contacts')}</Text>
        </View>
      ),
      headerRight: () => (
        <View style={{ flexDirection: 'row' }}>
          <Pressable onPress={() => setSearchOpen((x) => !x)} hitSlop={10} style={{ paddingHorizontal: 10 }}>
            <Text style={{ fontSize: 20 }}>🔍</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              setSheet({
                title: L('Options', 'Options'),
                actions: [
                  { label: '🔄  ' + L('Actualiser les contacts', 'Refresh contacts'), onPress: () => { setPhone((p) => ({ ...p, loading: true })); loadPhone(); loadSide(); } },
                  { label: '🤝  ' + L('Inviter des amis', 'Invite friends'), onPress: () => shareOnWhatsApp(invitationText(myName)) },
                  { label: '🔗  ' + L('Rejoindre un groupe avec un lien', 'Join a group by link'), onPress: () => navigation.replace('JoinGroup') },
                ],
              })
            }
            hitSlop={10}
            style={{ paddingHorizontal: 8 }}
          >
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>⋮</Text>
          </Pressable>
        </View>
      ),
    });
  }, [navigation, total, myName]);

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

  const newContact = async () => {
    try {
      if (Platform.OS === 'web') return;
      await Contacts.presentFormAsync(null, { contactType: Contacts.ContactTypes.Person }, { isNew: true });
      setPhone((p) => ({ ...p, loading: true }));
      loadPhone();
    } catch (e) {
      Alert.alert(t('error'), errText(e));
    }
  };

  const contactActions = (c) =>
    setSheet({
      title: c.name + ' · ' + c.phone,
      actions: [
        { label: '✉️  ' + L('Envoyer un SMS', 'Send SMS'), onPress: () => sendSms(c.phone) },
        { label: '📞  ' + L('Appeler (réseau téléphonique)', 'Phone call'), onPress: () => Linking.openURL('tel:' + c.phone) },
        { label: '🟢  ' + L('Écrire sur WhatsApp / WhatsApp Business', 'Message on WhatsApp'), onPress: () => openWhatsAppChat(c.phone) },
        { label: '🤝  ' + L('Inviter sur Ange chat + par SMS', 'Invite by SMS'), onPress: () => sendSms(c.phone, invitationText(myName)) },
        { label: '🤝  ' + L('Inviter sur Ange chat + par WhatsApp', 'Invite by WhatsApp'), onPress: () => openWhatsAppChat(c.phone, invitationText(myName)) },
      ],
    });

  // Construction des listes
  const needle = q.trim().toLowerCase();
  const searching = needle.length >= 2;
  const registered = {};
  contacts.forEach((c) => c.profiles && (registered[c.profiles.id] = { key: 'u' + c.profiles.id, name: c.display_name || c.profiles.display_name, profile: c.profiles }));
  phone.list.forEach((c) => c.profile && !registered[c.profile.id] && (registered[c.profile.id] = { key: 'u' + c.profile.id, name: c.name, profile: c.profile, phone: c.phone, photo: c.photo }));
  if (searching) results.forEach((p) => !registered[p.id] && (registered[p.id] = { key: 'u' + p.id, name: p.display_name, profile: p }));
  const match = (x) => !needle || String(x.name || '').toLowerCase().includes(needle) || String(x.phone || '').includes(needle.replace(/\s/g, ''));
  const onUnichat = Object.values(registered).filter((x) => x.profile.id !== userId).filter((x) => searching ? true : match(x)).sort((a, b) => a.name.localeCompare(b.name));
  const notReg = phone.list.filter((c) => !c.profile).filter(match);
  const onWhatsApp = notReg.filter((c) => c.whatsapp || c.business);
  const others = notReg.filter((c) => !(c.whatsapp || c.business));

  const rows = [
    { kind: 'section', key: 's1', title: L('Contacts sur Ange chat +', 'Contacts on Ange chat +') },
    ...(onUnichat.length ? onUnichat.map((x) => ({ kind: 'user', key: x.key, item: x })) : [{ kind: 'empty', key: 'e1' }]),
    ...(onWhatsApp.length ? [{ kind: 'section', key: 's-wa', title: L('Contacts sur WhatsApp', 'Contacts on WhatsApp') + ' (' + onWhatsApp.length + ')' }] : []),
    ...onWhatsApp.map((c) => ({ kind: 'phone', key: 'w' + c.phone, item: c })),
    ...(others.length && phone.waAvailable && !phone.showOthers && !searching
      ? [{ kind: 'more', key: 's-more', count: others.length }]
      : [
          ...(others.length ? [{ kind: 'section', key: 's2', title: (phone.waAvailable ? L('Autres contacts du téléphone', 'Other phone contacts') : L('Inviter sur Ange chat +', 'Invite to Ange chat +')) + ' (' + others.length + ')' }] : []),
          ...others.map((c) => ({ kind: 'phone', key: 'p' + c.phone, item: c })),
        ]),
  ];

  const Action = ({ icon, label, onPress, right }) => (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: pressed ? colors.bgAlt : colors.bg })}>
      <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 22 }}>{icon}</Text>
      </View>
      <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600', marginLeft: 16, flex: 1 }}>{label}</Text>
      {right}
    </Pressable>
  );

  const Section = ({ title }) => <Text style={{ color: colors.textMuted, fontSize: 15, fontWeight: '600', paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8 }}>{title}</Text>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {searchOpen ? (
        <View style={{ padding: 10 }}>
          <TextInput
            value={q}
            onChangeText={setQ}
            autoFocus
            placeholder={L('Rechercher un nom, un numéro ou un identifiant', 'Search name, number or handle')}
            placeholderTextColor={colors.textMuted}
            style={{ backgroundColor: colors.bgAlt, color: colors.text, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 16 }}
          />
        </View>
      ) : null}
      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        initialNumToRender={30}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          !searching ? (
            <>
              <Action icon="👥" label={L('Nouveau groupe', 'New group')} onPress={() => navigation.replace('NewGroup')} />
              <Action icon="👤" label={L('Nouveau contact', 'New contact')} onPress={() => navigation.navigate('NewContact')} />
              <Action icon="🏘️" label={L('Nouvelle communauté', 'New community')} onPress={() => navigation.navigate('Home', { screen: 'Communities', params: { create: Date.now() } })} />
              <Action icon="📅" label={L('Nouvel événement', 'New event')} onPress={() => navigation.navigate('Events')} />
              {invites.length > 0 ? <Section title={t('invitations')} /> : null}
              {invites.map((inv) => (
                <View key={inv.id} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}>
                  <Avatar uri={avatarUri(inv.inviter)} name={inv.inviter && inv.inviter.display_name} size={50} />
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Title>{inv.inviter ? inv.inviter.display_name : '?'}</Title>
                    <Muted>{L('vous invite dans un groupe', 'invited you to a group')}</Muted>
                  </View>
                  <Pressable onPress={() => respond(inv, true)} style={{ backgroundColor: colors.brand, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, marginRight: 6 }}>
                    <Text style={{ color: '#fff', fontWeight: '600' }}>{t('accept')}</Text>
                  </Pressable>
                  <Pressable onPress={() => respond(inv, false)} style={{ paddingHorizontal: 8, paddingVertical: 8 }}>
                    <Text style={{ color: colors.danger }}>{t('decline')}</Text>
                  </Pressable>
                </View>
              ))}
            </>
          ) : null
        }
        ListFooterComponent={
          phone.loading ? (
            <Muted style={{ padding: 16 }}>{t('phoneLoading')}</Muted>
          ) : !phone.granted ? (
            <Muted style={{ padding: 16 }}>{t('phoneDenied')}</Muted>
          ) : (
            <View style={{ height: 30 }} />
          )
        }
        renderItem={({ item: r }) => {
          if (r.kind === 'section') return <Section title={r.title} />;
          if (r.kind === 'more') {
            return (
              <Pressable onPress={() => setPhone((p) => ({ ...p, showOthers: true }))} style={{ padding: 16 }}>
                <Text style={{ color: colors.primary, fontWeight: '700' }}>
                  {L('Afficher les autres contacts du téléphone (sans WhatsApp)', 'Show other phone contacts')} ({r.count})
                </Text>
              </Pressable>
            );
          }
          if (r.kind === 'empty') {
            return <Muted style={{ paddingHorizontal: 16, paddingBottom: 6 }}>{searching ? t('noResults') : L("Aucun de vos contacts n'est encore inscrit. Invitez-les ci-dessous.", 'None of your contacts is registered yet.')}</Muted>;
          }
          if (r.kind === 'user') {
            const x = r.item;
            const p = x.profile;
            return (
              <Pressable onPress={() => open(p.id)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: pressed ? colors.bgAlt : colors.bg })}>
                <Avatar uri={avatarUri(p) || x.photo} name={x.name} size={50} />
                <View style={{ marginLeft: 14, flex: 1 }}>
                  <Title numberOfLines={1} style={{ fontSize: 17 }}>{x.name}{p.is_business ? ' 🏪' : ''}</Title>
                  <Muted numberOfLines={1}>{p.about || '@' + p.handle}</Muted>
                </View>
              </Pressable>
            );
          }
          const c = r.item;
          return (
            <Pressable onPress={() => contactActions(c)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: pressed ? colors.bgAlt : colors.bg })}>
              <Avatar uri={c.photo} name={c.name} size={50} />
              <View style={{ marginLeft: 14, flex: 1 }}>
                <Title numberOfLines={1} style={{ fontSize: 17 }}>{c.name}</Title>
                <Muted numberOfLines={1}>{c.phone}</Muted>
              </View>
              <Pressable onPress={() => (c.whatsapp || c.business ? openWhatsAppChat(c.phone, invitationText(myName)) : sendSms(c.phone, invitationText(myName)))} hitSlop={6} style={{ paddingHorizontal: 10, paddingVertical: 6 }}>
                <Text style={{ color: colors.brand, fontWeight: '700' }}>{t('invite')}</Text>
              </Pressable>
            </Pressable>
          );
        }}
      />
      <ActionSheet visible={!!sheet} title={sheet && sheet.title} actions={sheet && sheet.actions} onClose={() => setSheet(null)} />
    </View>
  );
}
