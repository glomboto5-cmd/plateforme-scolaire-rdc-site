import React, { useCallback, useState } from 'react';
import { Alert, Image, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase, errText } from '../lib/supabase';
import { L, t } from '../lib/i18n';
import { useApp } from '../AppContext';
import { Button, Input, Muted, SectionTitle } from '../components/ui';
import { adMediaUrl, money } from '../lib/ads';

// Tableau de bord du propriétaire : revenus publicitaires, abonnements professionnels, transactions, validations
export default function OwnerDashboardScreen() {
  const { colors } = useApp();
  const [days, setDays] = useState(30);
  const [d, setD] = useState(null);
  const [queue, setQueue] = useState([]);
  const [subs, setSubs] = useState([]);
  const [st, setSt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    const [{ data, error }, { data: q }, { data: s }, { data: set }] = await Promise.all([
      supabase.rpc('owner_dashboard', { p_days: days }),
      supabase.rpc('admin_ad_queue'),
      supabase.rpc('admin_subscription_queue'),
      supabase.from('ad_settings').select('*').eq('id', 1).maybeSingle(),
    ]);
    if (error) setDenied(true);
    setD(data); setQueue(q || []); setSubs(s || []);
    if (set) setSt({ ...set, cpm: String(set.cpm), cpc: String(set.cpc), min_budget: String(set.min_budget) });
    setLoading(false);
  }, [days]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const act = async (fn, args) => {
    const { error } = await supabase.rpc(fn, args);
    if (error) return Alert.alert(t('error'), errText(error));
    load();
  };
  const reject = (fn, args) =>
    Alert.alert(L('Refuser', 'Reject'), L('Le motif sera envoyé au client.', 'The reason will be sent.'), [
      { text: t('cancel'), style: 'cancel' },
      { text: L('Contenu non conforme', 'Non-compliant'), onPress: () => act(fn, { ...args, p_note: 'contenu non conforme' }) },
      { text: L('Paiement introuvable', 'Payment not found'), onPress: () => act(fn, { ...args, p_note: 'paiement introuvable' }) },
    ]);

  const saveSettings = async () => {
    const { error } = await supabase.from('ad_settings').update({
      cpm: Number(st.cpm.replace(',', '.')), cpc: Number(st.cpc.replace(',', '.')), min_budget: Number(st.min_budget.replace(',', '.')),
      payment_instructions: st.payment_instructions, updated_at: new Date().toISOString(),
    }).eq('id', 1);
    if (error) return Alert.alert(t('error'), errText(error));
    Alert.alert(L('Enregistré', 'Saved'));
  };

  if (denied) return <Muted style={{ padding: 24 }}>{L('Réservé au propriétaire de l’application.', 'Owner only.')}</Muted>;

  const Card = ({ title, value, sub, color }) => (
    <View style={{ flexBasis: '47%', flexGrow: 1, backgroundColor: colors.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border }}>
      <Muted style={{ fontSize: 13 }}>{title}</Muted>
      <Text style={{ color: color || colors.text, fontSize: 22, fontWeight: '800', marginTop: 4 }}>{value}</Text>
      {sub ? <Muted style={{ fontSize: 12, marginTop: 2 }}>{sub}</Muted> : null}
    </View>
  );

  const total = d ? Number(d.ads.revenue) + Number(d.subscriptions.revenue) : 0;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bgAlt }} contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: 50 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[7, 30, 90, 365].map((n) => (
          <Pressable key={n} onPress={() => setDays(n)} style={{ flex: 1, padding: 9, borderRadius: 12, alignItems: 'center', backgroundColor: days === n ? colors.brand : colors.bg }}>
            <Text style={{ color: days === n ? '#fff' : colors.text, fontWeight: '700' }}>{n === 365 ? L('1 an', '1 yr') : n + ' ' + L('j', 'd')}</Text>
          </Pressable>
        ))}
      </View>

      {d ? (
        <>
          <View style={{ backgroundColor: colors.brand, borderRadius: 18, padding: 18 }}>
            <Text style={{ color: '#fff', opacity: 0.9 }}>{L('Revenus encaissés', 'Revenue')} · {days} {L('jours', 'days')}</Text>
            <Text style={{ color: '#fff', fontSize: 32, fontWeight: '900' }}>{money(total)}</Text>
            <Text style={{ color: '#fff', opacity: 0.9 }}>{L('Depuis le début : ', 'All time: ')}{money(Number(d.ads.revenue_total) + Number(d.subscriptions.revenue_total))}</Text>
          </View>

          <SectionTitle>{L('Publicité', 'Advertising')}</SectionTitle>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <Card title={L('Revenus publicitaires', 'Ad revenue')} value={money(d.ads.revenue)} sub={L('Total : ', 'Total: ') + money(d.ads.revenue_total)} color={colors.brand} />
            <Card title={L('Campagnes en ligne', 'Live campaigns')} value={d.ads.active_campaigns} sub={d.ads.pending_review + ' ' + L('à vérifier', 'to review')} />
            <Card title={L('Vues', 'Impressions')} value={Number(d.ads.impressions).toLocaleString('fr-FR')} />
            <Card title={L('Clics', 'Clicks')} value={Number(d.ads.clicks).toLocaleString('fr-FR')} sub={d.ads.impressions ? ((d.ads.clicks / d.ads.impressions) * 100).toFixed(1) + ' %' : ''} />
          </View>

          <SectionTitle>{L('Abonnements professionnels', 'Business subscriptions')}</SectionTitle>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <Card title={L('Revenus abonnements', 'Subscription revenue')} value={money(d.subscriptions.revenue)} sub={L('Total : ', 'Total: ') + money(d.subscriptions.revenue_total)} color={colors.brand} />
            <Card title={L('Abonnés actifs', 'Active subscribers')} value={d.subscriptions.active} sub={Object.entries(d.subscriptions.by_plan || {}).map(([k, v]) => k + ' ' + v).join(' · ')} />
          </View>

          <SectionTitle>{L('Transactions et utilisateurs', 'Transactions & users')}</SectionTitle>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <Card title={L('Commandes boutique', 'Shop orders')} value={d.transactions.orders} sub={L('Volume : ', 'Volume: ') + money(d.transactions.orders_volume)} />
            <Card title={L('Paiements confirmés', 'Confirmed payments')} value={d.transactions.payments_confirmed} />
            <Card title={L('Utilisateurs', 'Users')} value={d.users.total} sub={'+' + d.users.new + ' ' + L('nouveaux', 'new')} />
            <Card title={L('Entreprises / chaînes', 'Businesses / channels')} value={d.users.businesses + ' / ' + d.users.channels} />
          </View>
        </>
      ) : null}

      <SectionTitle>{L('À valider', 'To review')} ({queue.length + subs.length})</SectionTitle>
      {!queue.length && !subs.length ? <Muted>{L('Rien à valider.', 'Nothing to review.')}</Muted> : null}
      {queue.map((q) => (
        <View key={q.kind + q.id} style={{ backgroundColor: colors.card, borderRadius: 14, padding: 12, gap: 6 }}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{q.kind === 'campaign' ? '📣 ' + L('Publicité', 'Ad') : '💵 ' + L('Paiement publicitaire', 'Ad payment')} · {q.advertiser_name}</Text>
          <Text style={{ color: colors.text }}>{q.campaign_name} — {q.headline}</Text>
          {q.kind === 'campaign' && q.body ? <Muted>{q.body}</Muted> : null}
          {q.kind === 'campaign' && q.media_path && q.media_type === 'image' ? <Image source={{ uri: adMediaUrl(q.media_path) }} style={{ width: '100%', height: 160, borderRadius: 10 }} resizeMode="cover" /> : null}
          {q.kind === 'campaign' && q.media_type === 'video' ? <Muted>🎬 {L('Vidéo jointe', 'Video attached')}</Muted> : null}
          {q.link_url ? <Muted>🔗 {q.link_url}</Muted> : null}
          <Muted>{q.kind === 'campaign' ? L('Budget ', 'Budget ') + money(q.amount, q.currency) : money(q.amount, q.currency) + ' · ' + q.method + ' · ' + L('réf. ', 'ref. ') + q.reference}</Muted>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title={L('Refuser', 'Reject')} variant="ghost" style={{ flex: 1 }}
              onPress={() => reject(q.kind === 'campaign' ? 'admin_review_campaign' : 'admin_review_ad_payment', q.kind === 'campaign' ? { p_campaign: q.id, p_approve: false } : { p_payment: q.id, p_ok: false })} />
            <Button title={q.kind === 'campaign' ? L('Valider', 'Approve') : L('Confirmer', 'Confirm')} style={{ flex: 1 }}
              onPress={() => act(q.kind === 'campaign' ? 'admin_review_campaign' : 'admin_review_ad_payment', q.kind === 'campaign' ? { p_campaign: q.id, p_approve: true, p_note: null } : { p_payment: q.id, p_ok: true, p_note: null })} />
          </View>
        </View>
      ))}
      {subs.map((s) => (
        <View key={s.id} style={{ backgroundColor: colors.card, borderRadius: 14, padding: 12, gap: 6 }}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>⭐ {L('Abonnement', 'Subscription')} {s.plan_name} · {s.user_name}</Text>
          <Muted>{s.months} {L('mois', 'mo')} · {money(s.amount, s.currency)} · {s.method} · {L('réf. ', 'ref. ')}{s.reference}</Muted>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title={L('Refuser', 'Reject')} variant="ghost" style={{ flex: 1 }} onPress={() => reject('admin_review_subscription', { p_id: s.id, p_ok: false })} />
            <Button title={L('Activer', 'Activate')} style={{ flex: 1 }} onPress={() => act('admin_review_subscription', { p_id: s.id, p_ok: true, p_note: null })} />
          </View>
        </View>
      ))}

      {d && d.recent && d.recent.length ? <SectionTitle>{L('Dernières transactions', 'Recent transactions')}</SectionTitle> : null}
      {d && (d.recent || []).map((r, i) => (
        <Muted key={i}>
          {r.status === 'confirmed' || r.status === 'active' || r.status === 'expired' ? '✅' : r.status === 'pending' ? '⏳' : '❌'} {r.kind} · {r.label} · {money(r.amount, r.currency)} · {r.method} · {r.reference} · {new Date(r.at).toLocaleDateString('fr-FR')}
        </Muted>
      ))}

      {st ? (
        <>
          <SectionTitle>{L('Tarifs et instructions de paiement', 'Pricing & payment instructions')}</SectionTitle>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Muted>{L('Prix / 1 000 vues', 'CPM')}</Muted><Input value={st.cpm} onChangeText={(v) => setSt({ ...st, cpm: v })} keyboardType="decimal-pad" /></View>
            <View style={{ flex: 1 }}><Muted>{L('Prix / clic', 'CPC')}</Muted><Input value={st.cpc} onChangeText={(v) => setSt({ ...st, cpc: v })} keyboardType="decimal-pad" /></View>
            <View style={{ flex: 1 }}><Muted>{L('Budget min.', 'Min budget')}</Muted><Input value={st.min_budget} onChangeText={(v) => setSt({ ...st, min_budget: v })} keyboardType="decimal-pad" /></View>
          </View>
          <Muted>{L('Instructions de paiement (vos numéros Mobile Money, compte bancaire…) affichées aux annonceurs et aux abonnés', 'Payment instructions shown to customers')}</Muted>
          <Input value={st.payment_instructions} onChangeText={(v) => setSt({ ...st, payment_instructions: v })} multiline style={{ minHeight: 100 }} />
          <Button title={L('Enregistrer les tarifs', 'Save pricing')} onPress={saveSettings} />
        </>
      ) : null}
    </ScrollView>
  );
}
