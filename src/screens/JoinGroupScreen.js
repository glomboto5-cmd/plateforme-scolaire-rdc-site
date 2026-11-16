import React, { useState } from 'react';
import { Alert, View, Text } from 'react-native';
import { supabase, errText } from '../lib/supabase';
import { t } from '../lib/i18n';
import { useApp } from '../AppContext';
import { Avatar, Button, Input, Muted, Title } from '../components/ui';

export function extractCode(raw) {
  const s = (raw || '').trim();
  const m = /([0-9a-f]{32})/i.exec(s);
  return m ? m[1].toLowerCase() : s;
}

export default function JoinGroupScreen({ navigation, route }) {
  const { colors } = useApp();
  const [raw, setRaw] = useState((route.params && route.params.code) || '');
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  const look = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('preview_invite_link', { p_code: extractCode(raw) });
    setLoading(false);
    if (error) return Alert.alert(t('error'), errText(error));
    if (!data || !data.length) return Alert.alert(t('error'), 'Lien invalide ou expiré');
    setInfo(data[0]);
  };

  const join = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('join_group_by_link', { p_code: extractCode(raw) });
    setLoading(false);
    if (error) return Alert.alert(t('error'), errText(error));
    if (data === 'pending_approval') {
      Alert.alert(t('joinWithCode'), t('pendingApproval'));
      return navigation.goBack();
    }
    if (data === 'already_member') Alert.alert(t('joinWithCode'), t('alreadyMember'));
    navigation.replace('Chat', { id: info.conversation_id });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 16, gap: 12 }}>
      <Input placeholder={t('pasteCode')} value={raw} onChangeText={(v) => { setRaw(v); setInfo(null); }} autoCapitalize="none" />
      {!info ? (
        <Button title={t('continue')} onPress={look} loading={loading} disabled={!raw.trim()} />
      ) : (
        <View style={{ alignItems: 'center', gap: 10, marginTop: 12 }}>
          <Avatar uri={info.avatar_url} name={info.title} size={80} />
          <Title style={{ fontSize: 20 }}>{info.title}</Title>
          {info.description ? <Muted style={{ textAlign: 'center' }}>{info.description}</Muted> : null}
          <Muted>{info.member_count} {t('members_count')}</Muted>
          {info.approval_required ? <Text style={{ color: colors.accent }}>{t('approval')}</Text> : null}
          <Button title={t('join')} onPress={join} loading={loading} style={{ alignSelf: 'stretch', marginTop: 8 }} />
        </View>
      )}
    </View>
  );
}
