import { Alert } from 'react-native';
import { supabase } from './supabase';
import { L, t } from './i18n';
import { avatarUri } from './chat';

// Réunion internationale (points 17 à 21) : appel audio/vidéo de groupe
export const MEETING_MAX = 8;

export async function startMeeting(navigation, conv, media, userId) {
  if (!conv) return;
  const n = (conv.participants || []).length;
  if (n > 100) return Alert.alert(L('Réunion', 'Meeting'), L('Ce groupe est trop grand pour une réunion vidéo.', 'This group is too large.'));
  const { data, error } = await supabase
    .from('calls')
    .insert({ conversation_id: conv.id, initiator_id: userId, media })
    .select('id')
    .single();
  if (error) return Alert.alert(t('error'), error.message);
  await supabase.from('call_participants').insert({ call_id: data.id, user_id: userId, joined_at: new Date().toISOString() });
  await supabase.from('messages').insert({
    conversation_id: conv.id,
    sender_id: userId,
    type: 'text',
    content: (media === 'video' ? '📹 ' : '📞 ') + L('Réunion démarrée — touchez « Rejoindre » dans l’en-tête pour participer.', 'Meeting started — tap Join in the header.'),
    metadata: { meeting_call_id: data.id },
  });
  navigation.navigate('Meeting', { callId: data.id, media, organizerId: userId, title: conv.name || conv.title });
}

export function joinMeeting(navigation, call, title) {
  navigation.navigate('Meeting', { callId: call.id, media: call.media, organizerId: call.initiator_id, title });
}
