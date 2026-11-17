import { Alert } from 'react-native';
import { supabase } from './supabase';
import { L, t } from './i18n';
import { avatarUri } from './chat';

// Démarre un appel audio ou vidéo dans une discussion privée
export async function startCall(navigation, conv, media, userId) {
  if (!conv || conv.type !== 'direct') {
    return Alert.alert(L('Appels', 'Calls'), L('Les appels de groupe arrivent bientôt. Pour l’instant, appelez une personne depuis une discussion privée.', 'Group calls are coming soon.'));
  }
  const { data, error } = await supabase
    .from('calls')
    .insert({ conversation_id: conv.id, initiator_id: userId, media })
    .select('id')
    .single();
  if (error) return Alert.alert(t('error'), error.message);
  await supabase.from('call_participants').insert({ call_id: data.id, user_id: userId, joined_at: new Date().toISOString() });
  navigation.navigate('Call', {
    callId: data.id,
    media,
    incoming: false,
    peerName: conv.other ? conv.other.display_name : conv.name,
    peerAvatar: conv.other ? avatarUri(conv.other) : conv.avatar,
  });
}
