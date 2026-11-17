import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase, errText } from '../lib/supabase';
import { L, t } from '../lib/i18n';
import { useApp } from '../AppContext';
import { Button, Input, Muted, SectionTitle } from '../components/ui';
import { money, PAY_METHODS } from '../lib/ads';

// Services payants pour les entreprises (la messagerie reste gratuite pour les particuliers)
export default function BusinessPlansScreen() {
  const { colors, userId } = useApp();
  const [plans, setPlans] = useState([]);
  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState([]);
  const [settings, setSettings] = useState(null);
  const [chosen, setChosen] = useState(null);
  const [months, setMonths] = useState(1);
  const [method, setMethod] = useState('mpesa');
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [{ data: p }, { data: cur }, { data: h }, { data: st }] = await Promise.all([
      supabase.from('business_plans').select('*').eq('is_active', true).order('sort'),
      supabase.rpc('my_business_plan'),
      supabase.from('business_subscriptions').select('*, plan:business_plans(name)').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
      supabase.from('ad_settings').select('payment_instructions').eq('id', 1).maybeSingle(),
    ]);
    setPlans(p || []); setCurrent(cur && cur[0]); setHistory(h || []); setSettings(st);
  }, [userId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const subscribe = async () => {
    if (!chosen || ref.trim().length < 3) return Alert.alert(L('Abonnement', 'Subscription'), L('Choisissez une offre et indiquez la référence du paiement.', 'Choose a plan and enter the payment reference.'));
    setBusy(true);
    const { error } = await supabase.from('business_subscriptions').insert({ user_id: userId, plan_code: chosen.code, months, amount: Number(chosen.price_month) * months, currency: chosen.currency, method, reference: ref.trim() });
    setBusy(false);
    if (error) return Alert.alert(t('error'), errText(error));
    setRef(''); setChosen(null);
    Alert.alert(L('Merci', 'Thank you'), L('Votre demande est enregistrée. L’abonnement sera activé dès la vérification du paiement.', 'Request saved; it will be activated once payment is verified.'));
    load();
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 50 }} keyboardShouldPersistTaps="handled">
      <View style={{ padding: 14, borderRadius: 14, backgroundColor: colors.chipActiveBg }}>
        <Text style={{ color: colors.chipActiveText, fontWeight: '700' }}>
          {current ? '⭐ ' + current.plan_name + ' · ' + L("actif jusqu'au ", 'active until ') + new Date(current.ends_at).toLocaleDateString('fr-FR') : '💬 ' + L('Messagerie gratuite pour les particuliers', 'Free messaging for individuals')}
        </Text>
        <Text style={{ color: colors.chipActiveText, marginTop: 4 }}>
          {L('Les offres Pro ajoutent des outils pour les entreprises et les commerces. Discussions, appels, groupes et statuts restent gratuits pour tous.', 'Pro plans add business tools. Chats, calls, groups and status stay free.')}
        </Text>
      </View>

      {plans.map((p) => {
        const on = chosen && chosen.code === p.code;
        return (
          <Pressable key={p.code} onPress={() => setChosen(p)} style={{ borderRadius: 16, padding: 16, borderWidth: 2, borderColor: on ? colors.brand : colors.border, backgroundColor: colors.card }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800', flex: 1 }}>{p.name}</Text>
              <Text style={{ color: colors.brand, fontSize: 18, fontWeight: '800' }}>{money(p.price_month, p.currency)}</Text>
              <Muted> /{L('mois', 'month')}</Muted>
            </View>
            <Muted>{p.description}</Muted>
            {(p.features || []).map((f) => <Text key={f} style={{ color: colors.text, marginTop: 4 }}>✓ {f}</Text>)}
          </Pressable>
        );
      })}

      {chosen ? (
        <>
          <SectionTitle>{L('Durée', 'Duration')}</SectionTitle>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[1, 3, 6, 12].map((m) => (
              <Pressable key={m} onPress={() => setMonths(m)} style={{ flex: 1, padding: 10, borderRadius: 12, alignItems: 'center', backgroundColor: months === m ? colors.chipActiveBg : colors.bgAlt }}>
                <Text style={{ color: months === m ? colors.chipActiveText : colors.text, fontWeight: '700' }}>{m} {L('mois', 'mo')}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{L('Total : ', 'Total: ')}{money(Number(chosen.price_month) * months, chosen.currency)}</Text>
          <SectionTitle>{L('Paiement', 'Payment')}</SectionTitle>
          {settings ? <Muted>{settings.payment_instructions}</Muted> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {PAY_METHODS.map((m) => (
              <Pressable key={m.code} onPress={() => setMethod(m.code)} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: method === m.code ? colors.chipActiveBg : colors.bgAlt }}>
                <Text style={{ color: method === m.code ? colors.chipActiveText : colors.text }}>{m.label}</Text>
              </Pressable>
            ))}
          </View>
          <Input value={ref} onChangeText={setRef} placeholder={L('Référence de la transaction', 'Transaction reference')} autoCapitalize="characters" />
          <Button title={L("S'abonner", 'Subscribe')} onPress={subscribe} loading={busy} />
        </>
      ) : null}

      {history.length ? <SectionTitle>{L('Historique', 'History')}</SectionTitle> : null}
      {history.map((h) => (
        <Muted key={h.id}>
          {h.status === 'active' ? '✅' : h.status === 'pending' ? '⏳' : h.status === 'rejected' ? '❌' : '•'} {h.plan ? h.plan.name : h.plan_code} · {h.months} {L('mois', 'mo')} · {money(h.amount, h.currency)} · {h.reference}
          {h.ends_at ? ' · ' + L("jusqu'au ", 'until ') + new Date(h.ends_at).toLocaleDateString('fr-FR') : ''}{h.note ? ' · ' + h.note : ''}
        </Muted>
      ))}
    </ScrollView>
  );
}
