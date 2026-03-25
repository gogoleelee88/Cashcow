import React from 'react';
import {
  View, Text, TouchableOpacity, Image,
  StyleSheet, ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@characterverse/ui';
import { formatCount, getCharacterAvatarUrl } from '@characterverse/utils';

interface CharacterCardProps {
  character: any;
  onPress: () => void;
  style?: ViewStyle;
}

export function CharacterCard({ character, onPress, style }: CharacterCardProps) {
  const [imageError, setImageError] = React.useState(false);
  const avatarSrc = imageError || !character.avatarUrl
    ? { uri: getCharacterAvatarUrl(null, character.name) }
    : { uri: character.avatarUrl };

  return (
    <TouchableOpacity style={[styles.card, style]} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.imageContainer}>
        <Image
          source={avatarSrc}
          style={styles.image}
          onError={() => setImageError(true)}
        />
        {character.isFeatured && (
          <View style={styles.featuredBadge}>
            <Ionicons name="star" size={10} color="#fff" />
            <Text style={styles.featuredText}>추천</Text>
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{character.name}</Text>
        <Text style={styles.description} numberOfLines={2}>{character.description}</Text>
        <View style={styles.stats}>
          <Ionicons name="chatbubble-outline" size={11} color={colors.textMuted} />
          <Text style={styles.statText}>{formatCount(character.chatCount)}</Text>
          <Ionicons name="heart-outline" size={11} color={colors.textMuted} style={{ marginLeft: 6 }} />
          <Text style={styles.statText}>{formatCount(character.likeCount)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: colors.border,
  },
  imageContainer: { position: 'relative', aspectRatio: 1 },
  image: { width: '100%', height: '100%' },
  featuredBadge: {
    position: 'absolute', top: 6, left: 6,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(124,92,252,0.9)',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  featuredText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  info: { padding: 10 },
  name: { color: colors.textPrimary, fontWeight: '600', fontSize: 13, marginBottom: 3 },
  description: { color: colors.textMuted, fontSize: 11, lineHeight: 15, marginBottom: 6 },
  stats: { flexDirection: 'row', alignItems: 'center' },
  statText: { color: colors.textMuted, fontSize: 11, marginLeft: 3 },
});
