import React, { useCallback, useState } from 'react';
import { FlatList, Modal, Pressable, RefreshControl, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { L } from '../lib/i18n';
import { useApp } from '../AppContext';
import { Button, Muted, Title } from '../components/ui';
import { eventWhen } from './EventScreen';

const INTRO_KEY = 'unichat.eventsIntroSeen';

// Écran d'accueil des événements (comme WhatsApp)
export function EventsIntro({ visible, onContinue, onClose, colors }) {
  const Line = ({ icon, title, text }) => (
    <View style={{ flexDirection: 'row', gap: 16, marginTop: 18 }}>
      <Text style={{ fontSize: 26, width: 34, textAlign: 'center' }}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 17 }}>{title}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 15, marginTop: 2 }}>{text}</Text>
      </View>
    </View>
  );
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
        <Pressable style={{ backgroundColor: colors.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 24, paddingBottom: 34 }}>
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 18 }} />
          <Text style={{ fontSize: 70, textAlign: 'center' }}>📅</Text>
          <Text style={{ color: colors.text, fontSize: 26, textAlign: 'center', marginTop: 10 }}>{L('Événements que vous pouvez partager avec tout le monde', 'Events you can share with anyone')}</Text>
          <Line icon="🔗" title={L('Obtenez un lien à partager', 'Get a link to share')} text={L("Envoyez une invitation aux personnes invitées, même si elles ne sont pas sur Angechat.", 'Invite people even if they are not on Angechat.')} />
          <Line icon="🗓️" title={L('Tout se fait au même endroit', 'All in one place')} text={L('Trouvez les événements que vous organisez ou auxquels vous êtes invité·e dans Événements.', 'Find your events in Events.')} />
          <Muted style={{ textAlign: 'center', marginTop: 22, fontSize: 13 }}>
            {L("Les invité·es peuvent voir les informations de l'événement. Vos messages et appels personnels restent privés.", 'Guests can see event details.')}
          </Muted>
          <Button title={L('Continuer', 'Continue')} onPress={onContinue} style={{ marginTop: 18, borderRadius: 30 }} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export async function openNewEvent(navigation, setIntro, params) {
  let seen = null;
  try { seen = await AsyncStorage.getItem(INTRO_KEY); } catch (e) {}
  if (seen) return navigation.navigate('EventEdit', params || {});
  setIntro(true);
}
export async function markIntroSeen() {
  try { await AsyncStorage.setItem(INTRO_KEY, '1'); } catch (e) {}
}

export default function EventsScreen({ navigation }) {
  const { colors, userId } = useApp();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [intro, setIntro] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('events')
      .select('id,title,location,starts_at,is_cancelled,created_by,event_responses(user_id,response)')
      .order('starts_at', { ascending: true })
      .limit(200);
    setItems(data || []);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const now = Date.now();
  const upcoming = items.filter((e) => new Date(e.starts_at).getTime() > now - 6 * 3600000);
  const past = items.filter((e) => new Date(e.starts_at).getTime() <= now - 6 * 3600000).reverse();
  const rows = [
    ...(upcoming.length ? [{ h: L('À venir', 'Upcoming') }] : []),
    ...upcoming,
    ...(past.length ? [{ h: L('Passés', 'Past') }] : []),
    ...past,
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={rows}
        keyExtractor={(r, i) => r.id || 'h' + i}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={
          !loading ? (
            <View style={{ padding: 24 }}>
              <Text style={{ fontSize: 70, textAlign: 'center' }}>📅</Text>
              <Text style={{ color: colors.text, fontSize: 24, textAlign: 'center', marginTop: 10 }}>{L('Événements que vous pouvez partager avec tout le monde', 'Events you can share with anyone')}</Text>
              {[
                ['🔗', L('Obtenez un lien à partager', 'Get a link to share'), L('Envoyez une invitation aux personnes invitées, même si elles ne sont pas sur Angechat.', 'Invite people even if they are not on Angechat.')],
                ['🗓️', L('Tout se fait au même endroit', 'All in one place'), L('Trouvez les événements que vous organisez ou auxquels vous êtes invité·e dans Événements.', 'Find your events in Events.')],
              ].map(([icon, title, text]) => (
                <View key={icon} style={{ flexDirection: 'row', gap: 16, marginTop: 18 }}>
                  <Text style={{ fontSize: 26, width: 34, textAlign: 'center' }}>{icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 17 }}>{title}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 15, marginTop: 2 }}>{text}</Text>
                  </View>
                </View>
              ))}
              <Muted style={{ textAlign: 'center', marginTop: 22, fontSize: 13 }}>{L("Les invité·es peuvent voir les informations de l'événement. Vos messages et appels personnels restent privés.", 'Guests can see event details.')}</Muted>
              <Button title={L('Créer un événement', 'Create an event')} onPress={async () => { await markIntroSeen(); navigation.navigate('EventEdit', {}); }} style={{ marginTop: 18, borderRadius: 30 }} />
            </View>
          ) : null
        }
        renderItem={({ item: e }) => {
          if (e.h) return <Text style={{ color: colors.textMuted, fontSize: 15, fontWeight: '600', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 }}>{e.h}</Text>;
          const mine = (e.event_responses || []).find((r) => r.user_id === userId);
          const going = (e.event_responses || []).filter((r) => r.response === 'going').length;
          return (
            <Pressable onPress={() => navigation.navigate('Event', { id: e.id })} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
              <View style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: colors.chipActiveBg, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: colors.chipActiveText, fontWeight: '800', fontSize: 18 }}>{new Date(e.starts_at).getDate()}</Text>
                <Text style={{ color: colors.chipActiveText, fontSize: 11 }}>{new Date(e.starts_at).toLocaleDateString(undefined, { month: 'short' })}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Title numberOfLines={1} style={{ textDecorationLine: e.is_cancelled ? 'line-through' : 'none' }}>{e.title}</Title>
                <Muted numberOfLines={1}>{eventWhen(e.starts_at)}{e.location ? ' · ' + e.location : ''}</Muted>
                <Muted style={{ fontSize: 12 }}>
                  {e.created_by === userId ? L('Organisateur', 'Organizer') + ' · ' : mine ? (mine.response === 'going' ? '✅ ' : mine.response === 'maybe' ? '❔ ' : '✖️ ') : ''}
                  {going} {L('participant(s)', 'going')}
                </Muted>
              </View>
            </Pressable>
          );
        }}
      />
      <Pressable onPress={() => openNewEvent(navigation, setIntro)} style={{ position: 'absolute', right: 18, bottom: 22, width: 60, height: 60, borderRadius: 18, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', elevation: 5 }}>
        <Text style={{ color: '#fff', fontSize: 30 }}>＋</Text>
      </Pressable>
      <EventsIntro
        visible={intro}
        colors={colors}
        onClose={() => setIntro(false)}
        onContinue={async () => { await markIntroSeen(); setIntro(false); navigation.navigate('EventEdit', {}); }}
      />
    </View>
  );
}
