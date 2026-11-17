import React, { useEffect, useState } from 'react';
import { Image, Linking, Platform, Pressable, Text, View } from 'react-native';
import { useApp } from '../AppContext';
import { L } from '../lib/i18n';
import { ActionSheet, Avatar } from './ui';
import { adMediaUrl, hideAd, openAd, recordImpression } from '../lib/ads';
import { avatarUri } from '../lib/chat';

let VideoView = null;
let useVideoPlayer = null;
try {
  const v = require('expo-video');
  VideoView = v.VideoView;
  useVideoPlayer = v.useVideoPlayer;
} catch (e) {}

function AdVideo({ uri }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = true; p.muted = true; });
  return <VideoView player={player} style={{ width: '100%', height: '100%' }} contentFit="cover" nativeControls allowsFullscreen />;
}

// Carte publicitaire, toujours marquée « Sponsorisé »
export default function AdCard({ ad, placement, navigation, compact, style }) {
  const { colors } = useApp();
  const [hidden, setHidden] = useState(false);
  const [menu, setMenu] = useState(false);
  const [why, setWhy] = useState(false);

  useEffect(() => { if (ad) recordImpression(ad, placement); }, [ad && ad.id, placement]);
  if (!ad || hidden) return null;
  const media = adMediaUrl(ad.media_path);
  const isVideo = ad.media_type === 'video';
  const adv = { avatar_url: ad.advertiser_avatar, display_name: ad.advertiser_name };

  return (
    <View style={[{ backgroundColor: colors.card, borderRadius: 16, marginHorizontal: 12, marginVertical: 8, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
        <Avatar uri={avatarUri(adv)} name={ad.advertiser_name} size={36} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={{ color: colors.text, fontWeight: '700' }} numberOfLines={1}>{ad.advertiser_name}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{L('Sponsorisé', 'Sponsored')}{ad.format === 'sponsored_post' ? ' · ' + L('Publication', 'Post') : ''}</Text>
        </View>
        <Pressable onPress={() => setMenu(true)} hitSlop={10} style={{ paddingHorizontal: 6 }}>
          <Text style={{ color: colors.textMuted, fontSize: 20 }}>⋮</Text>
        </Pressable>
      </View>

      {ad.format === 'sponsored_post' || !media ? (
        <Text style={{ color: colors.text, fontSize: compact ? 15 : 16, paddingHorizontal: 12, paddingBottom: 10 }} numberOfLines={compact ? 3 : 12}>
          <Text style={{ fontWeight: '700' }}>{ad.headline}</Text>
          {ad.body ? '\n' + ad.body : ''}
        </Text>
      ) : null}

      {media ? (
        <View style={{ width: '100%', aspectRatio: compact ? 1.9 : 1.2, backgroundColor: '#000' }}>
          {isVideo ? (
            VideoView && useVideoPlayer && Platform.OS !== 'web' ? (
              <AdVideo uri={media} />
            ) : (
              <Pressable onPress={() => Linking.openURL(media)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 18 }}>▶ {L('Lire la vidéo', 'Play video')}</Text>
              </Pressable>
            )
          ) : (
            <Pressable onPress={() => openAd(ad, placement, navigation)} style={{ flex: 1 }}>
              <Image source={{ uri: media }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            </Pressable>
          )}
        </View>
      ) : null}

      <Pressable onPress={() => openAd(ad, placement, navigation)} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 }}>
        <View style={{ flex: 1 }}>
          {ad.format !== 'sponsored_post' && media ? <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }} numberOfLines={2}>{ad.headline}</Text> : null}
          {ad.format !== 'sponsored_post' && media && ad.body ? <Text style={{ color: colors.textMuted, fontSize: 13 }} numberOfLines={2}>{ad.body}</Text> : null}
        </View>
        {ad.link_kind !== 'none' ? (
          <View style={{ backgroundColor: colors.brand, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>{ad.cta_label || L('En savoir plus', 'Learn more')}</Text>
          </View>
        ) : null}
      </Pressable>

      {why ? (
        <View style={{ padding: 12, paddingTop: 0 }}>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>
            ℹ️ {ad.reason}. {L('Vos discussions et vos appels ne sont jamais utilisés pour la publicité.', 'Your chats and calls are never used for ads.')}
          </Text>
        </View>
      ) : null}

      <ActionSheet
        visible={menu}
        title={L('Publicité', 'Ad')}
        actions={[
          { label: 'ℹ️  ' + L('Pourquoi je vois cette publicité ?', 'Why am I seeing this ad?'), onPress: () => setWhy(true) },
          { label: '🙈  ' + L('Masquer cette publicité', 'Hide this ad'), onPress: () => { setHidden(true); hideAd(ad, placement); } },
          { label: '⚙️  ' + L('Mes préférences publicitaires', 'My ad preferences'), onPress: () => navigation.navigate('AdPrefs') },
        ]}
        onClose={() => setMenu(false)}
      />
    </View>
  );
}
