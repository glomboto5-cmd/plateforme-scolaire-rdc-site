import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { supabase, errText } from '../lib/supabase';
import { L, t } from '../lib/i18n';
import { useApp } from '../AppContext';
import { Button, Input, Muted } from '../components/ui';
import { shareEvent } from './EventScreen';

function parseDate(dateStr, timeStr) {
  const d = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec((dateStr || '').trim());
  const h = /^(\d{1,2})[:h.](\d{2})$/.exec((timeStr || '').trim());
  if (!d || !h) return null;
  const when = new Date(+d[3], +d[2] - 1, +d[1], +h[1], +h[2], 0, 0);
  return isNaN(when.getTime()) || when.getDate() !== +d[1] ? null : when;
}
const fmtDate = (d) => String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
const fmtTime = (d) => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');

export default function EventEditScreen({ route, navigation }) {
  const id = route.params && route.params.id;
  const conversationId = (route.params && route.params.conversationId) || null;
  const { colors, userId } = useApp();
  const tomorrow = new Date(Date.now() + 86400000);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(fmtDate(tomorrow));
  const [time, setTime] = useState('18:00');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: id ? L("Modifier l'événement", 'Edit event') : L('Créer un événement', 'Create event') });
    if (!id) return;
    supabase.from('events').select('*').eq('id', id).single().then(({ data }) => {
      if (!data) return;
      const s = new Date(data.starts_at);
      setTitle(data.title);
      setDescription(data.description || '');
      setDate(fmtDate(s));
      setTime(fmtTime(s));
      setEndTime(data.ends_at ? fmtTime(new Date(data.ends_at)) : '');
      setLocation(data.location || '');
      setLink(data.online_link || '');
    });
  }, [id]);

  const quick = (days) => setDate(fmtDate(new Date(Date.now() + days * 86400000)));

  const save = async () => {
    if (!title.trim()) return Alert.alert(t('error'), L('Le nom de l’événement est obligatoire', 'Event name is required'));
    const start = parseDate(date, time);
    if (!start) return Alert.alert(t('error'), L('Date ou heure invalide (ex. 25/12/2026 et 18:00)', 'Invalid date or time'));
    let end = null;
    if (endTime.trim()) {
      end = parseDate(date, endTime);
      if (!end) return Alert.alert(t('error'), L('Heure de fin invalide', 'Invalid end time'));
      if (end <= start) end = new Date(end.getTime() + 86400000);
    }
    const url = link.trim() && !/^https?:\/\//i.test(link.trim()) ? 'https://' + link.trim() : link.trim();
    setBusy(true);
    const row = {
      title: title.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      online_link: url || null,
      starts_at: start.toISOString(),
      ends_at: end ? end.toISOString() : null,
    };
    const res = id
      ? await supabase.from('events').update(row).eq('id', id).select('*').single()
      : await supabase.from('events').insert({ ...row, created_by: userId, conversation_id: conversationId }).select('*').single();
    setBusy(false);
    if (res.error) return Alert.alert(t('error'), errText(res.error));
    if (!id && conversationId) {
      await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: userId, type: 'text', content: `📅 ${row.title} — ${date} ${time}${row.location ? ' · ' + row.location : ''}\nunichatplus://event/${res.data.code}` });
    }
    navigation.replace('Event', { id: res.data.id });
    if (!id) setTimeout(() => shareEvent(res.data), 400);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Input placeholder={L("Nom de l'événement", 'Event name')} value={title} onChangeText={setTitle} autoFocus={!id} />
      <Input placeholder={L('Description (facultatif)', 'Description (optional)')} value={description} onChangeText={setDescription} multiline style={{ minHeight: 70, textAlignVertical: 'top' }} />
      <Muted>{L('Date', 'Date')}</Muted>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[[0, L("Aujourd'hui", 'Today')], [1, L('Demain', 'Tomorrow')], [7, L('Dans 7 jours', 'In 7 days')]].map(([d, lbl]) => (
          <Pressable key={d} onPress={() => quick(d)} style={{ flex: 1, padding: 10, borderRadius: 10, alignItems: 'center', backgroundColor: date === fmtDate(new Date(Date.now() + d * 86400000)) ? colors.chipActiveBg : colors.bgAlt }}>
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{lbl}</Text>
          </Pressable>
        ))}
      </View>
      <Input placeholder="JJ/MM/AAAA" value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Input placeholder={L('Début (18:00)', 'Start (18:00)')} value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation" style={{ flex: 1 }} />
        <Input placeholder={L('Fin (facultatif)', 'End (optional)')} value={endTime} onChangeText={setEndTime} keyboardType="numbers-and-punctuation" style={{ flex: 1 }} />
      </View>
      <Input placeholder={L('Lieu (facultatif)', 'Location (optional)')} value={location} onChangeText={setLocation} />
      <Input placeholder={L('Lien de visioconférence (facultatif)', 'Video link (optional)')} value={link} onChangeText={setLink} autoCapitalize="none" keyboardType="url" />
      <Button title={id ? t('save') : L("Créer et partager l'événement", 'Create and share')} onPress={save} loading={busy} />
    </ScrollView>
  );
}
