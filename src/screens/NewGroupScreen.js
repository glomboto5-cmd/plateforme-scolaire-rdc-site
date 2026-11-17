import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Text, View } from 'react-native';
import { supabase, errText } from '../lib/supabase';
import { t } from '../lib/i18n';
import { useApp } from '../AppContext';
import { Avatar, Button, Input, Muted, Row, SectionTitle, Title } from '../components/ui';
import { avatarUri, searchProfiles } from '../lib/chat';

// Sert aussi à ajouter des membres à un groupe existant (params.addTo)
export default function NewGroupScreen({ navigation, route }) {
  const addTo = route.params && route.params.addTo;
  const communityId = (route.params && route.params.communityId) || null;
  const { colors, userId } = useApp();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: addTo ? t('addMembers') : t('newGroup') });
  }, [navigation, addTo]);

  useEffect(() => {
    const h = setTimeout(async () => {
      if (q.trim().length >= 2) setResults(await searchProfiles(q, userId));
      else {
        const { data } = await supabase
          .from('contacts')
          .select('profiles!contacts_contact_user_id_fkey(id,display_name,avatar_url,handle)')
          .eq('owner_id', userId)
          .eq('is_blocked', false)
          .not('contact_user_id', 'is', null);
        setResults((data || []).map((c) => c.profiles).filter(Boolean));
      }
    }, 300);
    return () => clearTimeout(h);
  }, [q, userId]);

  const toggle = (p) => setSelected((s) => { const n = { ...s }; if (n[p.id]) delete n[p.id]; else n[p.id] = p; return n; });
  const ids = Object.keys(selected);

  const submit = async () => {
    setLoading(true);
    if (addTo) {
      const { error } = await supabase.rpc('add_group_members', { p_conv: addTo, p_member_ids: ids });
      setLoading(false);
      if (error) return Alert.alert(t('error'), errText(error));
      return navigation.goBack();
    }
    if (!title.trim()) { setLoading(false); return Alert.alert(t('error'), t('groupName')); }
    const { data, error } = await supabase.rpc('create_group', { p_title: title.trim(), p_member_ids: ids, p_description: description.trim() || null, p_community_id: communityId });
    setLoading(false);
    if (error) return Alert.alert(t('error'), errText(error));
    navigation.replace('Chat', { id: data });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={results}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ padding: 12, gap: 10 }}>
            {!addTo && <Input placeholder={t('groupName')} value={title} onChangeText={setTitle} />}
            {!addTo && <Input placeholder={t('description')} value={description} onChangeText={setDescription} />}
            {ids.length > 0 && <Muted>{ids.map((i) => selected[i].display_name).join(', ')}</Muted>}
            <Input placeholder={t('searchPeople')} value={q} onChangeText={setQ} autoCapitalize="none" />
            <SectionTitle>{t('selectMembers')}</SectionTitle>
          </View>
        }
        ListEmptyComponent={<Muted style={{ padding: 16 }}>{t('newChatHint')}</Muted>}
        renderItem={({ item }) => (
          <Row onPress={() => toggle(item)}>
            <Avatar uri={avatarUri(item)} name={item.display_name} />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Title>{item.display_name}</Title>
              <Muted>@{item.handle}</Muted>
            </View>
            <Text style={{ fontSize: 22, color: selected[item.id] ? colors.primary : colors.border }}>{selected[item.id] ? '✔' : '○'}</Text>
          </Row>
        )}
      />
      <View style={{ padding: 12 }}>
        <Button title={addTo ? t('addMembers') + (ids.length ? ` (${ids.length})` : '') : t('create')} onPress={submit} loading={loading} disabled={addTo && !ids.length} />
      </View>
    </View>
  );
}
