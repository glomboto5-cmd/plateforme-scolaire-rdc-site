import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Image, KeyboardAvoidingView, Linking, Platform, Pressable, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import { supabase, errText } from '../lib/supabase';
import { t, tSystem } from '../lib/i18n';
import { useApp } from '../AppContext';
import { ActionSheet, Avatar, Input, Button } from '../components/ui';
import { loadConversation } from '../lib/chat';
import { signedUrl, uploadFile } from '../lib/upload';

const PRESETS = [
  { key: 'off', seconds: null },
  { key: 'h24', seconds: 86400 },
  { key: 'd7', seconds: 604800 },
  { key: 'd90', seconds: 7776000 },
];

const DAYS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const diff = Math.round((new Date(today.toDateString()) - new Date(d.toDateString())) / 86400000);
  if (diff === 0) return t('today');
  if (diff === 1) return t('yesterday');
  if (diff < 7) return DAYS_FR[d.getDay()];
  return d.getDate() + ' ' + MONTHS_FR[d.getMonth()] + ' ' + d.getFullYear();
}

function hhmm(iso) {
  const d = new Date(iso);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function Attachment({ att, colors }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let alive = true;
    signedUrl('attachments', att.storage_path).then((u) => alive && setUrl(u));
    return () => { alive = false; };
  }, [att.storage_path]);
  const isImage = (att.mime_type || '').startsWith('image/');
  if (isImage) {
    const ratio = att.width && att.height ? att.width / att.height : 1;
    return (
      <Pressable onPress={() => url && Linking.openURL(url)}>
        {url ? (
          <Image source={{ uri: url }} style={{ width: 220, height: Math.min(320, 220 / ratio), borderRadius: 8, marginBottom: 4 }} resizeMode="cover" />
        ) : (
          <View style={{ width: 220, height: 160, borderRadius: 8, backgroundColor: colors.border, marginBottom: 4 }} />
        )}
      </Pressable>
    );
  }
  return (
    <Pressable onPress={() => url && Linking.openURL(url)} style={{ flexDirection: 'row', alignItems: 'center', padding: 8, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 8, marginBottom: 4 }}>
      <Text style={{ fontSize: 26 }}>📄</Text>
      <View style={{ marginLeft: 8, maxWidth: 190 }}>
        <Text style={{ color: colors.text }} numberOfLines={2}>{att.file_name || 'Document'}</Text>
        {att.size_bytes ? <Text style={{ color: colors.textMuted, fontSize: 12 }}>{Math.ceil(att.size_bytes / 1024)} Ko</Text> : null}
      </View>
    </Pressable>
  );
}

function Ticks({ state, colors }) {
  if (state === 'pending') return <Text style={{ color: colors.textMuted, fontSize: 12 }}> 🕓</Text>;
  if (state === 'sent') return <Text style={{ color: colors.textMuted, fontSize: 13 }}> ✓</Text>;
  return <Text style={{ color: state === 'read' ? colors.read : colors.textMuted, fontSize: 13, fontWeight: '700' }}> ✓✓</Text>;
}

export default function ChatScreen({ route, navigation }) {
  const { id } = route.params;
  const { colors, userId } = useApp();
  const [conv, setConv] = useState(null);
  const [gs, setGs] = useState(null);
  const [messages, setMessages] = useState([]);
  const [receipts, setReceipts] = useState({});
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [sending, setSending] = useState(false);
  const [customDays, setCustomDays] = useState('');
  const [unreadMark, setUnreadMark] = useState(null);

  const loadAll = useCallback(async () => {
    const c = await loadConversation(id, userId).catch(() => null);
    setConv(c);
    if (c && c.type !== 'direct') {
      const { data } = await supabase.from('group_settings').select('*').eq('conversation_id', id).maybeSingle();
      setGs(data);
    }
    const { data } = await supabase
      .from('messages')
      .select('*, message_attachments(*)')
      .eq('conversation_id', id)
      .order('created_at', { ascending: false })
      .limit(300);
    // Point de départ du bandeau « N messages non lus » (avant de marquer comme lu)
    const { data: me } = await supabase
      .from('conversation_participants')
      .select('last_read_at')
      .eq('conversation_id', id)
      .eq('user_id', userId)
      .maybeSingle();
    const lastRead = me && me.last_read_at;
    const unread = (data || []).filter((m) => m.sender_id !== userId && m.type !== 'system' && (!lastRead || m.created_at > lastRead));
    setUnreadMark(unread.length ? { id: unread[unread.length - 1].id, count: unread.length } : null);
    setMessages(data || []);
    supabase.rpc('mark_messages', { p_conv: id, p_read: true });
  }, [id, userId]);

  const loadReceipts = useCallback(async (msgs) => {
    const mine = (msgs || []).filter((m) => m.sender_id === userId && m.type !== 'system').map((m) => m.id).slice(0, 100);
    if (!mine.length) return;
    const { data } = await supabase.from('message_receipts_visible').select('message_id,user_id,delivered_at,read_at').in('message_id', mine);
    const map = {};
    (data || []).forEach((r) => { (map[r.message_id] = map[r.message_id] || []).push(r); });
    setReceipts(map);
  }, [userId]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { loadReceipts(messages); }, [messages, loadReceipts]);

  useEffect(() => {
    const ch = supabase
      .channel('conv-' + id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, async (p) => {
        const { data } = await supabase.from('messages').select('*, message_attachments(*)').eq('id', p.new.id).maybeSingle();
        const m = data || p.new;
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev.map((x) => (x.id === m.id ? m : x)) : [m, ...prev]));
        if (m.sender_id !== userId) supabase.rpc('mark_messages', { p_conv: id, p_read: true });
        if (m.type === 'system') loadAll();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, (p) => {
        setMessages((prev) => prev.map((x) => (x.id === p.new.id ? { ...x, ...p.new, message_attachments: p.new.deleted_for_all_at ? [] : x.message_attachments } : x)));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, (p) => {
        setMessages((prev) => prev.filter((x) => x.id !== p.old.id));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_receipts' }, () => {
        setMessages((prev) => { loadReceipts(prev); return prev; });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, userId, loadAll, loadReceipts]);

  // Les messages éphémères expirés disparaissent de l'écran
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().toISOString();
      setMessages((prev) => (prev.some((m) => m.expires_at && m.expires_at < now) ? prev.filter((m) => !m.expires_at || m.expires_at > now) : prev));
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const isGroup = conv && conv.type !== 'direct';
  const isAdmin = conv && ['owner', 'admin'].includes(conv.myRole);
  const isMod = conv && ['owner', 'admin', 'moderator'].includes(conv.myRole);
  const canSend = !conv || !isGroup || !gs || gs.who_can_send === 'all' || isAdmin;
  const canEditInfo = !isGroup || !gs || gs.who_can_edit_info === 'all' || isAdmin;

  const names = useMemo(() => {
    const m = {};
    ((conv && conv.participants) || []).forEach((p) => { m[p.user_id] = p.profiles ? p.profiles.display_name : '?'; });
    return m;
  }, [conv]);

  useLayoutEffect(() => {
    if (!conv) return;
    navigation.setOptions({
      headerTitle: () => (
        <Pressable
          onPress={() => (isGroup ? navigation.navigate('GroupInfo', { id }) : openContactSheet())}
          style={{ flexDirection: 'row', alignItems: 'center' }}
        >
          <Avatar uri={conv.avatar} name={conv.name} size={34} />
          <View style={{ marginLeft: 10, maxWidth: 200 }}>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }} numberOfLines={1}>{conv.name}</Text>
            {isGroup ? <Text style={{ color: colors.textMuted, fontSize: 12 }}>{conv.participants.length} {t('members_count')}</Text> : null}
          </View>
        </Pressable>
      ),
      headerRight: () =>
        canEditInfo ? (
          <Pressable onPress={() => setSheet({ kind: 'ephemeral' })} hitSlop={10} style={{ paddingHorizontal: 10 }}>
            <Text style={{ fontSize: 20 }}>⏱</Text>
          </Pressable>
        ) : null,
    });
  }, [conv, navigation, isGroup, canEditInfo]);

  const openContactSheet = () => {
    if (!conv || !conv.other) return;
    setSheet({
      kind: 'actions',
      title: conv.other.display_name + (conv.other.handle ? '  @' + conv.other.handle : ''),
      actions: [
        { label: t('addContact'), onPress: () => addContact(false) },
        { label: t('block'), danger: true, onPress: () => addContact(true) },
      ],
    });
  };

  const addContact = async (block) => {
    const o = conv.other;
    const { error } = await supabase
      .from('contacts')
      .upsert({ owner_id: userId, contact_user_id: o.id, display_name: o.display_name, is_blocked: block }, { onConflict: 'owner_id,contact_user_id' });
    Alert.alert(error ? t('error') : t('saved'), error ? error.message : block ? t('block') : t('contactAdded'));
  };

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    if (editing) {
      const { error } = await supabase.from('messages').update({ content: body }).eq('id', editing.id);
      if (error) Alert.alert(t('error'), error.message);
      else setMessages((prev) => prev.map((m) => (m.id === editing.id ? { ...m, content: body, edited_at: new Date().toISOString() } : m)));
      setEditing(null);
      setText('');
      setSending(false);
      return;
    }
    const clientId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const temp = { id: 'tmp-' + clientId, conversation_id: id, sender_id: userId, type: 'text', content: body, created_at: new Date().toISOString(), pending: true, message_attachments: [] };
    setMessages((prev) => [temp, ...prev]);
    setText('');
    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: id, sender_id: userId, type: 'text', content: body, client_id: clientId })
      .select('*, message_attachments(*)')
      .single();
    setSending(false);
    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== temp.id));
      setText(body);
      return Alert.alert(t('error'), errText(error));
    }
    setMessages((prev) => {
      const without = prev.filter((m) => m.id !== temp.id);
      return without.some((m) => m.id === data.id) ? without : [data, ...without];
    });
  };

  const sendFile = async (asset, kind) => {
    try {
      setSending(true);
      const mime = asset.mimeType || (kind === 'image' ? 'image/jpeg' : 'application/octet-stream');
      const path = await uploadFile({ bucket: 'attachments', userId, uri: asset.uri, mimeType: mime, fileName: asset.fileName || asset.name });
      const { data: msg, error } = await supabase
        .from('messages')
        .insert({ conversation_id: id, sender_id: userId, type: kind, content: kind === 'document' ? asset.name || 'Document' : null })
        .select()
        .single();
      if (error) throw error;
      const { error: e2 } = await supabase.from('message_attachments').insert({
        message_id: msg.id,
        storage_path: path,
        mime_type: mime,
        file_name: asset.fileName || asset.name || null,
        size_bytes: asset.fileSize || asset.size || null,
        width: asset.width || null,
        height: asset.height || null,
      });
      if (e2) throw e2;
      const { data: full } = await supabase.from('messages').select('*, message_attachments(*)').eq('id', msg.id).single();
      setMessages((prev) => [full, ...prev.filter((m) => m.id !== msg.id)]);
    } catch (e) {
      Alert.alert(t('error'), errText(e));
    }
    setSending(false);
  };

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!res.canceled && res.assets && res.assets[0]) sendFile(res.assets[0], 'image');
  };
  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!res.canceled && res.assets && res.assets[0]) sendFile(res.assets[0], 'image');
  };
  const pickDoc = async () => {
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (!res.canceled && res.assets && res.assets[0]) sendFile(res.assets[0], 'document');
  };

  const onLongPress = (m) => {
    if (m.type === 'system' || m.pending) return;
    const mine = m.sender_id === userId;
    const actions = [];
    if (!m.deleted_for_all_at && m.content && m.type === 'text') actions.push({ label: t('copy'), onPress: () => Clipboard.setStringAsync(m.content) });
    if (mine && !m.deleted_for_all_at && m.type === 'text') actions.push({ label: t('edit'), onPress: () => { setEditing(m); setText(m.content || ''); } });
    actions.push({
      label: t('deleteForMe'),
      danger: true,
      onPress: async () => {
        const { error } = await supabase.from('message_hidden').insert({ user_id: userId, message_id: m.id });
        if (error) Alert.alert(t('error'), error.message);
        else setMessages((prev) => prev.filter((x) => x.id !== m.id));
      },
    });
    if ((mine || (isGroup && isMod)) && !m.deleted_for_all_at)
      actions.push({
        label: t('deleteForAll'),
        danger: true,
        onPress: async () => {
          const { error } = await supabase.rpc('delete_message_for_all', { p_message: m.id });
          if (error) Alert.alert(t('error'), error.message);
          else setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, deleted_for_all_at: new Date().toISOString(), content: null, message_attachments: [] } : x)));
        },
      });
    setSheet({ kind: 'actions', actions });
  };

  const setEphemeral = async (mode, seconds) => {
    const { error } = await supabase.rpc('set_ephemeral', { p_conv: id, p_mode: mode, p_seconds: seconds });
    if (error) Alert.alert(t('error'), error.message);
    else loadAll();
  };

  const tickState = (m) => {
    if (m.pending) return 'pending';
    const others = ((conv && conv.participants) || []).filter((p) => p.user_id !== userId).length || 1;
    const r = receipts[m.id] || [];
    if (r.filter((x) => x.read_at).length >= others) return 'read';
    if (r.filter((x) => x.delivered_at).length >= others) return 'delivered';
    return 'sent';
  };

  // Séparateurs façon messagerie : jour (Aujourd'hui / Hier / date) et « N messages non lus »
  const renderItem = ({ item: m, index }) => {
    const older = messages[index + 1];
    const showDay = !older || new Date(older.created_at).toDateString() !== new Date(m.created_at).toDateString();
    const showUnread = unreadMark && unreadMark.id === m.id;
    if (!showDay && !showUnread) return renderBubble(m);
    return (
      <View>
        {showDay ? (
          <View style={{ alignSelf: 'center', backgroundColor: colors.card, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, marginVertical: 8, elevation: 1 }}>
            <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600' }}>{dayLabel(m.created_at)}</Text>
          </View>
        ) : null}
        {showUnread ? (
          <View style={{ alignSelf: 'center', backgroundColor: colors.card, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16, marginVertical: 8, elevation: 1 }}>
            <Text style={{ color: colors.text, fontSize: 13 }}>
              {unreadMark.count} {unreadMark.count > 1 ? t('unreadMessages') : t('unreadMessage')}
            </Text>
          </View>
        ) : null}
        {renderBubble(m)}
      </View>
    );
  };

  const renderBubble = (m) => {
    if (m.type === 'system') {
      return (
        <View style={{ alignSelf: 'center', backgroundColor: colors.system, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, marginVertical: 6, maxWidth: '85%' }}>
          <Text style={{ color: colors.text, fontSize: 12, textAlign: 'center' }}>{tSystem(m.content)}</Text>
        </View>
      );
    }
    const mine = m.sender_id === userId;
    const deleted = !!m.deleted_for_all_at;
    return (
      <Pressable
        onLongPress={() => onLongPress(m)}
        delayLongPress={300}
        style={{
          alignSelf: mine ? 'flex-end' : 'flex-start',
          backgroundColor: mine ? colors.bubbleMine : colors.bubbleOther,
          borderRadius: 12,
          paddingHorizontal: 10,
          paddingTop: 6,
          paddingBottom: 4,
          marginVertical: 2,
          maxWidth: '82%',
          elevation: 1,
        }}
      >
        {isGroup && !mine ? <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13, marginBottom: 2 }}>{names[m.sender_id] || '?'}</Text> : null}
        {deleted ? (
          <Text style={{ color: colors.textMuted, fontStyle: 'italic' }}>🚫 {t('deletedMsg')}</Text>
        ) : (
          <>
            {(m.message_attachments || []).map((a) => <Attachment key={a.id} att={a} colors={colors} />)}
            {m.content && m.type !== 'document' ? <Text style={{ color: colors.text, fontSize: 16 }}>{m.content}</Text> : null}
          </>
        )}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 2 }}>
          {m.expires_at ? <Text style={{ fontSize: 10, color: colors.textMuted }}>⏱ </Text> : null}
          {m.edited_at && !deleted ? <Text style={{ color: colors.textMuted, fontSize: 11, marginRight: 4 }}>{t('edited')}</Text> : null}
          <Text style={{ color: colors.textMuted, fontSize: 11 }}>{hhmm(m.created_at)}</Text>
          {mine && !deleted ? <Ticks state={tickState(m)} colors={colors} /> : null}
        </View>
      </Pressable>
    );
  };

  const ephemeralLabel = conv && conv.ephemeral_mode !== 'off'
    ? (PRESETS.find((p) => p.seconds === conv.ephemeral_seconds) ? t(PRESETS.find((p) => p.seconds === conv.ephemeral_seconds).key) : Math.round(conv.ephemeral_seconds / 86400) + ' ' + t('days'))
    : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.chatBg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      {ephemeralLabel ? (
        <Text style={{ textAlign: 'center', color: colors.textMuted, fontSize: 12, paddingVertical: 6, backgroundColor: colors.bgAlt }}>
          ⏱ {t('disappearsAfter')} {ephemeralLabel}
        </Text>
      ) : null}
      <FlatList
        inverted
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 10 }}
      />
      {editing ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgAlt, paddingHorizontal: 14, paddingVertical: 8 }}>
          <Text style={{ flex: 1, color: colors.primary }}>✏️ {t('editing')}</Text>
          <Pressable onPress={() => { setEditing(null); setText(''); }}><Text style={{ color: colors.danger }}>{t('cancel')}</Text></Pressable>
        </View>
      ) : null}
      {canSend ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', padding: 8, gap: 6, backgroundColor: colors.bg }}>
          {!editing ? (
            <Pressable
              onPress={() => setSheet({ kind: 'actions', actions: [
                { label: '🖼  ' + t('photo'), onPress: pickImage },
                { label: '📷  Caméra', onPress: takePhoto },
                { label: '📄  ' + t('document'), onPress: pickDoc },
              ] })}
              style={{ padding: 10 }}
            >
              <Text style={{ fontSize: 22, color: colors.textMuted }}>📎</Text>
            </Pressable>
          ) : null}
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t('typeMessage')}
            placeholderTextColor={colors.textMuted}
            multiline
            style={{ flex: 1, maxHeight: 120, backgroundColor: colors.card, color: colors.text, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 16, borderWidth: 0.5, borderColor: colors.border }}
          />
          <Pressable onPress={send} disabled={sending || !text.trim()} style={{ backgroundColor: colors.primary, width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', opacity: text.trim() ? 1 : 0.6 }}>
            <Text style={{ color: '#fff', fontSize: 20 }}>{editing ? '✓' : '➤'}</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={{ textAlign: 'center', color: colors.textMuted, padding: 16, backgroundColor: colors.bg }}>{t('whoCanSend')} : {t('adminsOnly')}</Text>
      )}

      <ActionSheet
        visible={!!sheet && sheet.kind === 'actions'}
        title={sheet && sheet.title}
        actions={sheet && sheet.actions}
        onClose={() => setSheet(null)}
      />
      <ActionSheet
        visible={!!sheet && sheet.kind === 'ephemeral'}
        title={t('ephemeral')}
        actions={[
          ...PRESETS.map((p) => ({ label: (conv && ((p.key === 'off' && conv.ephemeral_mode === 'off') || conv.ephemeral_seconds === p.seconds) ? '● ' : '○ ') + t(p.key), onPress: () => setEphemeral(p.key === 'off' ? 'off' : 'preset', p.seconds) })),
          { label: '○ ' + t('custom') + '…', onPress: () => setSheet({ kind: 'custom' }) },
        ]}
        onClose={() => setSheet(null)}
      />
      {sheet && sheet.kind === 'custom' ? (
        <View style={{ position: 'absolute', left: 20, right: 20, top: 120, backgroundColor: colors.card, padding: 18, borderRadius: 16, gap: 12, elevation: 8 }}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{t('ephemeral')} — {t('custom')}</Text>
          <Input value={customDays} onChangeText={(v) => setCustomDays(v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder={t('days')} />
          <Button title={t('save')} disabled={!Number(customDays)} onPress={() => { setSheet(null); setEphemeral('custom', Number(customDays) * 86400); }} />
          <Button title={t('cancel')} variant="ghost" onPress={() => setSheet(null)} />
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
