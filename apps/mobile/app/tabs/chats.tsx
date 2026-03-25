import React from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Image, ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { colors } from '@characterverse/ui';
import { useAuthStore } from '../../src/stores/auth.store';
import { formatRelativeTime } from '@characterverse/utils';

export default function ChatsScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get('/chat/conversations'),
    enabled: isAuthenticated,
    refetchInterval: 10_000,
  });

  if (!isAuthenticated) {
    return (
      <View style={styles.centered}>
        <Ionicons name="chatbubbles-outline" size={48} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>로그인이 필요해요</Text>
        <TouchableOpacity onPress={() => router.push('/auth/login')} style={styles.loginBtn}>
          <Text style={styles.loginBtnText}>로그인</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const conversations = (data as any)?.data?.conversations ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>대화</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} />
      ) : conversations.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="chatbubble-ellipses-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>아직 대화가 없어요</Text>
          <Text style={styles.emptySubtitle}>캐릭터와 대화를 시작해보세요!</Text>
          <TouchableOpacity onPress={() => router.push('/')} style={styles.loginBtn}>
            <Text style={styles.loginBtnText}>캐릭터 탐색</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }: { item: any }) => (
            <TouchableOpacity
              style={styles.conversationItem}
              onPress={() => router.push(`/chat/${item.id}`)}
            >
              <View style={styles.avatarContainer}>
                {item.character?.avatarUrl ? (
                  <Image source={{ uri: item.character.avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarFallbackText}>
                      {item.character?.name?.[0] ?? '?'}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.conversationInfo}>
                <View style={styles.conversationHeader}>
                  <Text style={styles.characterName} numberOfLines={1}>
                    {item.character?.name ?? '알 수 없음'}
                  </Text>
                  <Text style={styles.timeText}>
                    {formatRelativeTime(item.updatedAt)}
                  </Text>
                </View>
                <Text style={styles.lastMessage} numberOfLines={1}>
                  {item.lastMessage?.content ?? '대화를 시작해보세요'}
                </Text>
              </View>
              {item.isPinned && (
                <Ionicons name="pin" size={14} color={colors.brand} style={styles.pinIcon} />
              )}
            </TouchableOpacity>
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
  listContent: { paddingBottom: 100 },
  separator: { height: 1, backgroundColor: colors.border, marginLeft: 72 },
  conversationItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  avatarContainer: { marginRight: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: {
    backgroundColor: `${colors.brand}20`,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarFallbackText: { color: colors.brand, fontWeight: '700', fontSize: 18 },
  conversationInfo: { flex: 1, minWidth: 0 },
  conversationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  characterName: { color: colors.textPrimary, fontWeight: '600', fontSize: 15, flex: 1, marginRight: 8 },
  timeText: { color: colors.textMuted, fontSize: 12, flexShrink: 0 },
  lastMessage: { color: colors.textMuted, fontSize: 13 },
  pinIcon: { marginLeft: 8 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptySubtitle: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  loginBtn: {
    marginTop: 16, backgroundColor: colors.brand,
    paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10,
  },
  loginBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
