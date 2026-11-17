import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { L } from '../lib/i18n';
import { useApp } from '../AppContext';
import { Muted } from '../components/ui';
import { loadPhoneContacts } from '../lib/phoneContacts';
import { PLATFORMS } from './SocialScreen';
import { money } from '../lib/ads';

// Centre Ange chat + : messagerie, WhatsApp unifié, réseaux sociaux, publicité, offres Pro et tableau de bord réunis
export default function HubScreen({ navigation }) {
  const { colors, userId } = useApp();
  const [wa, setWa] = useState(null);
  const [social, setSocial] = useState([]);
  const [ads, setAds] = useState({ total: 0, active: 0, spent: 0 });
  const [plan, setPlan] = useState(null);
  const [admin, setAdmin] = useState(false);
  const [dash, setDash] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [{ data: soc }, { data: camp }, { data: pl }, { data: isAdmin }] = await Promise.all([
      supabase.from('social_accounts').select('platform').eq('user_id', userId),
      supabase.from('ad_campaigns').select('status,spent').eq('advertiser_id', userId),
      supabase.rpc('my_business_plan'),
      supabase.rpc('am_i_admin'),
    ]);
    setSocial((soc || []).map((s) => s.platform));
    const c = camp || [];
    setAds({ total: c.length, active: c.filter((x) => x.status === 'active').length, spent: c.reduce((n, x) => n + Number(x.spent), 0) });
    setPlan(pl && pl[0]);
    setAdmin(!!isAdmin);
    if (isAdmin) {
      const { data: d } = await supabase.rpc('owner_dashboard', { p_days: 30 });
      setDash(d);
    }
    setLoading(false);
    try {
      const r = await loadPhoneContacts();
      const list = r.list || [];
      setWa({ available: r.waAvailable, personal: list.filter((x) => x.whatsapp).length, business: list.filter((x) => x.business).length, onApp: list.filter((x) => x.profile).length });
    } catch (e) {
      setWa({ available: false, personal: 0, business: 0, onApp: 0 });
    }
  }, [userId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const Block = ({ icon, title, badge, badgeColor, children, onPress, action }) => (
    <Pressable onPress={onPress} style={{ backgroundColor: colors.card, borderRadius: 18, padding: 16, marginHorizontal: 12, marginVertical: 6, borderWidth: 1, borderColor: colors.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ fontSize: 24, marginRight: 10 }}>{icon}</Text>
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700', flex: 1 }}>{title}</Text>
        {badge ? (
          <View style={{ backgroundColor: badgeColor || colors.chipActiveBg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ color: badgeColor ? '#fff' : colors.chipActiveText, fontSize: 12, fontWeight: '700' }}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ marginTop: 8 }}>{children}</View>
      {action ? <Text style={{ color: colors.brand, fontWeight: '700', marginTop: 10 }}>{action} →</Text> : null}
    </Pressable>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bgAlt }} contentContainerStyle={{ paddingVertical: 8, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}>
      <Muted style={{ paddingHorizontal: 16, paddingBottom: 4 }}>
        {L('Tout Ange chat + au même endroit : communication, réseaux connectés et revenus.', 'All of Ange chat + in one place.')}
      </Muted>

      <Block icon="💬" title={L('Messagerie', 'Messaging')} badge={L('Gratuit', 'Free')} onPress={() => navigation.navigate('Home', { screen: 'Chats' })} action={L('Ouvrir les discussions', 'Open chats')}>
        <Muted>{L('Discussions, appels audio et vidéo, réunions, groupes, communautés et statuts : gratuits pour tous les particuliers.', 'Chats, calls, meetings, groups, communities and status are free for everyone.')}</Muted>
      </Block>

      <Block icon="🟢" title={L('WhatsApp unifié', 'Unified WhatsApp')} badge={wa && wa.available ? L('Relié', 'Linked') : null} onPress={() => navigation.navigate('NewChat')} action={L('Voir mes contacts', 'See my contacts')}>
        {wa ? (
          <Muted>
            {wa.available
              ? `${wa.personal} ${L('contacts WhatsApp', 'WhatsApp contacts')} · ${wa.business} ${L('contacts WhatsApp Business', 'WhatsApp Business contacts')} · ${wa.onApp} ${L('déjà sur Ange chat +', 'on Ange chat +')}`
              : L('Installez WhatsApp ou WhatsApp Business sur ce téléphone pour retrouver ici vos contacts des deux applications.', 'Install WhatsApp or WhatsApp Business to see those contacts here.')}
          </Muted>
        ) : <Muted>{L('Lecture des contacts…', 'Reading contacts…')}</Muted>}
        <Muted style={{ fontSize: 12, marginTop: 4 }}>{L('WhatsApp normal et Business réunis dans une seule liste. Les messages WhatsApp eux-mêmes restent dans WhatsApp (règles de WhatsApp).', 'Messages themselves stay in WhatsApp (WhatsApp rules).')}</Muted>
      </Block>

      <Block icon="🌐" title={L('Réseaux sociaux', 'Social networks')} badge={social.length ? social.length + ' ' + L('relié(s)', 'linked') : null} onPress={() => navigation.navigate('Social')} action={L('Gérer mes réseaux', 'Manage networks')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {PLATFORMS.map((p) => {
            const on = social.includes(p.key);
            return (
              <View key={p.key} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: on ? colors.chipActiveBg : colors.bgAlt }}>
                <Text>{p.icon} </Text>
                <Text style={{ color: on ? colors.chipActiveText : colors.textMuted, fontSize: 13 }}>{p.name}{on ? ' ✓' : ''}</Text>
              </View>
            );
          })}
        </View>
        <Muted style={{ fontSize: 12, marginTop: 6 }}>{L('Profils reliés et partage dès maintenant. La lecture et l’envoi de messages sur chaque réseau dépendent des autorisations accordées par la plateforme.', 'Linked profiles and sharing today; messaging depends on each platform’s permissions.')}</Muted>
      </Block>

      <Block icon="📣" title={L('Publicités et campagnes', 'Ads & campaigns')} badge={ads.active ? ads.active + ' ' + L('en ligne', 'live') : null} badgeColor={ads.active ? colors.brand : null} onPress={() => navigation.navigate('AdsManager')} action={ads.total ? L('Gérer mes campagnes', 'Manage campaigns') : L('Créer une publicité', 'Create an ad')}>
        <Muted>{ads.total ? `${ads.total} ${L('campagne(s)', 'campaign(s)')} · ${L('dépensé', 'spent')} ${money(ads.spent)}` : L('Faites connaître votre entreprise dans les statuts, les chaînes, le fil d’actualité, Découvrir et la recherche.', 'Promote your business across the app.')}</Muted>
      </Block>

      <Block icon="📢" title={L("Chaînes et fil d'actualité", 'Channels & feed')} onPress={() => navigation.navigate('Channels')} action={L('Ouvrir', 'Open')}>
        <Muted>{L('Diffusez vos actualités à vos abonnés et découvrez d’autres chaînes.', 'Broadcast to followers and discover channels.')}</Muted>
      </Block>

      <Block icon="⭐" title={L('Services Pro pour entreprises', 'Pro services')} badge={plan ? plan.plan_name : null} onPress={() => navigation.navigate('BusinessPlans')} action={plan ? L('Mon abonnement', 'My plan') : L('Voir les offres', 'See plans')}>
        <Muted>{plan ? L("Actif jusqu'au ", 'Active until ') + new Date(plan.ends_at).toLocaleDateString('fr-FR') : L('Catalogue étendu, crédit publicitaire, badge, mise en avant, assistance.', 'Bigger catalog, ad credit, badge, promotion, support.')}</Muted>
      </Block>

      {admin ? (
        <Block icon="📈" title={L('Tableau de bord du propriétaire', 'Owner dashboard')} badge="Admin" badgeColor="#1F7AE0" onPress={() => navigation.navigate('OwnerDashboard')} action={L('Ouvrir le tableau de bord', 'Open dashboard')}>
          {dash ? (
            <Muted>
              {L('30 derniers jours : ', 'Last 30 days: ')}{L('publicité ', 'ads ')}{money(dash.ads.revenue)} · {L('abonnements ', 'subscriptions ')}{money(dash.subscriptions.revenue)} · {dash.transactions.orders} {L('commandes', 'orders')}
              {dash.ads.pending_review + dash.ads.pending_payments + dash.subscriptions.pending ? ' · ⏳ ' + (dash.ads.pending_review + dash.ads.pending_payments + dash.subscriptions.pending) + ' ' + L('à valider', 'to review') : ''}
            </Muted>
          ) : <Muted>{L('Revenus publicitaires, abonnements professionnels et transactions.', 'Ad revenue, subscriptions and transactions.')}</Muted>}
        </Block>
      ) : null}
    </ScrollView>
  );
}
