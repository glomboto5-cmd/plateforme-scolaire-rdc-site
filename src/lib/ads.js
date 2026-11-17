import { Linking } from 'react-native';
import { supabase } from './supabase';
import { L } from './i18n';

// Publicité Ange chat + : jamais dans les discussions privées ni pendant les appels.
// Le ciblage n'utilise que le pays, la langue et les centres d'intérêt choisis par l'utilisateur (avec son accord),
// jamais le contenu des messages.

export const PLACEMENTS = [
  { code: 'status', label: () => L('Statuts', 'Status') },
  { code: 'channel', label: () => L('Chaînes', 'Channels') },
  { code: 'feed', label: () => L("Fil d'actualité", 'News feed') },
  { code: 'discover', label: () => L('Découvrir', 'Discover') },
  { code: 'search', label: () => L('Recherche', 'Search') },
];

export const FORMATS = [
  { code: 'image', label: () => L('Image', 'Image') },
  { code: 'video', label: () => L('Vidéo', 'Video') },
  { code: 'text', label: () => L('Texte', 'Text') },
  { code: 'sponsored_post', label: () => L('Publication sponsorisée', 'Sponsored post') },
  { code: 'business', label: () => L('Entreprise / commerce', 'Business / shop') },
];

// Centres d'intérêt non sensibles (aucune santé, religion, politique, orientation…)
export const INTERESTS = [
  ['shopping', 'Shopping', 'Shopping'], ['mode', 'Mode et beauté', 'Fashion & beauty'], ['tech', 'Téléphones et technologie', 'Tech'],
  ['food', 'Cuisine et restaurants', 'Food'], ['sport', 'Sport', 'Sports'], ['music', 'Musique', 'Music'], ['cinema', 'Films et séries', 'Movies & TV'],
  ['travel', 'Voyages', 'Travel'], ['education', 'Éducation et formation', 'Education'], ['jobs', 'Emploi', 'Jobs'],
  ['business', 'Entrepreneuriat', 'Business'], ['auto', 'Auto et moto', 'Cars'], ['home', 'Maison et décoration', 'Home'],
  ['agri', 'Agriculture', 'Farming'], ['games', 'Jeux', 'Games'], ['events', 'Événements et sorties', 'Events'],
].map(([code, fr, en]) => ({ code, label: () => L(fr, en) }));

export const PAY_METHODS = [
  ['mpesa', 'M-Pesa'], ['airtel_money', 'Airtel Money'], ['orange_money', 'Orange Money'], ['afrimoney', 'Afrimoney'],
  ['bank', 'Virement bancaire'], ['card', 'Carte bancaire'], ['cash', 'Espèces'], ['other', 'Autre'],
].map(([code, label]) => ({ code, label }));

export const STATUS_LABEL = {
  draft: ['Brouillon', 'Draft', '#8696A0'],
  pending: ['En vérification', 'In review', '#E69500'],
  active: ['En ligne', 'Live', '#1DAA61'],
  paused: ['En pause', 'Paused', '#8696A0'],
  completed: ['Terminée', 'Completed', '#1F7AE0'],
  rejected: ['Refusée', 'Rejected', '#D93025'],
};

export function adMediaUrl(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return supabase.storage.from('ads').getPublicUrl(path).data.publicUrl;
}

export function publicUrl(bucket, path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export async function fetchAds(placement, query, limit = 2) {
  try {
    const { data } = await supabase.rpc('get_ads', { p_placement: placement, p_query: query || null, p_limit: limit });
    return data || [];
  } catch (e) {
    return [];
  }
}

const seen = {};
export function recordImpression(ad, placement) {
  const k = ad.id + placement;
  if (seen[k] && Date.now() - seen[k] < 30 * 60 * 1000) return;
  seen[k] = Date.now();
  supabase.rpc('record_ad_event', { p_campaign: ad.id, p_kind: 'impression', p_placement: placement }).then(() => {});
}

export async function hideAd(ad, placement) {
  await supabase.rpc('record_ad_event', { p_campaign: ad.id, p_kind: 'hide', p_placement: placement });
}

export async function openAd(ad, placement, navigation) {
  supabase.rpc('record_ad_event', { p_campaign: ad.id, p_kind: 'click', p_placement: placement }).then(() => {});
  if (ad.link_kind === 'shop') return navigation.navigate('SellerShop', { sellerId: ad.link_target || ad.advertiser_id });
  if (ad.link_kind === 'channel' && ad.link_target) return navigation.navigate('Channel', { id: ad.link_target });
  if (ad.link_kind === 'chat') {
    const { data } = await supabase.rpc('get_or_create_direct_conversation', { p_other: ad.advertiser_id });
    if (data) navigation.navigate('Chat', { id: data });
    return;
  }
  if (ad.link_url) Linking.openURL(ad.link_url);
}

// Mélange des publicités dans une liste : une publicité toutes les `every` entrées
export function interleave(items, ads, every = 4, keyOf = (x) => x.id) {
  if (!ads || !ads.length) return items.map((x) => ({ type: 'item', key: String(keyOf(x)), item: x }));
  const out = [];
  let a = 0;
  items.forEach((x, i) => {
    out.push({ type: 'item', key: String(keyOf(x)), item: x });
    if ((i + 1) % every === 0 && a < ads.length) { out.push({ type: 'ad', key: 'ad-' + ads[a].id + '-' + i, ad: ads[a] }); a++; }
  });
  if (a === 0 && items.length < every) out.push({ type: 'ad', key: 'ad-' + ads[0].id, ad: ads[0] });
  return out;
}

export function money(n, cur) {
  const v = Number(n || 0);
  return (Math.round(v * 100) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + (cur || 'USD');
}
