import React, { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase, errText } from '../lib/supabase';
import { L, t } from '../lib/i18n';
import { useApp } from '../AppContext';
import { Button, Muted, Title } from '../components/ui';

const KINDS = [
  { key: 'welcome', icon: '👋', fr: 'Message de bienvenue', en: 'Greeting message', hintFr: 'Envoyé automatiquement au premier message d’une personne.', hintEn: 'Sent on a person’s first message.' },
  { key: 'away', icon: '🌙', fr: "Message d'absence", en: 'Away message', hintFr: 'Envoyé quand vous n’êtes pas disponible (selon vos horaires).', hintEn: 'Sent outside your hours.' },
  { key: 'keyword', icon: '🔑', fr: 'Réponses par mots-clés', en: 'Keyword replies', hintFr: 'Réponse automatique quand un message contient un mot (ex. prix, adresse).', hintEn: 'Auto-reply when a message contains a word.' },
  { key: 'quick_reply', icon: '⚡', fr: 'Réponses rapides', en: 'Quick replies', hintFr: 'Tapez « / » dans une discussion pour insérer une réponse enregistrée.', hintEn: 'Type “/” in a chat to insert a saved reply.' },
];
const DAYS = [[1, 'Lu'], [2, 'Ma'], [3, 'Me'], [4, 'Je'], [5, 'Ve'], [6, 'Sa'], [7, 'Di']];
const AUDIENCE = () => [
  ['everyone', L('Tout le monde', 'Everyone')],
  ['non_contacts', L('Personnes hors de mes contacts', 'Non-contacts')],
  ['customers', L('Mes clients', 'My customers')],
];

// Défini hors du composant pour que le clavier ne se ferme pas à chaque lettre
function Field(props) {
  const { colors } = useApp();
  return (
    <TextInput placeholderTextColor={colors.textMuted} {...props} style={[{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, color: colors.text, fontSize: 16, backgroundColor: colors.card }, props.style]} />
  );
}

export default function AutomationScreen() {
  const { colors, userId } = useApp();
  const [items, setItems] = useState([]);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('auto_replies').select('*').eq('user_id', userId).order('created_at');
    setItems(data || []);
  }, [userId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const open = (kind, row) =>
    setEdit(
      row
        ? { ...row, keywordsText: (row.keywords || []).join(', '), schedule: row.schedule || { always: true } }
        : { kind, response: '', shortcut: '', keywordsText: '', audience: 'everyone', is_active: true, schedule: { always: true } }
    );

  const save = async () => {
    const e = edit;
    if (!e.response.trim()) return Alert.alert(t('error'), L('Écrivez le message', 'Write the message'));
    if (e.kind === 'quick_reply' && !e.shortcut.trim()) return Alert.alert(t('error'), L('Indiquez un raccourci, ex. merci', 'Enter a shortcut'));
    const keywords = e.keywordsText.split(',').map((x) => x.trim()).filter(Boolean);
    if (e.kind === 'keyword' && !keywords.length) return Alert.alert(t('error'), L('Ajoutez au moins un mot-clé', 'Add at least one keyword'));
    if (e.kind === 'away' && !e.schedule.always && !(/^\d{1,2}:\d{2}$/.test(e.schedule.start || '') && /^\d{1,2}:\d{2}$/.test(e.schedule.end || ''))) {
      return Alert.alert(t('error'), L('Horaires invalides. Exemple : 18:00 à 08:00', 'Invalid hours'));
    }
    const row = {
      user_id: userId,
      kind: e.kind,
      response: e.response.trim(),
      shortcut: e.kind === 'quick_reply' ? e.shortcut.trim().replace(/^\//, '').toLowerCase() : null,
      keywords: e.kind === 'keyword' ? keywords : [],
      audience: e.audience,
      is_active: e.is_active,
      schedule: e.kind === 'away' ? { ...e.schedule, tz: 'Africa/Kinshasa' } : null,
    };
    setBusy(true);
    const { error } = e.id ? await supabase.from('auto_replies').update(row).eq('id', e.id) : await supabase.from('auto_replies').insert(row);
    setBusy(false);
    if (error) return Alert.alert(t('error'), errText(error));
    setEdit(null);
    load();
  };

  const remove = async () => {
    await supabase.from('auto_replies').delete().eq('id', edit.id);
    setEdit(null);
    load();
  };

  const toggle = async (r, v) => {
    setItems((x) => x.map((i) => (i.id === r.id ? { ...i, is_active: v } : i)));
    await supabase.from('auto_replies').update({ is_active: v }).eq('id', r.id);
  };

  const Chip = ({ on, label, onPress }) => (
    <Pressable onPress={onPress} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: on ? colors.chipActiveBg : colors.bgAlt }}>
      <Text style={{ color: on ? colors.chipActiveText : colors.textMuted, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bgAlt }} contentContainerStyle={{ paddingBottom: 40 }}>
      <Muted style={{ padding: 16 }}>
        {L(
          'Les réponses automatiques sont envoyées par le serveur Angechat +, même quand votre téléphone est éteint. Elles fonctionnent dans les discussions privées (personnelles et commerciales).',
          'Auto-replies are sent by the server, even when your phone is off.'
        )}
      </Muted>
      {KINDS.map((k) => {
        const list = items.filter((i) => i.kind === k.key);
        return (
          <View key={k.key} style={{ backgroundColor: colors.bg, marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
              <Text style={{ fontSize: 26, width: 40 }}>{k.icon}</Text>
              <View style={{ flex: 1 }}>
                <Title>{L(k.fr, k.en)}</Title>
                <Muted>{L(k.hintFr, k.hintEn)}</Muted>
              </View>
            </View>
            {list.map((r) => (
              <Pressable key={r.id} onPress={() => open(k.key, r)} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: colors.border }}>
                <View style={{ flex: 1 }}>
                  {r.kind === 'quick_reply' ? <Text style={{ color: colors.primary, fontWeight: '700' }}>/{r.shortcut}</Text> : null}
                  {r.kind === 'keyword' ? <Text style={{ color: colors.primary, fontWeight: '700' }}>{(r.keywords || []).join(', ')}</Text> : null}
                  {r.kind === 'away' ? (
                    <Text style={{ color: colors.primary, fontWeight: '700' }}>
                      {r.schedule && !r.schedule.always ? `${r.schedule.start} → ${r.schedule.end}` : L('Toujours', 'Always')}
                    </Text>
                  ) : null}
                  <Text style={{ color: colors.text }} numberOfLines={2}>{r.response}</Text>
                </View>
                {r.kind !== 'quick_reply' ? <Switch value={r.is_active} onValueChange={(v) => toggle(r, v)} trackColor={{ true: colors.primary }} /> : null}
              </Pressable>
            ))}
            {(k.key === 'keyword' || k.key === 'quick_reply' || !list.length) ? (
              <Pressable onPress={() => open(k.key)} style={{ padding: 14, borderTopWidth: 0.5, borderTopColor: colors.border }}>
                <Text style={{ color: colors.primary, fontWeight: '700' }}>＋ {L('Ajouter', 'Add')}</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}

      <Modal visible={!!edit} animationType="slide" onRequestClose={() => setEdit(null)}>
        {edit ? (
          <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 18, gap: 12 }} keyboardShouldPersistTaps="handled">
            <Title style={{ fontSize: 20 }}>{(KINDS.find((k) => k.key === edit.kind) || {}).icon} {L((KINDS.find((k) => k.key === edit.kind) || {}).fr, (KINDS.find((k) => k.key === edit.kind) || {}).en)}</Title>
            {edit.kind === 'quick_reply' ? (
              <Field placeholder={L('Raccourci (ex. merci) → /merci', 'Shortcut (e.g. thanks)')} value={edit.shortcut} onChangeText={(v) => setEdit({ ...edit, shortcut: v })} autoCapitalize="none" />
            ) : null}
            {edit.kind === 'keyword' ? (
              <Field placeholder={L('Mots-clés séparés par des virgules (ex. prix, tarif, combien)', 'Keywords, comma separated')} value={edit.keywordsText} onChangeText={(v) => setEdit({ ...edit, keywordsText: v })} autoCapitalize="none" />
            ) : null}
            <Field placeholder={L('Message envoyé', 'Message')} value={edit.response} onChangeText={(v) => setEdit({ ...edit, response: v })} multiline style={{ minHeight: 110, textAlignVertical: 'top' }} />

            {edit.kind === 'away' ? (
              <>
                <Muted>{L('Quand envoyer ?', 'When?')}</Muted>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Chip on={edit.schedule.always} label={L('Toujours', 'Always')} onPress={() => setEdit({ ...edit, schedule: { always: true } })} />
                  <Chip on={!edit.schedule.always} label={L('En dehors des horaires', 'Outside hours')} onPress={() => setEdit({ ...edit, schedule: { always: false, start: '18:00', end: '08:00', days: [] } })} />
                </View>
                {!edit.schedule.always ? (
                  <>
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      <Field placeholder="18:00" value={edit.schedule.start} onChangeText={(v) => setEdit({ ...edit, schedule: { ...edit.schedule, start: v } })} style={{ flex: 1 }} keyboardType="numbers-and-punctuation" />
                      <Text style={{ color: colors.text }}>→</Text>
                      <Field placeholder="08:00" value={edit.schedule.end} onChangeText={(v) => setEdit({ ...edit, schedule: { ...edit.schedule, end: v } })} style={{ flex: 1 }} keyboardType="numbers-and-punctuation" />
                    </View>
                    <Muted>{L('Jours (aucun = tous les jours)', 'Days (none = every day)')}</Muted>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {DAYS.map(([d, lbl]) => {
                        const on = (edit.schedule.days || []).includes(d);
                        return (
                          <Chip key={d} on={on} label={lbl} onPress={() => setEdit({ ...edit, schedule: { ...edit.schedule, days: on ? edit.schedule.days.filter((x) => x !== d) : [...(edit.schedule.days || []), d] } })} />
                        );
                      })}
                    </View>
                  </>
                ) : null}
              </>
            ) : null}

            {edit.kind !== 'quick_reply' ? (
              <>
                <Muted>{L('À qui ?', 'To whom?')}</Muted>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {AUDIENCE().map(([k, lbl]) => <Chip key={k} on={edit.audience === k} label={lbl} onPress={() => setEdit({ ...edit, audience: k })} />)}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Title style={{ flex: 1, fontWeight: '400' }}>{L('Activé', 'Enabled')}</Title>
                  <Switch value={edit.is_active} onValueChange={(v) => setEdit({ ...edit, is_active: v })} trackColor={{ true: colors.primary }} />
                </View>
              </>
            ) : null}

            <Button title={t('save')} onPress={save} loading={busy} />
            {edit.id ? <Button title={L('Supprimer', 'Delete')} variant="danger" onPress={remove} /> : null}
            <Button title={t('cancel')} variant="ghost" onPress={() => setEdit(null)} />
          </ScrollView>
        ) : null}
      </Modal>
    </ScrollView>
  );
}
