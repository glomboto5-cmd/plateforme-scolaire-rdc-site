import * as Contacts from 'expo-contacts';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { cleanPhone } from './whatsapp';
import { getWhatsAppContacts } from '../../modules/whatsapp-contacts';

// Lit le répertoire du téléphone (les mêmes contacts que ceux de WhatsApp),
// puis indique lesquels sont déjà inscrits sur Angechat.
// Les numéros sont seulement comparés côté serveur ; ils ne sont pas enregistrés.

export async function loadPhoneContacts() {
  if (Platform.OS === 'web') return { granted: false, list: [] };
  const perm = await Contacts.requestPermissionsAsync();
  if (perm.status !== 'granted') return { granted: false, list: [] };

  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name, Contacts.Fields.Image, Contacts.Fields.ImageAvailable],
    sort: Contacts.SortTypes.FirstName,
  });

  const byPhone = {};
  (data || []).forEach((c) => {
    (c.phoneNumbers || []).forEach((p) => {
      const raw = String(p.number || '');
      // Ignore les codes USSD (*105#…) et numéros de service trop courts
      if (/[*#]/.test(raw)) return;
      const d = cleanPhone(raw);
      if (!/^[1-9]\d{8,14}$/.test(d)) return;
      const e164 = '+' + d;
      if (/^[*#+\d\s()-]+$/.test(String(c.name || '')) && /[*#]/.test(String(c.name || ''))) return;
      const photo = c.imageAvailable && c.image && c.image.uri ? c.image.uri : null;
      if (!byPhone[e164]) byPhone[e164] = { key: e164, phone: e164, name: c.name || e164, photo };
    });
  });
  // Vrais contacts WhatsApp / WhatsApp Business (enregistrés par WhatsApp sur le téléphone)
  const wa = await getWhatsAppContacts();
  const waAvailable = Array.isArray(wa) && wa.length > 0;
  (wa || []).forEach((w) => {
    const d = cleanPhone(w.phone);
    if (!/^[1-9]\d{7,14}$/.test(d)) return;
    const e164 = '+' + d;
    if (!byPhone[e164]) byPhone[e164] = { key: e164, phone: e164, name: w.name || e164, photo: null };
    byPhone[e164].whatsapp = !!(w.whatsapp || w.personal);
    byPhone[e164].business = !!w.business;
  });
  const list = Object.values(byPhone);

  // Correspondance avec les comptes Angechat (par paquets)
  const all = list.map((x) => x.phone);
  for (let i = 0; i < all.length; i += 1000) {
    const { data: found } = await supabase.rpc('match_phone_contacts', { p_phones: all.slice(i, i + 1000) });
    (found || []).forEach((f) => {
      if (byPhone[f.phone_e164]) byPhone[f.phone_e164].profile = f;
    });
  }

  list.sort((a, b) => (b.profile ? 1 : 0) - (a.profile ? 1 : 0) || a.name.localeCompare(b.name));
  return { granted: true, list, waAvailable };
}
