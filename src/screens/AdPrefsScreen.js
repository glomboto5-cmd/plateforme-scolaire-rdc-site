import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { supabase, errText } from '../lib/supabase';
import { L, t } from '../lib/i18n';
import { useApp } from '../AppContext';
import { Button, Muted, SectionTitle } from '../components/ui';
import { INTERESTS } from '../lib/ads';

// Préférences publicitaires : le ciblage par centres d'intérêt n'a lieu qu'avec l'accord explicite de l'utilisateur
export default function AdPrefsScreen() {
  const { colors, userId } = useApp();
  const [pers, setPers] = useState(false);
  const [interests, setInterests] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from('ad_preferences').select('*').eq('user_id', userId).maybeSingle().then(({ data }) => {
      if (data) { setPers(data.personalized); setInterests(data.interests || []); }
    });
  }, [userId]);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from('ad_preferences').upsert({ user_id: userId, personalized: pers, interests: pers ? interests : [], updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) return Alert.alert(t('error'), errText(error));
    Alert.alert(L('Enregistré', 'Saved'));
  };

  const toggle = (c) => setInterests((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <View style={{ padding: 14, borderRadius: 14, backgroundColor: colors.chipActiveBg }}>
        <Text style={{ color: colors.chipActiveText, fontWeight: '700', marginBottom: 4 }}>🔒 {L('Vos conversations restent privées', 'Your conversations stay private')}</Text>
        <Text style={{ color: colors.chipActiveText }}>
          {L(
            "Ange chat + n'affiche jamais de publicité dans vos discussions privées ni pendant vos appels audio et vidéo. Le contenu de vos messages, vos contacts et vos appels ne sont jamais utilisés pour la publicité. Les publicités apparaissent seulement dans les statuts, les chaînes, le fil d'actualité, Découvrir et la recherche.",
            'No ads in private chats or calls; message content is never used for ads.'
          )}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600' }}>{L('Publicités personnalisées', 'Personalized ads')}</Text>
          <Muted>{L("J'accepte de voir des publicités selon les centres d'intérêt que je choisis ci-dessous.", 'Show ads based on the interests I choose below.')}</Muted>
        </View>
        <Switch value={pers} onValueChange={setPers} />
      </View>

      {pers ? (
        <>
          <SectionTitle>{L("Mes centres d'intérêt", 'My interests')}</SectionTitle>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {INTERESTS.map((i) => {
              const on = interests.includes(i.code);
              return (
                <Pressable key={i.code} onPress={() => toggle(i.code)} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: on ? colors.chipActiveBg : colors.bgAlt }}>
                  <Text style={{ color: on ? colors.chipActiveText : colors.text }}>{on ? '✓ ' : ''}{i.label()}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : (
        <Muted>{L('Désactivé : vous verrez des publicités générales, éventuellement adaptées à votre pays et à la langue de l’application.', 'Off: you see general ads, possibly by country and language.')}</Muted>
      )}
      <Muted style={{ fontSize: 12 }}>{L('Aucune donnée sensible (santé, religion, opinions, origine…) n’est utilisée.', 'No sensitive data is used.')}</Muted>
      <Button title={L('Enregistrer', 'Save')} onPress={save} loading={busy} />
    </ScrollView>
  );
}
