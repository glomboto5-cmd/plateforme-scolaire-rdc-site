import { Linking } from 'react-native';

// Communication avec WhatsApp (normal et Business) par les liens officiels « click-to-chat » (wa.me).
// WhatsApp ne permet pas de lire ou recevoir les messages d'un compte personnel dans une autre application :
// la discussion s'ouvre donc dans WhatsApp (ou WhatsApp Business, selon ce qui est installé).

export function cleanPhone(raw) {
  let d = String(raw || '').replace(/[^\d+]/g, '');
  if (d.startsWith('00')) d = '+' + d.slice(2);
  // Numéro local RDC (ex. 0812345678) → +243812345678
  if (/^0\d{9}$/.test(d)) d = '+243' + d.slice(1);
  return d.replace(/^\+/, '');
}

export function isValidPhone(raw) {
  const d = cleanPhone(raw);
  return /^[1-9]\d{7,14}$/.test(d);
}

export function invitationText(name) {
  return (
    (name ? name + ' vous invite sur Ange chat + ' : 'Rejoignez-moi sur Ange chat + ') +
    '— messagerie, groupes et boutique en une seule application.\n' +
    'Télécharger : https://github.com/glomboto5-cmd/plateforme-scolaire-rdc-site/releases/download/unichat-apk/unichat-plus-leger.apk'
  );
}

// Ouvre une discussion WhatsApp avec ce numéro (fonctionne pour WhatsApp et WhatsApp Business)
export function openWhatsAppChat(phone, text) {
  const d = cleanPhone(phone);
  const url = 'https://wa.me/' + d + (text ? '?text=' + encodeURIComponent(text) : '');
  return Linking.openURL(url);
}

// Partage un texte sur WhatsApp en laissant l'utilisateur choisir le destinataire
export function shareOnWhatsApp(text) {
  return Linking.openURL('https://wa.me/?text=' + encodeURIComponent(text));
}
