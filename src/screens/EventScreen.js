import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { supabase, errText } from '../lib/supabase';
import { L, t } from '../lib/i18n';
import { useApp } from '../AppContext';
import { Avatar, Button, Muted, Title } from '../components/ui';
import { avatarUri } from '../lib/chat';

const APK = 'https://github.com/glomboto5-cmd/plateforme-scolaire-rdc-site/releases/download/unichat-apk/unichat-plus-leger.apk';

export function eventWhen(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) + ' · ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

export function shareEvent(e) {
  return Share.share({
    message:
      `📅 ${e.title}\n🕒 ${eventWhen(e.starts_at)}` +
      (e.location ? `\n📍 ${e.location}` : '') +
      (e.online_link ? `\n🔗 ${e.online_link}` : '') +
      (e.description ? `\n\n${e.description}` : '') +
      `\n\n${L('Répondre sur Angechat', 'RSVP on Angechat')} : unichatplus://event/${e.code}\n${L('Code', 'Code')} : ${e.code}\n${L("Pas encore l'application ?", 'No app yet?')} ${APK}`,
  });
}

export default function EventScreen({ route, navigation }) {
  const { id, code } = route.params || {};
  const { colors, userId } = useApp();
  const [e, setE] = useState(null);
  const [resp, setResp] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (id) {
      const { data } = await supabase.from('events').select('*, organizer:profiles!events_created_by_fkey(display_name,avatar_url)').eq('id', id).maybeSingle();
      setE(data);
      const { data: r } = await supabase.from('event_responses').select('response,user_id,profiles!event_responses_user_id_fkey(display_name,avatar_url)').eq('event_id', id);
      setResp(r || []);
    } else if (code) {
      const { data } = await supabase.rpc('event_by_code', { p_code: code });
      const ev = data && data[0];
      setE(ev ? { ...ev, code, organizer: { display_name: ev.organizer }, external: true } : null);
    }
  }, [id, code]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { navigation.setOptions({ title: L('Événement', 'Event') }); }, []);

  if (!e) return <View style={{ flex: 1, backgroundColor: colors.bg, padding: 20 }}><Muted>{L('Chargement…', 'Loading…')}</Muted></View>;

  const mine = resp.find((r) => r.user_id === userId);
  const isOwner = e.created_by === userId;
  const going = e.external ? e.going : resp.filter((r) => r.response === 'going').length;

  const answer = async (response) => {
    setBusy(true);
    const { data, error } = await supabase.rpc('respond_event_by_code', { p_code: e.code, p_response: response });
    setBusy(false);
    if (error) return Alert.alert(t('error'), errText(error));
    if (e.external) navigation.replace('Event', { id: data });
    else load();
  };

  const cancel = () =>
    Alert.alert(L("Annuler l'événement ?", 'Cancel event?'), '', [
      { text: t('cancel'), style: 'cancel' },
      { text: 'OK', onPress: async () => { await supabase.from('events').update({ is_cancelled: true }).eq('id', e.id); load(); } },
    ]);

  const Choice = ({ value, label }) => (
    <Pressable onPress={() => answer(value)} disabled={busy} style={{ flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: mine && mine.response === value ? colors.chipActiveBg : colors.bgAlt }}>
      <Text style={{ color: mine && mine.response === value ? colors.chipActiveText : colors.text, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 40 }}>
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Text style={{ fontSize: 56 }}>📅</Text>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: '700', textAlign: 'center', textDecorationLine: e.is_cancelled ? 'line-through' : 'none' }}>{e.title}</Text>
        {e.is_cancelled ? <Text style={{ color: colors.danger, fontWeight: '700' }}>{L('Événement annulé', 'Event cancelled')}</Text> : null}
      </View>
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.text, fontSize: 16 }}>🕒 {eventWhen(e.starts_at)}{e.ends_at ? ' → ' + eventWhen(e.ends_at) : ''}</Text>
        {e.location ? <Text style={{ color: colors.text, fontSize: 16 }}>📍 {e.location}</Text> : null}
        {e.online_link ? <Text onPress={() => Linking.openURL(e.online_link)} style={{ color: colors.accent, fontSize: 16 }}>🔗 {e.online_link}</Text> : null}
        <Text style={{ color: colors.text, fontSize: 16 }}>👤 {L('Organisé par', 'Hosted by')} {e.organizer ? e.organizer.display_name : '?'}</Text>
        <Text style={{ color: colors.text, fontSize: 16 }}>✅ {going} {L('participant(s)', 'going')}</Text>
      </View>
      {e.description ? <Text style={{ color: colors.text, fontSize: 16, lineHeight: 22 }}>{e.description}</Text> : null}

      {!isOwner && !e.is_cancelled ? (
        <>
          <Title>{L('Votre réponse', 'Your answer')}</Title>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Choice value="going" label={'✅ ' + L('Je viens', 'Going')} />
            <Choice value="maybe" label={'❔ ' + L('Peut-être', 'Maybe')} />
            <Choice value="not_going" label={'✖️ ' + L('Non', 'No')} />
          </View>
        </>
      ) : null}

      {!e.external ? <Button title={'🔗 ' + L("Partager le lien de l'événement", 'Share event link')} onPress={() => shareEvent(e)} /> : null}
      {isOwner && !e.is_cancelled ? (
        <>
          <Button title={'✏️ ' + L('Modifier', 'Edit')} variant="ghost" onPress={() => navigation.navigate('EventEdit', { id: e.id })} />
          <Button title={L("Annuler l'événement", 'Cancel event')} variant="danger" onPress={cancel} />
        </>
      ) : null}

      {resp.length ? (
        <>
          <Title style={{ marginTop: 8 }}>{L('Réponses', 'Responses')}</Title>
          {resp.map((r) => (
            <View key={r.user_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar uri={avatarUri(r.profiles)} name={r.profiles && r.profiles.display_name} size={40} />
              <Text style={{ color: colors.text, flex: 1 }}>{r.profiles ? r.profiles.display_name : '?'}</Text>
              <Text>{r.response === 'going' ? '✅' : r.response === 'maybe' ? '❔' : '✖️'}</Text>
            </View>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}
