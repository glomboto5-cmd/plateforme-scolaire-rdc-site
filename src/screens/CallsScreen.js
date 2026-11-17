import React, { useCallback, useLayoutEffect, useState } from 'react';
import { Alert, FlatList, Linking, Modal, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase, errText } from '../lib/supabase';
import { L, t } from '../lib/i18n';
import { useApp } from '../AppContext';
import { Avatar, Button, Muted, Title } from '../components/ui';
import { avatarUri, formatTime, loadConversation, loadConversations } from '../lib/chat';
import { startCall } from '../lib/calls';
import { cleanPhone } from '../lib/whatsapp';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '0', '⌫'];

function dayLabel(d) {
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function CallsScreen({ navigation }) {
  const { colors, userId } = useApp();
  const [calls, setCalls] = useState([]);
  const [planned, setPlanned] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(null); // null = fermé
  const [picker, setPicker] = useState(null); // 'call' | 'schedule' | 'favorites'
  const [people, setPeople] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [dialOpen, setDialOpen] = useState(false);
  const [dial, setDial] = useState('');
  const [plan, setPlan] = useState(null); // { conv, day: 0|1|2, time, media, title }

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 3600000).toISOString();
    const [{ data }, { data: sc }] = await Promise.all([
      supabase
        .from('calls')
        .select('id,media,status,started_at,answered_at,ended_at,initiator_id,conversation_id,conversations(type,title,conversation_participants(user_id,profiles!conversation_participants_user_id_fkey(display_name,avatar_url)))')
        .order('started_at', { ascending: false })
        .limit(100),
      supabase
        .from('scheduled_calls')
        .select('id,media,title,scheduled_at,status,created_by,conversation_id,conversations(type,title,conversation_participants(user_id,profiles!conversation_participants_user_id_fkey(display_name,avatar_url)))')
        .eq('status', 'planned')
        .gt('scheduled_at', since)
        .order('scheduled_at', { ascending: true }),
    ]);
    setCalls(data || []);
    setPlanned(sc || []);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row' }}>
          <Pressable onPress={() => setSearch((s) => (s === null ? '' : null))} hitSlop={10} style={{ paddingHorizontal: 10 }}>
            <Text style={{ fontSize: 20 }}>🔍</Text>
          </Pressable>
          <Pressable onPress={() => { setLoading(true); load(); }} hitSlop={10} style={{ paddingHorizontal: 10 }}>
            <Text style={{ fontSize: 20 }}>🔄</Text>
          </Pressable>
        </View>
      ),
    });
  }, [navigation, load]);

  const peerOf = (c) => {
    const parts = (c.conversations && c.conversations.conversation_participants) || [];
    const o = parts.find((p) => p.user_id !== userId);
    return o && o.profiles ? o.profiles : { display_name: (c.conversations && c.conversations.title) || '?' };
  };

  const recall = async (c, media) => {
    const conv = await loadConversation(c.conversation_id, userId);
    startCall(navigation, conv, media || c.media, userId);
  };

  const openPicker = async (mode) => {
    setPicker(mode);
    if (mode === 'favorites') {
      const { data } = await supabase
        .from('contacts')
        .select('id,display_name,contact_user_id,profiles!contacts_contact_user_id_fkey(display_name,avatar_url)')
        .eq('owner_id', userId)
        .eq('is_favorite', true)
        .not('contact_user_id', 'is', null)
        .order('display_name');
      setFavorites(data || []);
    } else {
      const list = await loadConversations(userId).catch(() => []);
      setPeople(list.filter((c) => c.type === 'direct'));
    }
  };

  const callUser = async (otherId, media) => {
    const { data, error } = await supabase.rpc('get_or_create_direct_conversation', { p_other: otherId });
    if (error) return Alert.alert(t('error'), errText(error));
    const conv = await loadConversation(data, userId);
    setPicker(null);
    setDialOpen(false);
    startCall(navigation, conv, media, userId);
  };

  const dialUnichat = async (media) => {
    const d = cleanPhone(dial);
    if (!/^[1-9]\d{7,14}$/.test(d)) return Alert.alert(t('error'), L('Numéro invalide. Exemple : +243812345678', 'Invalid number'));
    const { data, error } = await supabase.rpc('match_phone_contacts', { p_phones: ['+' + d] });
    if (error) return Alert.alert(t('error'), errText(error));
    if (!data || !data.length) {
      return Alert.alert(L('Pas sur Unichat +', 'Not on Unichat +'), L('Ce numéro n’est pas inscrit sur Unichat +. Vous pouvez faire un appel téléphonique normal.', 'This number is not on Unichat +.'), [
        { text: t('cancel'), style: 'cancel' },
        { text: L('Appel téléphonique', 'Phone call'), onPress: () => Linking.openURL('tel:+' + d) },
      ]);
    }
    callUser(data[0].id, media);
  };

  const savePlan = async () => {
    const m = /^(\d{1,2})[:h.](\d{2})$/.exec((plan.time || '').trim());
    if (!m || +m[1] > 23 || +m[2] > 59) return Alert.alert(t('error'), L('Heure invalide. Exemple : 15:30', 'Invalid time. Example: 15:30'));
    const when = new Date();
    when.setDate(when.getDate() + plan.day);
    when.setHours(+m[1], +m[2], 0, 0);
    if (when.getTime() < Date.now()) return Alert.alert(t('error'), L('Choisissez une heure à venir.', 'Choose a future time.'));
    const { error } = await supabase.from('scheduled_calls').insert({
      conversation_id: plan.conv.id,
      created_by: userId,
      media: plan.media,
      title: plan.title.trim() || null,
      scheduled_at: when.toISOString(),
    });
    if (error) return Alert.alert(t('error'), errText(error));
    const hh = String(when.getHours()).padStart(2, '0') + ':' + String(when.getMinutes()).padStart(2, '0');
    await supabase.from('messages').insert({
      conversation_id: plan.conv.id,
      sender_id: userId,
      type: 'text',
      content: `📅 ${plan.media === 'video' ? L('Appel vidéo', 'Video call') : L('Appel vocal', 'Voice call')} ${L('planifié le', 'scheduled on')} ${dayLabel(when)} ${L('à', 'at')} ${hh}${plan.title.trim() ? ' — ' + plan.title.trim() : ''}`,
    });
    setPlan(null);
    setPicker(null);
    load();
  };

  const cancelPlanned = (p) =>
    Alert.alert(L('Annuler cet appel planifié ?', 'Cancel this scheduled call?'), '', [
      { text: t('cancel'), style: 'cancel' },
      { text: 'OK', onPress: async () => { await supabase.from('scheduled_calls').update({ status: 'cancelled' }).eq('id', p.id); load(); } },
    ]);

  const needle = (search || '').trim().toLowerCase();
  const shown = needle ? calls.filter((c) => String(peerOf(c).display_name || '').toLowerCase().includes(needle)) : calls;

  const Quick = ({ icon, label, onPress }) => (
    <Pressable onPress={onPress} style={{ alignItems: 'center', flex: 1 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.bgAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 26 }}>{icon}</Text>
      </View>
      <Text style={{ color: colors.textMuted, marginTop: 8, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );

  const PersonRow = ({ name, avatar, onCall, onPress, right }) => (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}>
      <Avatar uri={avatar} name={name} size={46} />
      <Title style={{ flex: 1, marginLeft: 12 }} numberOfLines={1}>{name}</Title>
      {right}
      {onCall ? (
        <>
          <Pressable onPress={() => onCall('video')} hitSlop={8} style={{ padding: 8 }}><Text style={{ fontSize: 22 }}>📹</Text></Pressable>
          <Pressable onPress={() => onCall('audio')} hitSlop={8} style={{ padding: 8 }}><Text style={{ fontSize: 22 }}>📞</Text></Pressable>
        </>
      ) : null}
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={shown}
        keyExtractor={(c) => c.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
        ListHeaderComponent={
          <>
            {search !== null ? (
              <View style={{ padding: 10 }}>
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  autoFocus
                  placeholder={L('Rechercher un appel', 'Search calls')}
                  placeholderTextColor={colors.textMuted}
                  style={{ backgroundColor: colors.bgAlt, color: colors.text, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 16 }}
                />
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8 }}>
              <Quick icon="📞" label={L('Appeler', 'Call')} onPress={() => openPicker('call')} />
              <Quick icon="📅" label={L('Planifier', 'Schedule')} onPress={() => openPicker('schedule')} />
              <Quick icon="🔢" label={L('Clavier', 'Keypad')} onPress={() => setDialOpen(true)} />
              <Quick icon="♡" label={L('Favoris', 'Favorites')} onPress={() => openPicker('favorites')} />
            </View>

            {planned.length ? (
              <>
                <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 }}>{L('Planifiés', 'Scheduled')}</Text>
                {planned.map((p) => {
                  const peer = peerOf(p);
                  const d = new Date(p.scheduled_at);
                  return (
                    <Pressable key={p.id} onLongPress={() => cancelPlanned(p)} onPress={() => recall(p, p.media)} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}>
                      <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: colors.chipActiveBg, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 22 }}>📅</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Title numberOfLines={1}>{p.title || peer.display_name}</Title>
                        <Muted numberOfLines={1}>
                          {p.title ? peer.display_name + ' · ' : ''}{dayLabel(d)} · {String(d.getHours()).padStart(2, '0')}:{String(d.getMinutes()).padStart(2, '0')}
                        </Muted>
                      </View>
                      <Text style={{ fontSize: 22 }}>{p.media === 'video' ? '📹' : '📞'}</Text>
                    </Pressable>
                  );
                })}
              </>
            ) : null}

            <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 }}>{L('Récents', 'Recent')}</Text>
          </>
        }
        ListEmptyComponent={!loading ? <Muted style={{ padding: 16 }}>{L('Aucun appel pour le moment. Touchez « Appeler » pour commencer.', 'No calls yet.')}</Muted> : null}
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

      <Pressable onPress={() => openPicker('call')} style={{ position: 'absolute', right: 18, bottom: 18, width: 60, height: 60, borderRadius: 18, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', elevation: 5 }}>
        <Text style={{ fontSize: 24, color: '#fff' }}>📞+</Text>
      </Pressable>

      {/* Choix d'une personne : appeler / planifier / favoris */}
      <Modal visible={!!picker && !plan} animationType="slide" onRequestClose={() => setPicker(null)}>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, padding: 16 }}>
            <Pressable onPress={() => setPicker(null)} style={{ paddingRight: 14 }}><Text style={{ color: '#fff', fontSize: 22 }}>←</Text></Pressable>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>
              {picker === 'schedule' ? L('Planifier un appel', 'Schedule a call') : picker === 'favorites' ? L('Favoris', 'Favorites') : L('Nouvel appel', 'New call')}
            </Text>
          </View>
          {picker === 'favorites' ? (
            <ScrollView>
              {favorites.map((f) => (
                <PersonRow key={f.id} name={f.display_name} avatar={avatarUri(f.profiles)} onCall={(m) => callUser(f.contact_user_id, m)} />
              ))}
              {!favorites.length ? (
                <Muted style={{ padding: 20 }}>{L('Aucun favori. Ajoutez-en dans Paramètres → Listes (★).', 'No favorites. Add some in Settings → Lists (★).')}</Muted>
              ) : null}
            </ScrollView>
          ) : (
            <ScrollView>
              {picker === 'schedule' ? <Muted style={{ padding: 16 }}>{L('Choisissez la personne à appeler :', 'Choose who to call:')}</Muted> : null}
              {people.map((c) => (
                <PersonRow
                  key={c.id}
                  name={c.name}
                  avatar={c.avatar}
                  onPress={picker === 'schedule' ? () => setPlan({ conv: c, day: 0, time: '', media: 'audio', title: '' }) : undefined}
                  onCall={picker === 'call' ? (m) => { setPicker(null); startCall(navigation, c, m, userId); } : null}
                  right={picker === 'schedule' ? <Text style={{ color: colors.primary, fontWeight: '700' }}>{L('Choisir', 'Select')}</Text> : null}
                />
              ))}
              {!people.length ? <Muted style={{ padding: 20 }}>{L('Commencez une discussion avec un contact inscrit pour pouvoir l’appeler.', 'Start a chat with a registered contact first.')}</Muted> : null}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Formulaire de planification */}
      <Modal visible={!!plan} transparent animationType="fade" onRequestClose={() => setPlan(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 }}>
          {plan ? (
            <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 18, gap: 12 }}>
              <Title style={{ fontSize: 18 }}>📅 {L('Appel avec', 'Call with')} {plan.conv.name}</Title>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[L("Aujourd'hui", 'Today'), L('Demain', 'Tomorrow'), L('Après-demain', 'In 2 days')].map((lbl, i) => (
                  <Pressable key={i} onPress={() => setPlan({ ...plan, day: i })} style={{ flex: 1, padding: 10, borderRadius: 10, alignItems: 'center', backgroundColor: plan.day === i ? colors.chipActiveBg : colors.bgAlt }}>
                    <Text style={{ color: plan.day === i ? colors.chipActiveText : colors.textMuted, fontWeight: '600', fontSize: 13 }}>{lbl}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={plan.time}
                onChangeText={(v) => setPlan({ ...plan, time: v })}
                placeholder={L('Heure (ex. 15:30)', 'Time (e.g. 15:30)')}
                placeholderTextColor={colors.textMuted}
                keyboardType="numbers-and-punctuation"
                style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, color: colors.text, fontSize: 16 }}
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[['audio', '📞 ' + L('Vocal', 'Voice')], ['video', '📹 ' + L('Vidéo', 'Video')]].map(([k, lbl]) => (
                  <Pressable key={k} onPress={() => setPlan({ ...plan, media: k })} style={{ flex: 1, padding: 10, borderRadius: 10, alignItems: 'center', backgroundColor: plan.media === k ? colors.chipActiveBg : colors.bgAlt }}>
                    <Text style={{ color: plan.media === k ? colors.chipActiveText : colors.textMuted, fontWeight: '600' }}>{lbl}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={plan.title}
                onChangeText={(v) => setPlan({ ...plan, title: v })}
                placeholder={L('Objet (facultatif)', 'Subject (optional)')}
                placeholderTextColor={colors.textMuted}
                style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, color: colors.text, fontSize: 16 }}
              />
              <Button title={L('Planifier', 'Schedule')} onPress={savePlan} />
              <Button title={t('cancel')} variant="ghost" onPress={() => setPlan(null)} />
            </View>
          ) : null}
        </View>
      </Modal>

      {/* Clavier */}
      <Modal visible={dialOpen} animationType="slide" onRequestClose={() => setDialOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.bg, padding: 20, justifyContent: 'flex-end' }}>
          <Pressable onPress={() => setDialOpen(false)} style={{ position: 'absolute', top: 20, left: 20 }}><Text style={{ fontSize: 24, color: colors.text }}>←</Text></Pressable>
          <Text style={{ color: colors.text, fontSize: 34, textAlign: 'center', marginBottom: 24, minHeight: 44 }} numberOfLines={1} adjustsFontSizeToFit>{dial}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 }}>
            {KEYS.map((k) => (
              <Pressable
                key={k}
                onPress={() => setDial((d) => (k === '⌫' ? d.slice(0, -1) : (d + k).slice(0, 16)))}
                onLongPress={() => k === '⌫' && setDial('')}
                style={({ pressed }) => ({ width: '31%', height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? colors.chipActiveBg : colors.bgAlt })}
              >
                <Text style={{ color: colors.text, fontSize: 28 }}>{k}</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 22, marginBottom: 10 }}>
            <Pressable onPress={() => dialUnichat('audio')} style={{ flex: 1, backgroundColor: colors.brand, borderRadius: 30, paddingVertical: 16, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>📞 Unichat +</Text>
            </Pressable>
            <Pressable onPress={() => dialUnichat('video')} style={{ flex: 1, backgroundColor: colors.brand, borderRadius: 30, paddingVertical: 16, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>📹 Unichat +</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => dial && Linking.openURL('tel:' + dial)} style={{ borderWidth: 1, borderColor: colors.primary, borderRadius: 30, paddingVertical: 14, alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>{L('Appel téléphonique (réseau)', 'Phone call (carrier)')}</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}
