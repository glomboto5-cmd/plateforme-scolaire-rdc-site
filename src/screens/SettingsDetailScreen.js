import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { supabase, errText } from '../lib/supabase';
import { L, LANGUAGES, t } from '../lib/i18n';
import { useApp } from '../AppContext';
import { ActionSheet, Avatar, Button, Muted, Title } from '../components/ui';
import { avatarUri, formatTime } from '../lib/chat';

const TITLES = {
  devices: ['Appareils connectés', 'Linked devices'],
  account: ['Compte', 'Account'],
  privacy: ['Confidentialité', 'Privacy'],
  lists: ['Listes', 'Lists'],
  chats: ['Discussions', 'Chats'],
  appearance: ['Apparence', 'Appearance'],
  notifications: ['Notifications', 'Notifications'],
  storage: ['Stockage et données', 'Storage and data'],
  accessibility: ['Accessibilité', 'Accessibility'],
  language: ["Langue de l'application", 'App language'],
  help: ['Aide et commentaires', 'Help and feedback'],
};

const VIS = () => [
  { value: 'everyone', label: L('Tout le monde', 'Everyone') },
  { value: 'contacts', label: L('Mes contacts', 'My contacts') },
  { value: 'nobody', label: L('Personne', 'Nobody') },
];

export default function SettingsDetailScreen({ route, navigation }) {
  const { section } = route.params;
  const { colors, userId, profile, settings, updateSettings, signOut } = useApp();
  const s = settings || {};
  const [sheet, setSheet] = useState(null);
  const [devices, setDevices] = useState([]);
  const [account, setAccount] = useState(null);
  const [contacts, setContacts] = useState([]);

  useEffect(() => {
    navigation.setOptions({ title: L(...TITLES[section]) });
  }, [section]);

  const load = useCallback(async () => {
    if (section === 'devices') {
      const { data } = await supabase.from('user_devices').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20);
      setDevices(data || []);
    }
    if (section === 'account') {
      const { data } = await supabase.from('account_details').select('email,phone_e164,created_at').eq('user_id', userId).maybeSingle();
      setAccount(data);
    }
    if (section === 'privacy' || section === 'lists') {
      const { data } = await supabase
        .from('contacts')
        .select('id,display_name,is_blocked,is_favorite,is_customer,contact_user_id,profiles!contacts_contact_user_id_fkey(display_name,avatar_url)')
        .eq('owner_id', userId)
        .order('display_name');
      setContacts(data || []);
    }
  }, [section, userId]);

  useEffect(() => { load(); }, [load]);

  const choose = (title, options, current, onPick) =>
    setSheet({ title, actions: options.map((o) => ({ label: (o.value === current ? '● ' : '○ ') + o.label, onPress: () => onPick(o.value) })) });

  const Row = ({ title, sub, onPress, right }) => (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: pressed ? colors.bgAlt : colors.bg })}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 16 }}>{title}</Text>
        {sub ? <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 2 }}>{sub}</Text> : null}
      </View>
      {right}
    </Pressable>
  );
  const Toggle = ({ title, sub, value, onChange }) => (
    <Row title={title} sub={sub} right={<Switch value={!!value} onValueChange={onChange} trackColor={{ true: colors.primary }} />} />
  );
  const Head = ({ children }) => (
    <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 6 }}>{children}</Text>
  );
  const visLabel = (v) => (VIS().find((x) => x.value === v) || VIS()[1]).label;

  const setContact = async (c, patch) => {
    const { error } = await supabase.from('contacts').update(patch).eq('id', c.id);
    if (error) Alert.alert(t('error'), errText(error));
    load();
  };

  const ephemeralLabel = () => {
    if (s.default_ephemeral_mode === 'off' || !s.default_ephemeral_seconds) return L('Désactivés', 'Off');
    const d = Math.round(s.default_ephemeral_seconds / 86400);
    return d === 1 ? '24 h' : d + ' ' + L('jours', 'days');
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 40 }}>
      {section === 'devices' && (
        <>
          <Muted style={{ padding: 20 }}>
            {L(
              "Angechat n'autorise qu'un seul appareil actif à la fois. Quand vous vous connectez sur un nouvel appareil, l'ancien est déconnecté automatiquement.",
              'Only one device can be active at a time.'
            )}
          </Muted>
          {devices.map((d) => (
            <Row
              key={d.id}
              title={(d.platform === 'android' ? '🤖 ' : d.platform === 'ios' ? '🍎 ' : '🌐 ') + (d.device_name || d.platform)}
              sub={d.is_active ? L('✅ Actif — cet appareil', '✅ Active — this device') : L('Déconnecté', 'Logged out') + ' · ' + formatTime(d.revoked_at || d.last_seen_at || d.created_at, t)}
            />
          ))}
          <View style={{ padding: 20 }}>
            <Button title={L('Se déconnecter', 'Log out')} variant="danger" onPress={() => Alert.alert(L('Se déconnecter ?', 'Log out?'), '', [{ text: t('cancel'), style: 'cancel' }, { text: 'OK', onPress: signOut }])} />
          </View>
        </>
      )}

      {section === 'account' && (
        <>
          <Head>{L('INFORMATIONS DU COMPTE', 'ACCOUNT INFO')}</Head>
          <Row title={L('Adresse e-mail', 'Email')} sub={account ? account.email : '…'} />
          <Row title={L('Téléphone', 'Phone')} sub={account && account.phone_e164 ? account.phone_e164 : L('Non renseigné (facultatif)', 'Not set (optional)')} onPress={() => navigation.navigate('Profile')} />
          <Row title={L('Identifiant', 'Handle')} sub={profile ? '@' + profile.handle : ''} />
          <Row title={L('Compte professionnel', 'Business account')} sub={profile && profile.is_business ? '✅ ' + (profile.business_name || L('Activé', 'On')) : L('Désactivé', 'Off')} onPress={() => navigation.navigate('Profile')} />
          <Row title={L('Membre depuis', 'Member since')} sub={account ? new Date(account.created_at).toLocaleDateString() : ''} />
          <Head>{L('SÉCURITÉ', 'SECURITY')}</Head>
          <Row title={L('Connexion sans mot de passe', 'Passwordless sign-in')} sub={L('Un code temporaire est envoyé à votre e-mail à chaque connexion.', 'A temporary code is emailed at each sign-in.')} />
          <View style={{ padding: 20 }}>
            <Button title={L('Se déconnecter', 'Log out')} variant="danger" onPress={() => Alert.alert(L('Se déconnecter ?', 'Log out?'), '', [{ text: t('cancel'), style: 'cancel' }, { text: 'OK', onPress: signOut }])} />
          </View>
        </>
      )}

      {section === 'privacy' && (
        <>
          <Head>{L('QUI PEUT VOIR MES INFOS', 'WHO CAN SEE MY INFO')}</Head>
          <Row title={L('Vu à', 'Last seen')} sub={visLabel(s.last_seen_visibility)} onPress={() => choose(L('Vu à', 'Last seen'), VIS(), s.last_seen_visibility, (v) => updateSettings({ last_seen_visibility: v }))} />
          <Row title={L('Photo de profil', 'Profile photo')} sub={visLabel(s.avatar_visibility)} onPress={() => choose(L('Photo de profil', 'Profile photo'), VIS(), s.avatar_visibility, (v) => updateSettings({ avatar_visibility: v }))} />
          <Row title={L('Infos (À propos)', 'About')} sub={visLabel(s.about_visibility)} onPress={() => choose(L('À propos', 'About'), VIS(), s.about_visibility, (v) => updateSettings({ about_visibility: v }))} />
          <Row title={L('Statut', 'Status')} sub={visLabel(s.status_visibility)} onPress={() => choose(L('Statut', 'Status'), VIS(), s.status_visibility, (v) => updateSettings({ status_visibility: v }))} />
          <Row title={L('Groupes', 'Groups')} sub={L('Qui peut m’ajouter : ', 'Who can add me: ') + visLabel(s.group_add_permission)} onPress={() => choose(L('Qui peut m’ajouter aux groupes', 'Who can add me to groups'), VIS(), s.group_add_permission, (v) => updateSettings({ group_add_permission: v }))} />
          <Toggle title={L('Confirmations de lecture', 'Read receipts')} sub={L('Si désactivé, vous ne verrez pas non plus celles des autres.', 'If off, you won’t see others’ either.')} value={s.read_receipts !== false} onChange={(v) => updateSettings({ read_receipts: v })} />
          <Head>{L('CONTENU', 'CONTENT')}</Head>
          <Row
            title={L('Messages éphémères par défaut', 'Default message timer')}
            sub={ephemeralLabel()}
            onPress={() =>
              setSheet({
                title: L('Messages éphémères par défaut', 'Default message timer'),
                actions: [
                  { label: L('Désactivés', 'Off'), onPress: () => updateSettings({ default_ephemeral_mode: 'off', default_ephemeral_seconds: null }) },
                  { label: '24 h', onPress: () => updateSettings({ default_ephemeral_mode: 'preset', default_ephemeral_seconds: 86400 }) },
                  { label: L('7 jours', '7 days'), onPress: () => updateSettings({ default_ephemeral_mode: 'preset', default_ephemeral_seconds: 604800 }) },
                  { label: L('90 jours', '90 days'), onPress: () => updateSettings({ default_ephemeral_mode: 'preset', default_ephemeral_seconds: 7776000 }) },
                ],
              })
            }
          />
          <Head>{L('COMPTES BLOQUÉS', 'BLOCKED ACCOUNTS')} ({contacts.filter((c) => c.is_blocked).length})</Head>
          {contacts.filter((c) => c.is_blocked).map((c) => (
            <Row key={c.id} title={c.display_name} sub={L('Toucher pour débloquer', 'Tap to unblock')} onPress={() => setContact(c, { is_blocked: false })} />
          ))}
          {!contacts.some((c) => c.is_blocked) ? <Muted style={{ paddingHorizontal: 20 }}>{L('Aucun compte bloqué', 'No blocked accounts')}</Muted> : null}
        </>
      )}

      {section === 'lists' && (
        <>
          <Muted style={{ padding: 20 }}>{L('Classez vos contacts : favoris ★ et clients 🛍️. Les favoris apparaissent dans le filtre « Favoris ».', 'Sort your contacts into favorites and customers.')}</Muted>
          {contacts.filter((c) => !c.is_blocked).map((c) => (
            <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10 }}>
              <Avatar uri={avatarUri(c.profiles)} name={c.display_name} size={42} />
              <Title style={{ flex: 1, marginLeft: 12 }} numberOfLines={1}>{c.display_name}</Title>
              <Pressable onPress={() => setContact(c, { is_favorite: !c.is_favorite })} style={{ padding: 8 }}>
                <Text style={{ fontSize: 22, opacity: c.is_favorite ? 1 : 0.3 }}>★</Text>
              </Pressable>
              <Pressable onPress={() => setContact(c, { is_customer: !c.is_customer })} style={{ padding: 8 }}>
                <Text style={{ fontSize: 20, opacity: c.is_customer ? 1 : 0.3 }}>🛍️</Text>
              </Pressable>
            </View>
          ))}
          {!contacts.length ? <Muted style={{ paddingHorizontal: 20 }}>{L('Ajoutez des contacts depuis une discussion (nom en haut → Ajouter aux contacts).', 'Add contacts from a chat.')}</Muted> : null}
        </>
      )}

      {section === 'chats' && (
        <>
          <Head>{L('SAUVEGARDE', 'BACKUP')}</Head>
          <Toggle title={L('Sauvegarde automatique', 'Automatic backup')} sub={L('Vos messages sont conservés dans le cloud chiffré et restaurés sur votre nouvel appareil.', 'Messages are kept in the encrypted cloud.')} value={s.backup_auto !== false} onChange={(v) => updateSettings({ backup_auto: v })} />
          <Row
            title={L('Fréquence', 'Frequency')}
            sub={{ daily: L('Quotidienne', 'Daily'), weekly: L('Hebdomadaire', 'Weekly'), monthly: L('Mensuelle', 'Monthly'), manual: L('Manuelle', 'Manual') }[s.backup_frequency || 'daily']}
            onPress={() => choose(L('Fréquence', 'Frequency'), [
              { value: 'daily', label: L('Quotidienne', 'Daily') },
              { value: 'weekly', label: L('Hebdomadaire', 'Weekly') },
              { value: 'monthly', label: L('Mensuelle', 'Monthly') },
              { value: 'manual', label: L('Manuelle', 'Manual') },
            ], s.backup_frequency, (v) => updateSettings({ backup_frequency: v }))}
          />
          <Toggle title={L('Inclure les photos', 'Include photos')} value={s.backup_include_photos !== false} onChange={(v) => updateSettings({ backup_include_photos: v })} />
          <Toggle title={L('Inclure les vidéos', 'Include videos')} value={!!s.backup_include_videos} onChange={(v) => updateSettings({ backup_include_videos: v })} />
          <Head>{L('HISTORIQUE', 'HISTORY')}</Head>
          <Row title={L('Conservation', 'Retention')} sub={L("Aucune expiration automatique : vos messages restent jusqu'à ce que vous les supprimiez.", 'No automatic expiry.')} />
          <Toggle title={L('Traduction des messages', 'Message translation')} sub={L('Bientôt : traduire un message dans votre langue.', 'Coming soon.')} value={!!s.translation_enabled} onChange={(v) => updateSettings({ translation_enabled: v })} />
        </>
      )}

      {section === 'appearance' && (
        <>
          <Head>{L('THÈME', 'THEME')}</Head>
          {[['system', L('Comme le téléphone', 'System default')], ['light', L('Clair', 'Light')], ['dark', L('Sombre', 'Dark')]].map(([v, label]) => (
            <Row key={v} title={label} onPress={() => updateSettings({ theme: v })} right={<Text style={{ fontSize: 20, color: colors.primary }}>{(s.theme || 'system') === v ? '●' : '○'}</Text>} />
          ))}
        </>
      )}

      {section === 'notifications' && (
        <>
          <Toggle title={L('Notifications', 'Notifications')} sub={L('Messages, groupes, appels, commandes et paiements', 'Messages, groups, calls, orders and payments')} value={s.notifications_enabled !== false} onChange={(v) => updateSettings({ notifications_enabled: v })} />
          <Muted style={{ padding: 20 }}>
            {L(
              "Les sonneries se règlent aussi dans les paramètres du téléphone : Paramètres → Applications → Angechat → Notifications.",
              'Ringtones can also be set in the phone settings.'
            )}
          </Muted>
        </>
      )}

      {section === 'storage' && (
        <>
          <Head>{L('UTILISATION DU RÉSEAU', 'NETWORK USAGE')}</Head>
          <Row title={L('Économie de données', 'Data saver')} sub={L('Les photos sont compressées automatiquement avant l’envoi pour consommer moins de données mobiles.', 'Photos are compressed before sending.')} />
          <Row title={L('Médias', 'Media')} sub={L('Les photos et documents reçus ne sont téléchargés que lorsque vous les ouvrez.', 'Received media load only when opened.')} />
          <Row title={L('Mise à jour de l’application', 'App update')} sub={L('Version légère (≈ 30 Mo) pour les téléphones récents', 'Light version (~30 MB)')} />
        </>
      )}

      {section === 'accessibility' && (
        <>
          <Row title={L('Taille du texte', 'Text size')} sub={L('Angechat suit la taille de texte de votre téléphone : Paramètres du téléphone → Affichage → Taille de la police.', 'Follows your phone text size.')} />
          <Row title={L('Thème sombre', 'Dark theme')} sub={L('Améliore le contraste et réduit la fatigue des yeux.', 'Improves contrast.')} onPress={() => updateSettings({ theme: 'dark' })} />
        </>
      )}

      {section === 'language' && (
        <>
          {LANGUAGES.map((l) => (
            <Row key={l.code} title={l.label} onPress={() => updateSettings({ language: l.code, language_auto: false })} right={<Text style={{ fontSize: 20, color: colors.primary }}>{s.language === l.code ? '●' : '○'}</Text>} />
          ))}
          <Muted style={{ padding: 20 }}>{L('Les traductions sont ajoutées progressivement ; certaines sont encore à valider (notamment le lingala).', 'Translations are added progressively.')}</Muted>
        </>
      )}

      {section === 'help' && (
        <>
          <Head>{L('QUESTIONS FRÉQUENTES', 'FAQ')}</Head>
          <Row title={L('Je ne reçois pas le code', "I don't receive the code")} sub={L('Regardez dans les spams. Attendez quelques minutes entre deux demandes.', 'Check spam. Wait a few minutes between requests.')} />
          <Row title={L('Comment appeler ?', 'How to call?')} sub={L('Ouvrez une discussion privée et touchez 📞 ou 📹.', 'Open a private chat and tap 📞 or 📹.')} />
          <Row title={L('Comment vendre ?', 'How to sell?')} sub={L('Boutique → Mon catalogue → Ajouter un produit.', 'Shop → My catalog → Add a product.')} />
          <Row title={L('Contacts WhatsApp', 'WhatsApp contacts')} sub={L("Vos contacts du téléphone s'affichent dans Nouvelle discussion ; ceux qui ne sont pas inscrits peuvent être contactés sur WhatsApp ou invités.", 'Phone contacts appear in New chat.')} />
          <Head>{L('À PROPOS', 'ABOUT')}</Head>
          <Row title="Angechat" sub={L('Version 1.4.0 · Messagerie, appels, statuts, communautés et boutique', 'Version 1.4.0')} />
          <Row title={L('Confidentialité', 'Privacy')} sub={L('Vos données sont protégées par des règles d’accès strictes ; seuls les participants voient leurs discussions.', 'Your data is protected by strict access rules.')} />
        </>
      )}

      <ActionSheet visible={!!sheet} title={sheet && sheet.title} actions={sheet && sheet.actions} onClose={() => setSheet(null)} />
    </ScrollView>
  );
}
