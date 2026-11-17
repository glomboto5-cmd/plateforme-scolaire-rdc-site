import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import { supabase, errText } from '../lib/supabase';
import { L, t } from '../lib/i18n';
import { useApp } from '../AppContext';
import { Avatar, Input, Muted, Title } from '../components/ui';
import { avatarUri, loadConversations, searchProfiles } from '../lib/chat';
import { loadPhoneContacts } from '../lib/phoneContacts';
import { cleanPhone } from '../lib/whatsapp';

// Création d'un groupe (étape 1 : membres, étape 2 : nom) — sert aussi à ajouter des membres (params.addTo)
export default function NewGroupScreen({ navigation, route }) {
  const addTo = route.params && route.params.addTo;
  const communityId = (route.params && route.params.communityId) || null;
  const { colors, userId } = useApp();
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [frequent, setFrequent] = useState([]);
  const [saved, setSaved] = useState([]);
  const [phone, setPhone] = useState({ loading: true, list: [] });
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: addTo ? t('addMembers') : step === 1 ? L('Nouveau groupe', 'New group') : L('Nouveau groupe', 'New group'),
      headerTitle: step === 1 ? () => (
        <View>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>{addTo ? t('addMembers') : L('Nouveau groupe', 'New group')}</Text>
          <Text style={{ color: '#E0F2EE', fontSize: 13 }}>{Object.keys(selected).length ? `${Object.keys(selected).length} ${L('sélectionné(s)', 'selected')}` : L('Ajouter des membres', 'Add members')}</Text>
        </View>
      ) : undefined,
    });
  }, [navigation, addTo, step, selected]);

  useEffect(() => {
    (async () => {
      const convs = await loadConversations(userId).catch(() => []);
      setFrequent(convs.filter((c) => c.type === 'direct' && c.other).slice(0, 8).map((c) => ({ key: 'u' + c.other.id, id: c.other.id, name: c.other.display_name, avatar: avatarUri(c.other) })));
      const { data } = await supabase
        .from('contacts')
        .select('display_name,profiles!contacts_contact_user_id_fkey(id,display_name,avatar_url,handle)')
        .eq('owner_id', userId)
        .eq('is_blocked', false)
        .not('contact_user_id', 'is', null);
      setSaved((data || []).filter((c) => c.profiles).map((c) => ({ key: 'u' + c.profiles.id, id: c.profiles.id, name: c.display_name || c.profiles.display_name, avatar: avatarUri(c.profiles) })));
      loadPhoneContacts().then((r) => setPhone({ loading: false, ...r })).catch(() => setPhone({ loading: false, list: [] }));
    })();
  }, [userId]);

  useEffect(() => {
    const h = setTimeout(async () => {
      if (q.trim().length >= 2) {
        const r = await searchProfiles(q.replace(/^@/, ''), userId);
        setResults(r.map((p) => ({ key: 'u' + p.id, id: p.id, name: p.display_name, avatar: avatarUri(p), sub: '@' + p.handle })));
      } else setResults([]);
    }, 300);
    return () => clearTimeout(h);
  }, [q, userId]);

  const needle = q.trim().toLowerCase().replace(/^@/, '');
  const match = (x) => !needle || String(x.name || '').toLowerCase().includes(needle) || String(x.phone || '').includes(cleanPhone(needle));

  // Contacts WhatsApp : inscrits (ajout direct) + non inscrits (invités par lien après création)
  const waContacts = useMemo(() => {
    const base = phone.waAvailable ? phone.list.filter((c) => c.whatsapp || c.business) : phone.list;
    return base.map((c) =>
      c.profile
        ? { key: 'u' + c.profile.id, id: c.profile.id, name: c.name, avatar: avatarUri(c.profile) || c.photo, sub: c.phone }
        : { key: 'p' + c.phone, phone: c.phone, name: c.name, avatar: c.photo, sub: c.phone, external: true }
    );
  }, [phone]);

  const sections = useMemo(() => {
    const used = new Set();
    const pick = (arr) => arr.filter((x) => x.id !== userId && match(x) && !used.has(x.key) && used.add(x.key));
    const out = [];
    if (results.length) out.push({ title: L('Résultats', 'Results'), data: pick(results) });
    out.push({ title: L('Contacts fréquents', 'Frequent contacts'), data: pick(frequent) });
    out.push({ title: L('Contacts sur Angechat +', 'Contacts on Angechat +'), data: pick(saved) });
    out.push({ title: phone.waAvailable ? L('Contacts sur WhatsApp', 'Contacts on WhatsApp') : L('Contacts du téléphone', 'Phone contacts'), data: pick(waContacts) });
    return out.filter((s) => s.data.length);
  }, [results, frequent, saved, waContacts, needle]);

  const rows = [];
  sections.forEach((s) => {
    rows.push({ kind: 'h', key: 'h' + s.title, title: s.title });
    s.data.forEach((x) => rows.push({ kind: 'p', key: x.key, item: x }));
  });

  const toggle = (x) => setSelected((s) => { const n = { ...s }; if (n[x.key]) delete n[x.key]; else n[x.key] = x; return n; });
  const chosen = Object.values(selected);
  const members = chosen.filter((x) => x.id).map((x) => x.id);
  const externals = chosen.filter((x) => x.external);

  const inviteExternals = async (convId, name) => {
    if (!externals.length) return;
    const { data: code } = await supabase.rpc('create_invite_link', { p_conv: convId, p_expires_at: new Date(Date.now() + 7 * 86400000).toISOString(), p_max_uses: null });
    if (!code) return;
    await Share.share({
      message: L(
        `Rejoignez le groupe « ${name} » sur Angechat + : unichatplus://join/${code}\nCode : ${code}\nTéléchargez l'application : https://github.com/glomboto5-cmd/plateforme-scolaire-rdc-site/releases/download/unichat-apk/unichat-plus-leger.apk`,
        `Join "${name}" on Angechat +: unichatplus://join/${code}`
      ),
    });
  };

  const submit = async () => {
    setLoading(true);
    if (addTo) {
      const { error } = await supabase.rpc('add_group_members', { p_conv: addTo, p_member_ids: members });
      if (!error) await inviteExternals(addTo, L('notre groupe', 'our group'));
      setLoading(false);
      if (error) return Alert.alert(t('error'), errText(error));
      return navigation.goBack();
    }
    if (!title.trim()) { setLoading(false); return Alert.alert(t('error'), L('Donnez un nom au groupe', 'Give the group a name')); }
    const { data, error } = await supabase.rpc('create_group', { p_title: title.trim(), p_member_ids: members, p_description: description.trim() || null, p_community_id: communityId });
    if (error) { setLoading(false); return Alert.alert(t('error'), errText(error)); }
    await inviteExternals(data, title.trim());
    setLoading(false);
    navigation.replace('Chat', { id: data });
  };

  if (step === 2 && !addTo) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
          <Input placeholder={L('Nom du groupe', 'Group name')} value={title} onChangeText={setTitle} autoFocus />
          <Input placeholder={L('Description (facultatif)', 'Description (optional)')} value={description} onChangeText={setDescription} />
          <Muted>{L('Membres', 'Members')} : {chosen.length}</Muted>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
            {chosen.map((x) => (
              <View key={x.key} style={{ alignItems: 'center', width: 70 }}>
                <Avatar uri={x.avatar} name={x.name} size={52} />
                <Text numberOfLines={1} style={{ color: colors.text, fontSize: 12, marginTop: 4 }}>{x.name}</Text>
                {x.external ? <Text style={{ color: colors.textMuted, fontSize: 10 }}>{L('invité', 'invited')}</Text> : null}
              </View>
            ))}
          </View>
          {externals.length ? (
            <Muted style={{ fontSize: 13 }}>
              {L(`${externals.length} contact(s) ne sont pas encore sur Angechat + : un lien d'invitation au groupe sera partagé après la création.`, 'Non-registered contacts will receive an invite link.')}
            </Muted>
          ) : null}
        </ScrollView>
        <Pressable onPress={submit} disabled={loading} style={{ position: 'absolute', right: 18, bottom: 22, width: 60, height: 60, borderRadius: 18, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', elevation: 5, opacity: loading ? 0.6 : 1 }}>
          <Text style={{ color: '#fff', fontSize: 26 }}>✓</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: 10 }}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={L('Nom, numéro, @nomdeprofil', 'Name, number, @profile')}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          style={{ backgroundColor: colors.bgAlt, color: colors.text, borderRadius: 26, paddingHorizontal: 18, paddingVertical: 12, fontSize: 16 }}
        />
      </View>
      {chosen.length ? (
        <ScrollView horizontal style={{ maxHeight: 92 }} contentContainerStyle={{ paddingHorizontal: 12, gap: 12 }}>
          {chosen.map((x) => (
            <Pressable key={x.key} onPress={() => toggle(x)} style={{ alignItems: 'center', width: 64 }}>
              <Avatar uri={x.avatar} name={x.name} size={48} />
              <Text numberOfLines={1} style={{ color: colors.text, fontSize: 11, marginTop: 3 }}>{x.name} ✕</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={30}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={<Muted style={{ padding: 16 }}>{phone.loading ? t('phoneLoading') : t('noResults')}</Muted>}
        renderItem={({ item: r }) =>
          r.kind === 'h' ? (
            <Text style={{ color: colors.textMuted, fontSize: 15, fontWeight: '600', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 }}>{r.title}</Text>
          ) : (
            <Pressable onPress={() => toggle(r.item)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: pressed ? colors.bgAlt : colors.bg })}>
              <Avatar uri={r.item.avatar} name={r.item.name} size={50} />
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Title numberOfLines={1} style={{ fontSize: 17 }}>{r.item.name}</Title>
                {r.item.sub && r.item.sub !== r.item.name ? <Muted numberOfLines={1}>{r.item.sub}</Muted> : null}
              </View>
              <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: selected[r.item.key] ? colors.brand : colors.textMuted, backgroundColor: selected[r.item.key] ? colors.brand : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                {selected[r.item.key] ? <Text style={{ color: '#fff', fontWeight: '800' }}>✓</Text> : null}
              </View>
            </Pressable>
          )
        }
      />
      {chosen.length || !addTo ? (
        <Pressable
          onPress={() => (addTo ? submit() : setStep(2))}
          disabled={loading || (addTo && !chosen.length)}
          style={{ position: 'absolute', right: 18, bottom: 22, width: 60, height: 60, borderRadius: 18, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', elevation: 5 }}
        >
          <Text style={{ color: '#fff', fontSize: 26 }}>→</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
