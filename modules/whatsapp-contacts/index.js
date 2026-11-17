import { requireOptionalNativeModule } from 'expo-modules-core';

// Module Android : lit les contacts que WhatsApp a lui-même marqués dans le répertoire du téléphone
const Native = requireOptionalNativeModule('WhatsappContacts');

export async function getWhatsAppContacts() {
  if (!Native || !Native.getWhatsAppContacts) return null;
  try {
    return await Native.getWhatsAppContacts();
  } catch (e) {
    return null;
  }
}
