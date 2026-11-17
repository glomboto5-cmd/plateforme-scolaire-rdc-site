import React from 'react';
import { Linking, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { L, LANGUAGES } from '../lib/i18n';
import { useApp } from '../AppContext';
import { Avatar, Muted, Title } from '../components/ui';
import { avatarUri } from '../lib/chat';
import { invitationText } from '../lib/whatsapp';

const UPDATE_URL = 'https://github.com/glomboto5-cmd/plateforme-scolaire-rdc-site/releases/download/unichat-apk/unichat-plus-leger.apk';

export default function SettingsScreen({ navigation }) {
  const { colors, profile, settings } = useApp();
  const s = settings || {};
  const lang = (LANGUAGES.find((l) => l.code === s.language) || LANGUAGES[0]).label;

  const Item = ({ icon, title, sub, onPress, badge }) => (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: pressed ? colors.bgAlt : colors.bg })}>
      <Text style={{ fontSize: 22, width: 40, color: colors.textMuted }}>{icon}</Text>
      <View style={{ flex: 1, marginLeft: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: colors.text, fontSize: 17 }}>{title}</Text>
          {badge ? (
            <View style={{ backgroundColor: colors.chipActiveBg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ color: colors.chipActiveText, fontSize: 12, fontWeight: '700' }}>{badge}</Text>
            </View>
          ) : null}
        </View>
        {sub ? <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 2 }}>{sub}</Text> : null}
      </View>
    </Pressable>
  );

  const go = (section) => navigation.navigate('SettingsDetail', { section });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Pressable onPress={() => navigation.navigate('Profile')} style={{ alignItems: 'center', paddingVertical: 24, backgroundColor: colors.bgAlt }}>
        <Avatar uri={avatarUri(profile)} name={profile && profile.display_name} size={110} />
        <Text style={{ color: colors.text, fontSize: 26, fontWeight: '600', marginTop: 14 }}>{profile ? profile.display_name : ''}</Text>
        {profile && profile.about ? <Muted style={{ marginTop: 4 }}>{profile.about}</Muted> : null}
        <Muted style={{ marginTop: 4 }}>@{profile ? profile.handle : ''} · ✏️ {L('Modifier le profil', 'Edit profile')}</Muted>
      </Pressable>

      <View style={{ margin: 16, padding: 16, borderRadius: 18, backgroundColor: colors.chipActiveBg, flexDirection: 'row', gap: 12 }}>
        <Text style={{ fontSize: 26 }}>🛡️</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.chipActiveText, fontWeight: '700', fontSize: 16 }}>{L('Compte protégé par e-mail', 'Account secured by email')}</Text>
          <Text style={{ color: colors.chipActiveText, marginTop: 2 }}>
            {L('Connexion sans mot de passe, par code envoyé à votre adresse e-mail. Un seul appareil actif à la fois.', 'Passwordless sign-in by email code. One active device at a time.')}
          </Text>
        </View>
      </View>

      <Item icon="📱" title={L('Appareils connectés', 'Linked devices')} sub={L('Appareil actif, déconnexion à distance', 'Active device, remote logout')} onPress={() => go('devices')} />
      <Item icon="🔑" title={L('Compte', 'Account')} sub={L('Téléphone, e-mail, compte professionnel', 'Phone, email, business account')} onPress={() => go('account')} />
      <Item icon="🔒" title={L('Confidentialité', 'Privacy')} sub={L('Comptes bloqués, messages éphémères', 'Blocked accounts, disappearing messages')} onPress={() => go('privacy')} />
      <Item icon="👥" title={L('Listes', 'Lists')} sub={L('Gérer les personnes et les groupes', 'Manage people and groups')} onPress={() => go('lists')} />
      <Item icon="💬" title={L('Discussions', 'Chats')} sub={L('Historique des discussions, sauvegarde', 'Chat history, backup')} onPress={() => go('chats')} />
      <Item icon="🎨" title={L('Apparence', 'Appearance')} sub={L("Thème de l'application", 'App theme')} onPress={() => go('appearance')} />
      <Item icon="📅" title={L('Événements', 'Events')} sub={L('Consulter et gérer les événements', 'View and manage events')} badge={L('Nouveau', 'New')} onPress={() => navigation.navigate('Events')} />
      <Item icon="🛍️" title={L('Boutique', 'Shop')} sub={L('Catalogue, commandes, clients', 'Catalog, orders, customers')} badge={L('Nouveau', 'New')} onPress={() => navigation.navigate('Home', { screen: 'Shop' })} />
      <Item icon="🔔" title={L('Notifications', 'Notifications')} sub={L('Messages, groupes et appels', 'Messages, groups and calls')} onPress={() => go('notifications')} />
      <Item icon="📊" title={L('Stockage et données', 'Storage and data')} sub={L('Utilisation réseau, téléchargement auto.', 'Network usage, auto-download')} onPress={() => go('storage')} />
      <Item icon="♿" title={L('Accessibilité', 'Accessibility')} sub={L('Taille du texte, contraste', 'Text size, contrast')} onPress={() => go('accessibility')} />
      <Item icon="🌐" title={L("Langue de l'application", 'App language')} sub={lang} onPress={() => go('language')} />
      <Item icon="❓" title={L('Aide et commentaires', 'Help and feedback')} sub={L('Questions, nous contacter, confidentialité', 'FAQ, contact us, privacy')} onPress={() => go('help')} />
      <Item icon="🤝" title={L('Inviter une personne', 'Invite a friend')} onPress={() => Share.share({ message: invitationText(profile && profile.display_name) })} />
      <Item icon="⬆️" title={L("Mises à jour de l'application", 'App updates')} sub={L('Télécharger la dernière version', 'Download the latest version')} onPress={() => Linking.openURL(UPDATE_URL)} />

      <Muted style={{ textAlign: 'center', padding: 24 }}>Unichat + · v1.4.0</Muted>
    </ScrollView>
  );
}
