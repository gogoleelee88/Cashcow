import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { CharacterCard } from '../../src/components/CharacterCard';
import { colors } from '@characterverse/ui';
import { useAuthStore } from '../../src/stores/auth.store';

type Tab = 'favorites' | 'liked';

export default function FavoritesScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('favorites');

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['mobile-favorites', activeTab],
    queryFn: ({ pageParam = undefined }) =>
      api.characters.getList({
        [activeTab === 'favorites' ? 'favorited' : 'liked']: true,
        cursor: pageParam as string | undefined,
        limit: 20,
        sort: 'popular',
      }),
    getNextPageParam: (last: any) => last.data?.nextCursor,
    initialPageParam: undefined,
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) {
    return (
      <View style={styles.centered}>
        <Ionicons name="star-outline" size={48} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>로그인이 필요해요</Text>
        <TouchableOpacity onPress={() => router.push('/auth/login')} style={styles.loginBtn}>
          <Text style={styles.loginBtnText}>로그인</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const characters = data?.pages.flatMap((p: any) => p.data?.items ?? []) ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>즐겨찾기</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {([
          { id: 'favorites' as Tab, label: '즐겨찾기', icon: 'star' },
          { id: 'liked' as Tab, label: '좋아요', icon: 'heart' },
        ] as { id: Tab; label: string; icon: any }[]).map(tab => (
          <TouchableOpacity
            key={tab.id}
            onPress={() => setActiveTab(tab.id)}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
          >
            <Ionicons
              name={tab.icon}
              size={15}
              color={activeTab === tab.id ? '#fff' : colors.textMuted}
            />
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} />
      ) : characters.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="bookmark-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>
            {activeTab === 'favorites' ? '즐겨찾기한 캐릭터가 없어요' : '좋아요한 캐릭터가 없어요'}
          </Text>
          <TouchableOpacity onPress={() => router.push('/')} style={styles.loginBtn}>
            <Text style={styles.loginBtnText}>탐색하기</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={characters}
          keyExtractor={(item: any) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          onEndReached={() => hasNextPage && fetchNextPage()}
          onEndReachedThreshold={0.5}
          ListFooterComponent={isFetchingNextPage ? (
            <ActivityIndicator color={colors.brand} style={{ marginVertical: 16 }} />
          ) : null}
          renderItem={({ item }: { item: any }) => (
            <CharacterCard
              character={item}
              onPress={() => router.push(`/characters/${item.id}`)}
              style={{ flex: 1, margin: 6 }}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12 },
  title: { color: colors.textPrimary, fontSize: 24, fontWeight: '700' },
  tabs: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16,
    marginBottom: 16, backgroundColor: colors.surface,
    padding: 4, borderRadius: 12, marginHorizontal: 16,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 8, borderRadius: 10,
  },
  tabActive: { backgroundColor: colors.brand },
  tabText: { color: colors.textMuted, fontSize: 13, fontWeight: '500' },
  tabTextActive: { color: '#fff' },
  columnWrapper: { paddingHorizontal: 10 },
  listContent: { paddingBottom: 100 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '600', marginTop: 12, textAlign: 'center' },
  loginBtn: {
    marginTop: 16, backgroundColor: colors.brand,
    paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10,
  },
  loginBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
