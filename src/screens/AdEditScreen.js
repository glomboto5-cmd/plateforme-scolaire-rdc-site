import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase, errText } from '../lib/supabase';
import { L, LANGUAGES, t } from '../lib/i18n';
import { useApp } from '../AppContext';
import { Button, Input, Muted, SectionTitle } from '../components/ui';
import { uploadFile } from '../lib/upload';
import { adMediaUrl, FORMATS, INTERESTS, money, PAY_METHODS, PLACEMENTS, STATUS_LABEL } from '../lib/ads';

const LINKS = [
  ['url', 'Site web', 'Website'], ['shop', 'Ma boutique', 'My shop'], ['channel', 'Ma chaîne', 'My channel'], ['chat', "M'écrire", 'Message me'], ['none', 'Aucun lien', 'No link'],
];

// Champ défini hors du composant pour garder le clavier ouvert
function Chip({ on, label, onPress, colors }) {
  return (
    <Pressable onPress={onPress} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: on ? colors.chipActiveBg : colors.bgAlt, borderWidth: 1, borderColor: on ? colors.brand : 'transparent' }}>
      <Text style={{ color: on ? colors.chipActiveText : colors.text }}>{on ? '✓ ' : ''}{label}</Text>
    </Pressable>
  );
}

export default function AdEditScreen({ route, navigation }) {
  const id = route.params && route.params.id;
  const { colors, userId, profile } = useApp();
  const [c, setC] = useState({
    name: '', format: 'image', headline: '', body: '', media_path: null, media_type: null, cta_label: 'En savoir plus',
    link_kind: 'url', link_url: '', link_target: null, placements: PLACEMENTS.map((p) => p.code), keywords: [], target_countries: [], target_languages: [], target_interests: [],
    budget: '10', currency: 'USD', ends_at: null, status: 'draft', paid: 0, spent: 0, impressions: 0, clicks: 0,
  });
  const [kw, setKw] = useState('');
  const [countries, setCountries] = useState('');
  const [days, setDays] = useState('');
  const [settings, setSettings] = useState(null);
  const [payments, setPayments] = useState([]);
  const [channels, setChannels] = useState([]);
  const [payMethod, setPayMethod] = useState('mpesa');
  const [payRef, setPayRef] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k, v) => setC((x) => ({ ...x, [k]: v }));
  const toggle = (k, v) => setC((x) => ({ ...x, [k]: x[k].includes(v) ? x[k].filter((y) => y !== v) : [...x[k], v] }));

  const load = async () => {
    const [{ data: st }, { data: ch }] = await Promise.all([
      supabase.from('ad_settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('channels').select('id,name').eq('owner_id', userId),
    ]);
    setSettings(st);
    setChannels(ch || []);
    if (id) {
      const [{ data }, { data: pays }] = await Promise.all([
        supabase.from('ad_campaigns').select('*').eq('id', id).maybeSingle(),
        supabase.from('ad_payments').select('*').eq('campaign_id', id).order('created_at', { ascending: false }),
      ]);
      if (data) {
        setC({ ...data, budget: String(data.budget), link_url: data.link_url || '' });
        setKw((data.keywords || []).join(', '));
        setCountries((data.target_countries || []).join(', '));
        setPayAmount(String(Math.max(0, Number(data.budget) - Number(data.paid))));
      }
      setPayments(pays || []);
    } else {
      setCountries(profile && profile.country_code ? profile.country_code : '');
    }
  };
  useEffect(() => { load(); }, [id]);

  useLayoutEffect(() => { navigation.setOptions({ title: id ? L('Campagne', 'Campaign') : L('Nouvelle publicité', 'New ad') }); }, [id, navigation]);

  const pickMedia = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: c.format === 'video' ? ['videos'] : ['images'], quality: 0.8, videoMaxDuration: 60 });
    if (res.canceled || !res.assets || !res.assets[0]) return;
    const a = res.assets[0];
    const isVideo = a.type === 'video' || (a.mimeType || '').startsWith('video/');
    setBusy(true);
    try {
      const path = await uploadFile({ bucket: 'ads', userId, uri: a.uri, mimeType: a.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'), fileName: a.fileName });
      setC((x) => ({ ...x, media_path: path, media_type: isVideo ? 'video' : 'image' }));
    } catch (e) { Alert.alert(t('error'), errText(e)); }
    setBusy(false);
  };

  const payload = (status) => {
    const d = parseInt(days, 10);
    return {
      advertiser_id: userId,
      name: (c.name || c.headline).trim().slice(0, 80),
      format: c.format,
      headline: c.headline.trim(),
      body: c.body.trim(),
      media_path: c.format === 'text' ? null : c.media_path,
      media_type: c.format === 'text' ? null : c.media_type,
      cta_label: (c.cta_label || '').trim() || 'En savoir plus',
      link_kind: c.link_kind,
      link_url: c.link_kind === 'url' ? (/^https?:\/\//i.test(c.link_url.trim()) ? c.link_url.trim() : c.link_url.trim() ? 'https://' + c.link_url.trim() : null) : null,
      link_target: c.link_kind === 'shop' ? userId : c.link_kind === 'channel' ? c.link_target : null,
      placements: c.placements,
      keywords: kw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
      target_countries: countries.split(',').map((s) => s.trim().toUpperCase()).filter((s) => s.length === 2),
      target_languages: c.target_languages,
      target_interests: c.target_interests,
      budget: Number(String(c.budget).replace(',', '.')) || 0,
      ends_at: d > 0 ? new Date(Date.now() + d * 86400000).toISOString() : c.ends_at,
      ...(status ? { status } : {}),
    };
  };

  const check = () => {
    if (!c.headline.trim()) return L('Ajoutez un titre.', 'Add a headline.');
    if ((c.format === 'image' || c.format === 'video') && !c.media_path) return L('Ajoutez une image ou une vidéo.', 'Add an image or video.');
    if (!c.placements.length) return L('Choisissez au moins un emplacement.', 'Choose a placement.');
    if (c.link_kind === 'url' && !c.link_url.trim()) return L('Indiquez le lien du site.', 'Add a link.');
    if (c.link_kind === 'channel' && !c.link_target) return L('Choisissez la chaîne.', 'Choose a channel.');
    const b = Number(String(c.budget).replace(',', '.'));
    if (!(b >= Number((settings && settings.min_budget) || 1))) return L('Budget minimum : ', 'Minimum budget: ') + money(settings && settings.min_budget);
    return null;
  };

  const save = async (status) => {
    const err = check();
    if (err) return Alert.alert(L('Publicité', 'Ad'), err);
    setBusy(true);
    const body = payload(status);
    const res = id ? await supabase.from('ad_campaigns').update(body).eq('id', id).select('id').single() : await supabase.from('ad_campaigns').insert(body).select('id').single();
    setBusy(false);
    if (res.error) return Alert.alert(t('error'), errText(res.error));
    if (!id) navigation.replace('AdEdit', { id: res.data.id });
    else load();
    if (status === 'pending') Alert.alert(L('Envoyée', 'Submitted'), L('Votre publicité est envoyée en vérification. Déclarez le paiement ci-dessous pour qu’elle démarre dès sa validation.', 'Submitted for review. Declare the payment below.'));
  };

  const setStatus = async (status) => {
    setBusy(true);
    const { error } = await supabase.from('ad_campaigns').update({ status }).eq('id', id);
    setBusy(false);
    if (error) return Alert.alert(t('error'), errText(error));
    load();
  };

  const declarePayment = async () => {
    const amount = Number(String(payAmount).replace(',', '.'));
    if (!(amount > 0) || payRef.trim().length < 3) return Alert.alert(L('Paiement', 'Payment'), L('Indiquez le montant et la référence de la transaction.', 'Enter amount and reference.'));
    setBusy(true);
    const { error } = await supabase.from('ad_payments').insert({ campaign_id: id, payer_id: userId, amount, currency: c.currency, method: payMethod, reference: payRef.trim() });
    setBusy(false);
    if (error) return Alert.alert(t('error'), errText(error));
    setPayRef('');
    Alert.alert(L('Merci', 'Thank you'), L('Paiement déclaré. Il sera vérifié puis crédité sur la campagne.', 'Payment declared; it will be verified.'));
    load();
  };

  const remove = () =>
    Alert.alert(L('Supprimer la campagne ?', 'Delete campaign?'), '', [
      { text: t('cancel'), style: 'cancel' },
      { text: L('Supprimer', 'Delete'), style: 'destructive', onPress: async () => { const { error } = await supabase.from('ad_campaigns').delete().eq('id', id); if (error) Alert.alert(t('error'), errText(error)); else navigation.goBack(); } },
    ]);

  const st = STATUS_LABEL[c.status] || STATUS_LABEL.draft;
  const media = adMediaUrl(c.media_path);
  const editable = !id || ['draft', 'rejected', 'pending', 'paused', 'active'].includes(c.status);
  const estViews = settings ? Math.floor((Number(String(c.budget).replace(',', '.')) || 0) / Number(settings.cpm) * 1000) : 0;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      {id ? (
        <View style={{ padding: 14, borderRadius: 14, backgroundColor: colors.bgAlt, gap: 4 }}>
          <Text style={{ color: st[2], fontWeight: '800', fontSize: 16 }}>● {L(st[0], st[1])}</Text>
          <Muted>👁 {c.impressions} {L('vues', 'views')} · 👆 {c.clicks} {L('clics', 'clicks')} · {L('Dépensé', 'Spent')} {money(c.spent, c.currency)} / {money(c.paid, c.currency)}</Muted>
          {c.review_note ? <Text style={{ color: c.status === 'rejected' ? colors.danger : colors.text }}>📝 {c.review_note}</Text> : null}
        </View>
      ) : null}

      <SectionTitle>{L('1. Format', '1. Format')}</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {FORMATS.map((f) => <Chip key={f.code} colors={colors} on={c.format === f.code} label={f.label()} onPress={() => set('format', f.code)} />)}
      </View>

      <SectionTitle>{L('2. Contenu', '2. Content')}</SectionTitle>
      <Input value={c.name} onChangeText={(v) => set('name', v)} placeholder={L('Nom de la campagne (visible par vous seul)', 'Campaign name (private)')} maxLength={80} />
      <Input value={c.headline} onChangeText={(v) => set('headline', v)} placeholder={L('Titre de la publicité', 'Headline')} maxLength={90} />
      <Input value={c.body} onChangeText={(v) => set('body', v)} placeholder={c.format === 'sponsored_post' ? L('Texte de la publication', 'Post text') : L('Description (facultative)', 'Description (optional)')} multiline maxLength={600} style={{ minHeight: 80 }} />
      {c.format !== 'text' ? (
        <Pressable onPress={pickMedia} disabled={busy} style={{ height: 170, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: colors.bgAlt }}>
          {media && c.media_type === 'image' ? <Image source={{ uri: media }} style={{ width: '100%', height: '100%' }} /> : (
            <Text style={{ color: colors.textMuted }}>{media ? '🎬 ' + L('Vidéo ajoutée — toucher pour changer', 'Video added — tap to change') : (c.format === 'video' ? '🎬 ' + L('Ajouter une vidéo (60 s max.)', 'Add a video') : '🖼 ' + L('Ajouter une image', 'Add an image'))}</Text>
          )}
        </Pressable>
      ) : null}

      <SectionTitle>{L('3. Action', '3. Action')}</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {LINKS.map(([k, fr, en]) => <Chip key={k} colors={colors} on={c.link_kind === k} label={L(fr, en)} onPress={() => set('link_kind', k)} />)}
      </View>
      {c.link_kind === 'url' ? <Input value={c.link_url} onChangeText={(v) => set('link_url', v)} placeholder="https://…" autoCapitalize="none" keyboardType="url" /> : null}
      {c.link_kind === 'channel' ? (
        channels.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {channels.map((ch) => <Chip key={ch.id} colors={colors} on={c.link_target === ch.id} label={ch.name} onPress={() => set('link_target', ch.id)} />)}
          </View>
        ) : <Muted>{L("Vous n'avez pas encore de chaîne.", 'You have no channel yet.')}</Muted>
      ) : null}
      {c.link_kind !== 'none' ? <Input value={c.cta_label} onChangeText={(v) => set('cta_label', v)} placeholder={L('Texte du bouton (ex. Acheter, Commander, S’inscrire)', 'Button text')} maxLength={30} /> : null}

      <SectionTitle>{L('4. Emplacements', '4. Placements')}</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {PLACEMENTS.map((p) => <Chip key={p.code} colors={colors} on={c.placements.includes(p.code)} label={p.label()} onPress={() => toggle('placements', p.code)} />)}
      </View>
      {c.placements.includes('search') ? (
        <Input value={kw} onChangeText={setKw} placeholder={L('Mots-clés de recherche, séparés par des virgules', 'Search keywords, comma-separated')} />
      ) : null}
      <Muted style={{ fontSize: 12 }}>🔒 {L('Jamais dans les discussions privées ni pendant les appels audio et vidéo.', 'Never in private chats or during calls.')}</Muted>

      <SectionTitle>{L('5. Public (facultatif)', '5. Audience (optional)')}</SectionTitle>
      <Input value={countries} onChangeText={setCountries} placeholder={L('Pays (codes, ex. CD, CG, CM, FR) — vide = monde entier', 'Countries (codes) — empty = worldwide')} autoCapitalize="characters" />
      <Muted>{L('Langues', 'Languages')}</Muted>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {LANGUAGES.map((l) => <Chip key={l.code} colors={colors} on={c.target_languages.includes(l.code)} label={l.label} onPress={() => toggle('target_languages', l.code)} />)}
      </View>
      <Muted>{L("Centres d'intérêt (seuls les utilisateurs qui ont accepté les publicités personnalisées)", 'Interests (only users who opted in)')}</Muted>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {INTERESTS.map((i) => <Chip key={i.code} colors={colors} on={c.target_interests.includes(i.code)} label={i.label()} onPress={() => toggle('target_interests', i.code)} />)}
      </View>

      <SectionTitle>{L('6. Budget et durée', '6. Budget & duration')}</SectionTitle>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Input value={c.budget} onChangeText={(v) => set('budget', v)} placeholder="Budget" keyboardType="decimal-pad" style={{ flex: 1 }} />
        <Input value={days} onChangeText={setDays} placeholder={L('Durée en jours (facultatif)', 'Days (optional)')} keyboardType="number-pad" style={{ flex: 1 }} />
      </View>
      {settings ? (
        <Muted>
          {L('Tarif : ', 'Rate: ')}{money(settings.cpm, settings.currency)} {L('pour 1 000 vues', 'per 1,000 views')} · {money(settings.cpc, settings.currency)} {L('par clic', 'per click')} · {L('environ', 'about')} {estViews.toLocaleString('fr-FR')} {L('vues', 'views')}
          {c.ends_at ? ' · ' + L('fin le ', 'ends ') + new Date(c.ends_at).toLocaleDateString('fr-FR') : ''}
        </Muted>
      ) : null}

      {editable ? (
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
          <Button title={L('Enregistrer', 'Save')} variant="ghost" onPress={() => save(c.status === 'pending' || c.status === 'active' || c.status === 'paused' ? undefined : 'draft')} loading={busy} style={{ flex: 1 }} />
          {['draft', 'rejected'].includes(c.status) ? <Button title={L('Envoyer en vérification', 'Submit')} onPress={() => save('pending')} loading={busy} style={{ flex: 1 }} /> : null}
        </View>
      ) : null}
      {c.status === 'active' ? <Button title={'⏸ ' + L('Mettre en pause', 'Pause')} variant="ghost" onPress={() => setStatus('paused')} /> : null}
      {c.status === 'paused' && c.approved_at && Number(c.paid) > Number(c.spent) ? <Button title={'▶ ' + L('Relancer', 'Resume')} onPress={() => setStatus('active')} /> : null}

      {id ? (
        <>
          <SectionTitle>{L('7. Paiement', '7. Payment')}</SectionTitle>
          {settings ? <Muted>{settings.payment_instructions}</Muted> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {PAY_METHODS.map((m) => <Chip key={m.code} colors={colors} on={payMethod === m.code} label={m.label} onPress={() => setPayMethod(m.code)} />)}
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Input value={payAmount} onChangeText={setPayAmount} placeholder={L('Montant', 'Amount')} keyboardType="decimal-pad" style={{ flex: 1 }} />
            <Input value={payRef} onChangeText={setPayRef} placeholder={L('Référence de la transaction', 'Transaction reference')} style={{ flex: 1.4 }} autoCapitalize="characters" />
          </View>
          <Button title={L('Déclarer le paiement', 'Declare payment')} onPress={declarePayment} loading={busy} />
          {payments.map((p) => (
            <Muted key={p.id}>
              {p.status === 'confirmed' ? '✅' : p.status === 'rejected' ? '❌' : '⏳'} {money(p.amount, p.currency)} · {p.method} · {p.reference} · {new Date(p.created_at).toLocaleDateString('fr-FR')}{p.note ? ' · ' + p.note : ''}
            </Muted>
          ))}
          {Number(c.paid) === 0 ? <Button title={L('Supprimer la campagne', 'Delete campaign')} variant="danger" onPress={remove} style={{ marginTop: 16 }} /> : null}
        </>
      ) : null}
    </ScrollView>
  );
}
