import React, { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import * as Contacts from 'expo-contacts';
import { supabase, errText } from '../lib/supabase';
import { L, t } from '../lib/i18n';
import { useApp } from '../AppContext';
import { ActionSheet, Button, Muted } from '../components/ui';
import { cleanPhone } from '../lib/whatsapp';

const COUNTRIES = [
  ['CD', '+243'], ['CG', '+242'], ['AO', '+244'], ['CM', '+237'], ['RW', '+250'], ['BI', '+257'], ['UG', '+256'], ['KE', '+254'],
  ['TZ', '+255'], ['ZM', '+260'], ['ZA', '+27'], ['NG', '+234'], ['CI', '+225'], ['SN', '+221'], ['BJ', '+229'], ['TG', '+228'],
  ['GA', '+241'], ['CF', '+236'], ['TD', '+235'], ['FR', '+33'], ['BE', '+32'], ['CH', '+41'], ['CA', '+1'], ['US', '+1'],
  ['GB', '+44'], ['CN', '+86'], ['AE', '+971'], ['TR', '+90'], ['IN', '+91'], ['BR', '+55'], ['PT', '+351'], ['ES', '+34'],
];

export default function NewContactScreen({ navigation }) {
  const { colors, userId } = useApp();
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [handle, setHandle] = useState('');
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [phone, setPhone] = useState('');
  const [sync, setSync] = useState(Platform.OS !== 'web');
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);

  const name = [first.trim(), last.trim()].filter(Boolean).join(' ');
  const canSave = !!name && (!!phone.trim() || !!handle.trim());

  const field = (props) => (
    <TextInput
      placeholderTextColor={colors.textMuted}
      {...props}
      style={[{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 16, fontSize: 17, color: colors.text, backgroundColor: colors.card }, props.style]}
    />
  );

  const save = async () => {
    setBusy(true);
    try {
      let e164 = null;
      if (phone.trim()) {
        const d = cleanPhone(phone).replace(/^0+/, '');
        const full = phone.trim().startsWith('+') ? cleanPhone(phone) : cleanPhone(country[1]) + d;
        if (!/^[1-9]\d{7,14}$/.test(full)) throw new Error(L('Numéro de téléphone invalide', 'Invalid phone number'));
        e164 = '+' + full;
      }
      const { data: found } = await supabase.rpc('find_user', { p_handle: handle.trim() || null, p_phone: e164 });
      const user = found && found[0];
      if (user && user.id === userId) throw new Error(L('Ce compte est le vôtre.', 'This is your own account.'));
      const row = { owner_id: userId, display_name: name, phone_e164: e164, contact_user_id: user ? user.id : null };
      const { error } = user
        ? await supabase.from('contacts').upsert(row, { onConflict: 'owner_id,contact_user_id' })
        : await supabase.from('contacts').insert(row);
      if (error) throw error;

      if (sync && e164 && Platform.OS !== 'web') {
        const perm = await Contacts.requestPermissionsAsync();
        if (perm.status === 'granted') {
          await Contacts.addContactAsync({
            [Contacts.Fields.FirstName]: first.trim(),
            [Contacts.Fields.LastName]: last.trim(),
            name,
            contactType: Contacts.ContactTypes.Person,
            [Contacts.Fields.PhoneNumbers]: [{ label: 'mobile', number: e164, isPrimary: true }],
          });
        }
      }
      setBusy(false);
      if (user) {
        Alert.alert(L('Contact enregistré', 'Contact saved'), L(`${name} est sur Unichat +. Vous pouvez lui écrire.`, `${name} is on Unichat +.`), [
          { text: 'OK', onPress: () => navigation.goBack() },
          {
            text: L('Écrire', 'Message'),
            onPress: async () => {
              const { data } = await supabase.rpc('get_or_create_direct_conversation', { p_other: user.id });
              if (data) navigation.replace('Chat', { id: data });
            },
          },
        ]);
      } else {
        Alert.alert(L('Contact enregistré', 'Contact saved'), L(`${name} n'est pas encore sur Unichat +. Vous pourrez l'inviter.`, `${name} is not on Unichat + yet.`), [{ text: 'OK', onPress: () => navigation.goBack() }]);
      }
    } catch (e) {
      setBusy(false);
      Alert.alert(t('error'), errText(e));
    }
  };

  const Icon = ({ c }) => <Text style={{ width: 44, fontSize: 24, color: colors.textMuted, textAlign: 'center' }}>{c}</Text>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon c="👤" />
          <View style={{ flex: 1 }}>{field({ placeholder: L('Prénom', 'First name'), value: first, onChangeText: setFirst, autoFocus: true })}</View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon c="" />
          <View style={{ flex: 1 }}>{field({ placeholder: L('Nom', 'Last name'), value: last, onChangeText: setLast })}</View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon c="@" />
          <View style={{ flex: 1 }}>{field({ placeholder: L('Nom de profil', 'Profile name'), value: handle, onChangeText: setHandle, autoCapitalize: 'none' })}</View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon c="📞" />
          <Pressable onPress={() => setSheet(true)} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 16, backgroundColor: colors.card }}>
            <Muted style={{ fontSize: 11, position: 'absolute', top: -9, left: 10, backgroundColor: colors.bg, paddingHorizontal: 4 }}>{L('Pays', 'Country')}</Muted>
            <Text style={{ color: colors.text, fontSize: 17 }}>{country[0]} {country[1]} ▾</Text>
          </Pressable>
          <View style={{ flex: 1 }}>{field({ placeholder: L('Téléphone', 'Phone'), value: phone, onChangeText: setPhone, keyboardType: 'phone-pad' })}</View>
        </View>

        {Platform.OS !== 'web' ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <Icon c="🔄" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 17 }}>{L('Synchroniser le contact sur le téléphone', 'Sync contact to phone')}</Text>
              <Muted>{L('Seuls les contacts avec un numéro de téléphone peuvent être synchronisés', 'Only contacts with a phone number can be synced')}</Muted>
            </View>
            <Switch value={sync} onValueChange={setSync} trackColor={{ true: colors.brand }} />
          </View>
        ) : null}
      </ScrollView>
      <View style={{ padding: 16 }}>
        <Button title={L('Enregistrer', 'Save')} onPress={save} loading={busy} disabled={!canSave} />
      </View>
      <ActionSheet
        visible={sheet}
        title={L('Pays', 'Country')}
        actions={COUNTRIES.map((c) => ({ label: (c === country ? '● ' : '○ ') + c[0] + '  ' + c[1], onPress: () => setCountry(c) }))}
        onClose={() => setSheet(false)}
      />
    </View>
  );
}
