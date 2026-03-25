import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { CharacterCard } from '../../src/components/CharacterCard';
import { colors } from '@characterverse/ui';
import { CATEGORY_LABELS } from '@characterverse/utils';
import { useDebounce } from '../../src/hooks/useDebounce';

const CATEGORIES = Object.keys(CATEGORY_LABELS) as (keyof typeof CATEGORY_LABELS)[];

export default function ExploreScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search, 400);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['explore', debouncedSearch, selectedCategory],
    queryFn: ({ pageParam = undefined }) =>
      api.characters.getList({
        q: debouncedSearch || undefined,
        category: selectedCategory || undefined,
        cursor: pageParam as string | undefined,
        limit: 20,
        sort: 'popular',
      }),
    getNextPageParam: (last: any) => last.data?.nextCursor,
    initialPageParam: undefined,
  });

  const characters = data?.pages.flatMap((p: any) => p.data?.items ?? []) ?? [];

  const renderHeader = useCallback(() => (
    <View>
      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="캐릭터 검색..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Categories */}
      <FlatList
        horizontal
        data={[{ id: null, label: '전체' }, ...CATEGORIES.map(c => ({ id: c, label: CATEGORY_LABELS[c] }))]}
        keyExtractor={(item) => String(item.id ?? 'all')}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoriesContainer}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => setSelectedCategory(item.id)}
            style={[
              styles.categoryPill,
              selectedCategory === item.id && styles.categoryPillActive,
            ]}
          >
            <Text style={[
              styles.categoryPillText,
              selectedCategory === item.id && styles.categoryPillTextActive,
            ]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  ), [search, selectedCategory]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>탐색</Text>
      </View>
      <FlatList
        data={characters}
        keyExtractor={(item: any) => item.id}
        numColumns={2}
        ListHeaderComponent={renderHeader}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
        onEndReached={() => hasNextPage && fetchNextPage()}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={!isLoading ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>검색 결과가 없어요</Text>
          </View>
        ) : null}
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
      {isLoading && (
        <ActivityIndicator style={StyleSheet.absoluteFill} color={colors.brand} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12 },
  title: { color: colors.textPrimary, fontSize: 24, fontWeight: '700' },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: 12, marginHorizontal: 16,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: 14 },
  categoriesContainer: { paddingHorizontal: 16, gap: 8, marginBottom: 16 },
  categoryPill: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  categoryPillActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  categoryPillText: { color: colors.textMuted, fontSize: 13, fontWeight: '500' },
  categoryPillTextActive: { color: '#fff' },
  columnWrapper: { paddingHorizontal: 10 },
  listContent: { paddingBottom: 100 },
  emptyContainer: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: colors.textMuted, marginTop: 12, fontSize: 14 },
});
