import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Image, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../src/lib/api';
import { colors } from '@characterverse/ui';
import { useAuthStore } from '../../src/stores/auth.store';
import { formatCount } from '@characterverse/utils';
import * as SecureStore from 'expo-secure-store';

const MENU_ITEMS = [
  { icon: 'create-outline', label: '내 캐릭터', route: '/creator' },
  { icon: 'card-outline', label: '크레딧 충전', route: '/credits' },
  { icon: 'notifications-outline', label: '알림 설정', route: '/settings/notifications' },
  { icon: 'shield-outline', label: '개인정보 설정', route: '/settings/privacy' },
  { icon: 'help-circle-outline', label: '고객센터', route: '/support' },
  { icon: 'information-circle-outline', label: '앱 정보', route: '/about' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { isAuthenticated, user, setUser, setTokens } = useAuthStore();

  const logoutMutation = useMutation({
    mutationFn: () => api.auth.logout(),
    onSuccess: async () => {
      await SecureStore.deleteItemAsync('accessToken');
      await SecureStore.deleteItemAsync('refreshToken');
      setTokens(null, null);
      setUser(null);
    },
  });

  const handleLogout = () => {
    Alert.alert('로그아웃', '정말 로그아웃 하시겠어요?', [
      { text: '취소', style: 'cancel' },
      { text: '로그아웃', style: 'destructive', onPress: () => logoutMutation.mutate() },
    ]);
  };

  if (!isAuthenticated || !user) {
    return (
      <View style={styles.centered}>
        <Ionicons name="person-circle-outline" size={64} color={colors.textMuted} />
        <Text style={styles.guestTitle}>로그인이 필요해요</Text>
        <Text style={styles.guestSubtitle}>로그인하고 더 많은 기능을 이용하세요.</Text>
        <TouchableOpacity onPress={() => router.push('/auth/login')} style={styles.loginBtn}>
          <Text style={styles.loginBtnText}>로그인 / 회원가입</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Profile header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarWrapper}>
          {user.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarFallbackText}>{user.displayName[0]}</Text>
            </View>
          )}
        </View>
        <Text style={styles.displayName}>{user.displayName}</Text>
        <Text style={styles.username}>@{user.username}</Text>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{formatCount((user as any).credits ?? 0)}</Text>
            <Text style={styles.statLabel}>크레딧</Text>
          </View>
        </View>
      </View>

      {/* Menu */}
      <View style={styles.menuSection}>
        {MENU_ITEMS.map((item, idx) => (
          <TouchableOpacity
            key={item.route}
            style={[styles.menuItem, idx === MENU_ITEMS.length - 1 && styles.menuItemLast]}
            onPress={() => router.push(item.route as any)}
          >
            <View style={styles.menuIcon}>
              <Ionicons name={item.icon as any} size={20} color={colors.brand} />
            </View>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={18} color="#f87171" />
        <Text style={styles.logoutText}>로그아웃</Text>
      </TouchableOpacity>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  profileHeader: {
    alignItems: 'center', paddingTop: 60, paddingBottom: 28,
    paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  avatarWrapper: {
    marginBottom: 12,
    shadowColor: colors.brand, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
  },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  avatarFallback: {
    backgroundColor: `${colors.brand}20`,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: `${colors.brand}40`,
  },
  avatarFallbackText: { color: colors.brand, fontSize: 28, fontWeight: '700' },
  displayName: { color: colors.textPrimary, fontSize: 20, fontWeight: '700', marginBottom: 4 },
  username: { color: colors.textMuted, fontSize: 14, marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 32 },
  stat: { alignItems: 'center' },
  statValue: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
  statLabel: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  menuSection: {
    marginHorizontal: 16, marginTop: 20,
    backgroundColor: colors.surface,
    borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: colors.border,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  menuItemLast: { borderBottomWidth: 0 },
  menuIcon: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: `${colors.brand}15`,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  menuLabel: { flex: 1, color: colors.textPrimary, fontSize: 15 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginHorizontal: 16, marginTop: 16, paddingVertical: 14,
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(248,113,113,0.2)',
  },
  logoutText: { color: '#f87171', fontSize: 15, fontWeight: '600' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  guestTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 12 },
  guestSubtitle: { color: colors.textMuted, fontSize: 13, marginTop: 4, textAlign: 'center' },
  loginBtn: {
    marginTop: 20, backgroundColor: colors.brand,
    paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12,
  },
  loginBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
