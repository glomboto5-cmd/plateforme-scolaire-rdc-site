import React from 'react';
import { Text, View } from 'react-native';
import { t } from '../lib/i18n';
import { useApp } from '../AppContext';
import { Muted } from '../components/ui';

export default function ComingSoonScreen({ route }) {
  const { colors } = useApp();
  const icon = (route.params && route.params.icon) || '✨';
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: colors.bg }}>
      <Text style={{ fontSize: 56 }}>{icon}</Text>
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', marginTop: 12 }}>{t('comingSoon')}</Text>
      <Muted style={{ textAlign: 'center', marginTop: 8 }}>{t('comingSoonText')}</Muted>
    </View>
  );
}
