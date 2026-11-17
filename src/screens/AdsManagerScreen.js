import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { L } from '../lib/i18n';
import { useApp } from '../AppContext';
import { Muted } from '../components/ui';
import { money, STATUS_LABEL } from '../lib/ads';

// Gestionnaire de publicités de l'annonceur (entreprises et commerces)
export default function AdsManagerScreen({ navigation }) {
  const { colors, userId } = useApp();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('ad_campaigns').select('*').eq('advertiser_id', userId).order('created_at', { ascending: false });
    setList(data || []);
    setLoading(false);
  }, [userId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const tot = list.reduce((a, c) => ({ imp: a.imp + c.impressions, clk: a.clk + c.clicks, spent: a.spent + Number(c.spent), paid: a.paid + Number(c.paid) }), { imp: 0, clk: 0, spent: 0, paid: 0 });

  const Stat = ({ v, label }) => (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>{v}</Text>
      <Muted style={{ fontSize: 12 }}>{label}</Muted>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgAlt }}>
      <FlatList
        data={list}
        keyExtractor={(c) => c.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View>
            <View style={{ flexDirection: 'row', margin: 12, padding: 14, borderRadius: 16, backgroundColor: colors.bg }}>
              <Stat v={tot.imp} label={L('Vues', 'Views')} />
              <Stat v={tot.clk} label={L('Clics', 'Clicks')} />
              <Stat v={tot.imp ? ((tot.clk / tot.imp) * 100).toFixed(1) + ' %' : '—'} label={L('Taux de clic', 'CTR')} />
              <Stat v={money(tot.spent)} label={L('Dépensé', 'Spent')} />
            </View>
            <Muted style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
              {L('Vos publicités apparaissent dans les statuts, les chaînes, le fil d’actualité, Découvrir et la recherche. Jamais dans les discussions privées ni pendant les appels.', 'Your ads appear in status, channels, feed, discover and search — never in private chats or calls.')}
            </Muted>
          </View>
        }
        ListEmptyComponent={!loading ? <Muted style={{ padding: 20, textAlign: 'center' }}>{L('Aucune campagne. Créez votre première publicité avec le bouton +.', 'No campaigns yet. Tap + to create one.')}</Muted> : null}
        renderItem={({ item: c }) => {
          const st = STATUS_LABEL[c.status] || STATUS_LABEL.draft;
          const pct = Number(c.paid) > 0 ? Math.min(100, (Number(c.spent) / Number(c.paid)) * 100) : 0;
          return (
            <Pressable onPress={() => navigation.navigate('AdEdit', { id: c.id })} style={{ backgroundColor: colors.bg, marginHorizontal: 12, marginVertical: 6, borderRadius: 16, padding: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, flex: 1 }} numberOfLines={1}>{c.name}</Text>
                <View style={{ backgroundColor: st[2], borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{L(st[0], st[1])}</Text>
                </View>
              </View>
              <Muted numberOfLines={1}>{c.headline}</Muted>
              <Muted style={{ marginTop: 6 }}>
                👁 {c.impressions} · 👆 {c.clicks} · {L('Budget', 'Budget')} {money(c.budget, c.currency)} · {L('Payé', 'Paid')} {money(c.paid, c.currency)}
              </Muted>
              {Number(c.paid) > 0 ? (
                <View style={{ height: 6, backgroundColor: colors.bgAlt, borderRadius: 3, marginTop: 8 }}>
                  <View style={{ height: 6, width: pct + '%', backgroundColor: colors.brand, borderRadius: 3 }} />
                </View>
              ) : null}
              {c.review_note && c.status === 'rejected' ? <Text style={{ color: colors.danger, marginTop: 6 }}>{c.review_note}</Text> : null}
            </Pressable>
          );
        }}
      />
      <Pressable onPress={() => navigation.navigate('AdEdit', {})} style={{ position: 'absolute', right: 18, bottom: 22, width: 60, height: 60, borderRadius: 18, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', elevation: 4 }}>
        <Text style={{ color: '#fff', fontSize: 30 }}>+</Text>
      </Pressable>
    </View>
  );
}
