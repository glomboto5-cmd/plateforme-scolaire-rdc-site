import React, { useEffect } from 'react';
import { Text, View, Pressable } from 'react-native';
import { L } from '../lib/i18n';

// Version web : les appels audio/vidéo sont disponibles dans l'application Android
export default function CallScreen({ route, navigation }) {
  const { callId } = route.params || {};
  useEffect(() => {
    if (callId) {
      const { supabase } = require('../lib/supabase');
      if (!(route.params && route.params.incoming)) supabase.from('calls').update({ status: 'failed', ended_at: new Date().toISOString() }).eq('id', callId).then(() => {});
    }
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: '#0B141A', alignItems: 'center', justifyContent: 'center', padding: 30 }}>
      <Text style={{ fontSize: 50 }}>📱</Text>
      <Text style={{ color: '#fff', fontSize: 18, textAlign: 'center', marginTop: 16 }}>
        {L("Les appels audio et vidéo se font depuis l'application Android Angechat.", 'Calls are available in the Android app.')}
      </Text>
      <Pressable onPress={() => navigation.goBack()} style={{ marginTop: 24, backgroundColor: '#1DAA61', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 22 }}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>{L('Retour', 'Back')}</Text>
      </Pressable>
    </View>
  );
}
