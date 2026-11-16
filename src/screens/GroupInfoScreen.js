import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, Switch, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { supabase, errText } from '../lib/supabase';
import { t } from '../lib/i18n';
import { useApp } from '../AppContext';
import { ActionSheet, Avatar, Button, Input, Muted, Row, SectionTitle, Title } from '../components/ui';
import { avatarUri, loadConversation } from '../lib/chat';
import { publicUrl, uploadFile } from '../lib/upload';

const ROLE_ORDER = { owner: 0, admin: 1, moderator: 2, member: 3 };

export default function GroupInfoScreen({ route, navigation }) {
  const { id } = route.params;
  const { colors, userId } = useApp();
  const [conv, setConv] = useState(null);
  const [gs, setGs] = useState(null);
  const [links, setLinks] = useState([]);
  const [requests, setRequests] = useState([]);
  const [sheet, setSheet] = useState(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');

  const load = useCallback(async () => {
    const c = await loadConversation(id, userId);
    setConv(c);
    if (!c) return;
    setTitle(c.title || '');
    setDesc(c.description || '');
    const [{ data: s }, { data: l }, { data: r }] = await Promise.all([
      supabase.from('group_settings').select('*').eq('conversation_id', id).maybeSingle(),
      supabase.from('group_invite_links').select('*').eq('conversation_id', id).is('revoked_at', null).order('created_at', { ascending: false }),
      supabase
        .from('group_join_requests')
        .select('id,created_at,profiles!group_join_requests_user_id_fkey(id,display_name,avatar_url,handle)')
        .eq('conversation_id', id)
        .eq('status', 'pending'),
    ]);
    setGs(s);
    setLinks(l || []);
    setRequests(r || []);
  }, [id, userId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!conv) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  const my = conv.myRole;
  const isAdmin = my === 'owner' || my === 'admin';
  const isMod = isAdmin || my === 'moderator';
  const allows = (k) => isAdmin || (gs && gs[k] === 'all');

  const call = async (fn, args, after) => {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) Alert.alert(t('error'), errText(error));
    else if (after) after(data);
    load();
  };

  const setPerm = async (patch) => {
    setGs((g) => ({ ...g, ...patch }));
    const { error } = await supabase.from('group_settings').update(patch).eq('conversation_id', id);
    if (error) { Alert.alert(t('error'), error.message); load(); }
  };

  const changePhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
    if (res.canceled || !res.assets) return;
    try {
      const a = res.assets[0];
      const path = await uploadFile({ bucket: 'avatars', userId, uri: a.uri, mimeType: a.mimeType || 'image/jpeg', fileName: a.fileName });
      call('update_group_info', { p_conv: id, p_avatar_url: publicUrl('avatars', path) });
    } catch (e) {
      Alert.alert(t('error'), errText(e));
    }
  };

  const memberActions = (p) => {
    if (p.user_id === userId) return;
    const target = p.role;
    const acts = [{ label: t('message'), onPress: async () => {
      const { data } = await supabase.rpc('get_or_create_direct_conversation', { p_other: p.user_id });
      if (data) navigation.navigate('Chat', { id: data });
    } }];
    if (isAdmin && target !== 'owner') {
      if (my === 'owner' || target !== 'admin') {
        if (target !== 'admin') acts.push({ label: t('makeAdmin'), onPress: () => call('set_member_role', { p_conv: id, p_user: p.user_id, p_role: 'admin' }) });
        if (target !== 'moderator') acts.push({ label: t('makeModerator'), onPress: () => call('set_member_role', { p_conv: id, p_user: p.user_id, p_role: 'moderator' }) });
        if (target !== 'member') acts.push({ label: t('makeMember'), onPress: () => call('set_member_role', { p_conv: id, p_user: p.user_id, p_role: 'member' }) });
      }
      if (my === 'owner') acts.push({ label: t('makeOwner'), onPress: () => call('set_member_role', { p_conv: id, p_user: p.user_id, p_role: 'owner' }) });
    }
    const canRemove = my === 'owner' ? target !== 'owner' : my === 'admin' ? ['moderator', 'member'].includes(target) : my === 'moderator' ? target === 'member' : false;
    if (canRemove) acts.push({ label: t('remove'), danger: true, onPress: () => call('remove_group_member', { p_conv: id, p_user: p.user_id }) });
    setSheet({ title: p.profiles ? p.profiles.display_name : '', actions: acts });
  };

  const linkUrl = (code) => `unichatplus://join/${code}`;

  const shareLink = (l) =>
    Share.share({ message: `${t('inviteLink')} « ${conv.title} » — Unichat +\n${linkUrl(l.code)}\nCode : ${l.code}` });

  const leave = () =>
    Alert.alert(t('leaveGroup'), t('confirmLeave'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('leaveGroup'), style: 'destructive', onPress: () => call('leave_group', { p_conv: id }, () => navigation.popToTop()) },
    ]);

  const members = [...conv.participants].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);
  const PermRow = ({ label, k }) => (
    <Row onPress={() => isAdmin && setPerm({ [k]: gs[k] === 'all' ? 'admins' : 'all' })}>
      <View style={{ flex: 1 }}>
        <Title style={{ fontWeight: '400' }}>{label}</Title>
        <Muted>{gs && gs[k] === 'all' ? t('allMembers') : t('adminsOnly')}</Muted>
      </View>
      {isAdmin ? <Text style={{ color: colors.primary }}>›</Text> : null}
    </Row>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bgAlt }}>
      <View style={{ alignItems: 'center', padding: 20, backgroundColor: colors.bg }}>
        <Pressable onPress={allows('who_can_edit_info') ? changePhoto : undefined}>
          <Avatar uri={conv.avatar_url} name={conv.title} size={96} />
        </Pressable>
        {editing ? (
          <View style={{ alignSelf: 'stretch', gap: 8, marginTop: 12 }}>
            <Input value={title} onChangeText={setTitle} placeholder={t('groupName')} />
            <Input value={desc} onChangeText={setDesc} placeholder={t('description')} multiline />
            <Button title={t('save')} onPress={() => { setEditing(false); call('update_group_info', { p_conv: id, p_title: title.trim() || null, p_description: desc }); }} />
          </View>
        ) : (
          <Pressable onPress={() => allows('who_can_edit_info') && setEditing(true)} style={{ alignItems: 'center', marginTop: 10 }}>
            <Title style={{ fontSize: 22 }}>{conv.title} {allows('who_can_edit_info') ? '✏️' : ''}</Title>
            {conv.description ? <Muted style={{ textAlign: 'center', marginTop: 4 }}>{conv.description}</Muted> : null}
            <Muted style={{ marginTop: 4 }}>{t('group')} · {members.length} {t('members_count')}</Muted>
          </Pressable>
        )}
      </View>

      {isMod && requests.length > 0 && (
        <>
          <SectionTitle>{t('joinRequests')} ({requests.length})</SectionTitle>
          {requests.map((r) => (
            <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: colors.bg }}>
              <Avatar uri={avatarUri(r.profiles)} name={r.profiles && r.profiles.display_name} />
              <Title style={{ flex: 1, marginLeft: 12 }}>{r.profiles ? r.profiles.display_name : '?'}</Title>
              <Pressable onPress={() => call('decide_join_request', { p_request: r.id, p_approve: true })} style={{ backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, marginRight: 6 }}>
                <Text style={{ color: '#fff' }}>{t('approve')}</Text>
              </Pressable>
              <Pressable onPress={() => call('decide_join_request', { p_request: r.id, p_approve: false })}>
                <Text style={{ color: colors.danger }}>{t('reject')}</Text>
              </Pressable>
            </View>
          ))}
        </>
      )}

      <SectionTitle>{t('members')} ({members.length})</SectionTitle>
      {allows('who_can_add_members') && (
        <Row onPress={() => navigation.navigate('NewGroup', { addTo: id })}>
          <Text style={{ fontSize: 22, width: 44, textAlign: 'center' }}>➕</Text>
          <Title style={{ marginLeft: 12, color: colors.primary }}>{t('addMembers')}</Title>
        </Row>
      )}
      {members.map((p) => (
        <Row key={p.user_id} onPress={() => memberActions(p)}>
          <Avatar uri={avatarUri(p.profiles)} name={p.profiles && p.profiles.display_name} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Title>{p.user_id === userId ? t('you') : p.profiles ? p.profiles.display_name : '?'}</Title>
            {p.profiles && p.profiles.about ? <Muted numberOfLines={1}>{p.profiles.about}</Muted> : null}
          </View>
          {p.role !== 'member' ? (
            <Text style={{ color: colors.primary, fontSize: 12, borderWidth: 1, borderColor: colors.primary, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>{t(p.role)}</Text>
          ) : null}
        </Row>
      ))}

      {allows('who_can_create_links') && (
        <>
          <SectionTitle>{t('inviteLink')}</SectionTitle>
          {links.map((l) => (
            <View key={l.id} style={{ padding: 14, backgroundColor: colors.bg, gap: 6 }}>
              <Text selectable style={{ color: colors.text, fontFamily: 'monospace' }}>{l.code}</Text>
              <Muted>
                {l.use_count}{l.max_uses ? '/' + l.max_uses : ''} · {l.expires_at ? new Date(l.expires_at).toLocaleDateString() : '∞'}
              </Muted>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <Pressable onPress={() => shareLink(l)}><Text style={{ color: colors.primary, fontWeight: '600' }}>{t('share')}</Text></Pressable>
                <Pressable onPress={() => Clipboard.setStringAsync(l.code)}><Text style={{ color: colors.primary, fontWeight: '600' }}>{t('copy')}</Text></Pressable>
                <Pressable onPress={() => call('revoke_invite_link', { p_link: l.id })}><Text style={{ color: colors.danger, fontWeight: '600' }}>{t('revoke')}</Text></Pressable>
              </View>
            </View>
          ))}
          <Row onPress={() => call('create_invite_link', { p_conv: id, p_expires_at: new Date(Date.now() + 7 * 86400000).toISOString(), p_max_uses: null })}>
            <Text style={{ fontSize: 20, width: 44, textAlign: 'center' }}>🔗</Text>
            <Title style={{ marginLeft: 12, color: colors.primary }}>{t('createLink')}</Title>
          </Row>
        </>
      )}

      {gs && (
        <>
          <SectionTitle>{t('permissions')}</SectionTitle>
          <PermRow label={t('whoCanSend')} k="who_can_send" />
          <PermRow label={t('whoCanEdit')} k="who_can_edit_info" />
          <PermRow label={t('whoCanAdd')} k="who_can_add_members" />
          <PermRow label={t('whoCanLinks')} k="who_can_create_links" />
          <Row>
            <Title style={{ flex: 1, fontWeight: '400' }}>{t('approval')}</Title>
            <Switch disabled={!isAdmin} value={!!gs.approval_required} onValueChange={(v) => setPerm({ approval_required: v })} trackColor={{ true: colors.primary }} />
          </Row>
          <Row>
            <Title style={{ flex: 1, fontWeight: '400' }}>{t('groupReceipts')}</Title>
            <Switch disabled={!isAdmin} value={!!gs.read_receipts_enabled} onValueChange={(v) => setPerm({ read_receipts_enabled: v })} trackColor={{ true: colors.primary }} />
          </Row>
        </>
      )}

      <View style={{ padding: 16, paddingBottom: 40 }}>
        <Button title={t('leaveGroup')} variant="danger" onPress={leave} />
      </View>

      <ActionSheet visible={!!sheet} title={sheet && sheet.title} actions={sheet && sheet.actions} onClose={() => setSheet(null)} />
    </ScrollView>
  );
}
