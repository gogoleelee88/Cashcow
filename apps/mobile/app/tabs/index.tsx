import { useState } from 'react';
import {
  View, Text, ScrollView, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, Dimensions,
} from 'react-native';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ExpoImage as Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Flame, TrendingUp, Clock, ChevronRight, Sparkles, Zap } from 'lucide-react-native';
import { mobileApi } from '../../src/lib/api';
import { formatCount, getCharacterAvatarUrl, CATEGORY_LABELS, CATEGORY_ICONS } from '@characterverse/utils';
import type { CharacterListItem, CharacterCategory } from '@characterverse/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;
const CARD_HEIGHT = CARD_WIDTH * 1.4;

const COLORS = {
  bg: '#0d0b18',
  surface: '#1a1729',
  brand: '#7c5cfc',
  textPrimary: '#f0ecff',
  textSecondary: '#b8b0d8',
  textMuted: '#7b7299',
  border: '#2d2a4a',
};

const SORT_OPTIONS = [
  { value: 'trending', label: '트렌딩', icon: Flame },
  { value: 'newest', label: '최신', icon: Clock },
  { value: 'popular', label: '인기', icon: TrendingUp },
];

const FEATURED_CATEGORIES: CharacterCategory[] = ['ANIME', 'GAME', 'ORIGINAL', 'MOVIE', 'VTUBER'];

export default function HomeScreen() {
  const [activeSort, setActiveSort] = useState('trending');
  const [activeCategory, setActiveCategory] = useState<CharacterCategory | undefined>();
  const router = useRouter();

  const { data: trendingData, isLoading: trendingLoading } = useQuery({
    queryKey: ['trending-mobile'],
    queryFn: () => mobileApi.characters.trending(),
    staleTime: 1000 * 60 * 5,
  });

  const {
    data: feedData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ['feed-mobile', activeSort, activeCategory],
    queryFn: ({ pageParam = 1 }) =>
      mobileApi.characters.list({ page: pageParam, limit: 20, sort: activeSort, category: activeCategory }),
    getNextPageParam: (last: any) => last.meta?.hasMore ? last.meta.page + 1 : undefined,
    initialPageParam: 1,
  });

  const trending = trendingData?.data ?? [];
  const characters = feedData?.pages.flatMap((p: any) => p.data) ?? [];

  const renderCharacterCard = ({ item, index }: { item: CharacterListItem; index: number }) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.card, { width: CARD_WIDTH }]}
      onPress={() => router.push(`/characters/${item.id}`)}
      activeOpacity={0.85}
    >
      <View style={styles.cardImageContainer}>
        <Image
          source={{ uri: item.avatarUrl || getCharacterAvatarUrl(null, item.name) }}
          style={styles.cardImage}
          contentFit="cover"
        />
        <LinearGradient
          colors={['transparent', 'rgba(13,11,24,0.97)']}
          style={styles.cardGradient}
          start={{ x: 0, y: 0.3 }}
          end={{ x: 0, y: 1 }}
        />
        <View style={styles.cardBadge}>
          <Text style={styles.cardBadgeText}>{CATEGORY_LABELS[item.category]}</Text>
        </View>
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
        <View style={styles.cardStats}>
          <Text style={styles.cardStatText}>💬 {formatCount(item.chatCount)}</Text>
          <Text style={styles.cardStatText}>❤️ {formatCount(item.likeCount)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const ListHeader = () => (
    <View>
      {/* Trending Section */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitle}>
          <Text style={{ color: '#f97316', marginRight: 4 }}>🔥</Text>
          <Text style={styles.sectionTitleText}>지금 트렌딩</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/explore?sort=trending')}>
          <Text style={styles.seeAllText}>전체 보기</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
        {trendingLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <View key={i} style={[styles.trendingCard, styles.skeleton]} />
            ))
          : trending.slice(0, 8).map((char: any) => (
              <TouchableOpacity
                key={char.id}
                style={styles.trendingCard}
                onPress={() => router.push(`/characters/${char.id}`)}
              >
                <Image
                  source={{ uri: char.avatarUrl || getCharacterAvatarUrl(null, char.name) }}
                  style={styles.trendingImage}
                  contentFit="cover"
                />
                <LinearGradient
                  colors={['transparent', 'rgba(13,11,24,0.95)']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0.4 }}
                  end={{ x: 0, y: 1 }}
                />
                <Text style={styles.trendingName} numberOfLines={1}>{char.name}</Text>
              </TouchableOpacity>
            ))}
      </ScrollView>

      {/* Category Pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 16 }}>
        <TouchableOpacity
          style={[styles.pill, !activeCategory && styles.pillActive]}
          onPress={() => setActiveCategory(undefined)}
        >
          <Text style={[styles.pillText, !activeCategory && styles.pillTextActive]}>전체</Text>
        </TouchableOpacity>
        {FEATURED_CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.pill, activeCategory === cat && styles.pillActive]}
            onPress={() => setActiveCategory(cat === activeCategory ? undefined : cat)}
          >
            <Text style={[styles.pillText, activeCategory === cat && styles.pillTextActive]}>
              {CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Sort Tabs */}
      <View style={styles.sortContainer}>
        {SORT_OPTIONS.map(({ value, label }) => (
          <TouchableOpacity
            key={value}
            style={[styles.sortTab, activeSort === value && styles.sortTabActive]}
            onPress={() => setActiveSort(value)}
          >
            <Text style={[styles.sortTabText, activeSort === value && styles.sortTabTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={characters}
        renderItem={renderCharacterCard}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={ListHeader}
        onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={COLORS.brand}
            colors={[COLORS.brand]}
          />
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <ActivityIndicator color={COLORS.brand} style={{ marginVertical: 16 }} />
          ) : null
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>캐릭터를 찾을 수 없어요</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  listContent: { paddingBottom: 24 },
  row: { paddingHorizontal: 16, gap: 10, marginBottom: 10 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardImageContainer: { height: CARD_HEIGHT * 0.65, position: 'relative' },
  cardImage: { width: '100%', height: '100%' },
  cardGradient: { ...StyleSheet.absoluteFillObject },
  cardBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(124,92,252,0.25)',
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(124,92,252,0.3)',
  },
  cardBadgeText: { color: '#a590fd', fontSize: 10, fontWeight: '600' },
  cardInfo: { padding: 10 },
  cardName: { color: COLORS.textPrimary, fontWeight: '700', fontSize: 13, marginBottom: 3 },
  cardDesc: { color: COLORS.textMuted, fontSize: 11, lineHeight: 15, marginBottom: 6 },
  cardStats: { flexDirection: 'row', gap: 10 },
  cardStatText: { color: COLORS.textMuted, fontSize: 11 },
  skeleton: { backgroundColor: COLORS.surface, opacity: 0.6 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  sectionTitle: { flexDirection: 'row', alignItems: 'center' },
  sectionTitleText: { color: COLORS.textPrimary, fontWeight: '700', fontSize: 16 },
  seeAllText: { color: '#7c5cfc', fontSize: 13 },
  trendingCard: {
    width: 120,
    height: 170,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    position: 'relative',
    justifyContent: 'flex-end',
  },
  trendingImage: { ...StyleSheet.absoluteFillObject },
  trendingName: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '600',
    padding: 8,
    zIndex: 1,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 99,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pillActive: { backgroundColor: '#7c5cfc', borderColor: '#7c5cfc' },
  pillText: { color: COLORS.textMuted, fontSize: 13, fontWeight: '500' },
  pillTextActive: { color: '#fff' },
  sortContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 6,
    marginBottom: 12,
  },
  sortTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
  },
  sortTabActive: { backgroundColor: 'rgba(124,92,252,0.15)', borderWidth: 1, borderColor: 'rgba(124,92,252,0.3)' },
  sortTabText: { color: COLORS.textMuted, fontSize: 13, fontWeight: '500' },
  sortTabTextActive: { color: '#a590fd' },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: COLORS.textMuted, fontSize: 14 },
});
