import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Zap, Eye, EyeOff } from 'lucide-react-native';
import { mobileApi, storeTokens } from '../../src/lib/api';
import { startKakaoOAuth } from '../../src/lib/oauth';

const COLORS = {
  bg: '#0d0b18',
  surface: '#1a1729',
  brand: '#7c5cfc',
  textPrimary: '#f0ecff',
  textSecondary: '#b8b0d8',
  textMuted: '#7b7299',
  border: '#2d2a4a',
  error: '#f87171',
};

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isKakaoLoading, setIsKakaoLoading] = useState(false);
  const router = useRouter();

  const handleEmailLogin = async () => {
    if (!email || !password) return;
    setError('');
    setIsLoading(true);
    try {
      const res = await mobileApi.auth.login({ email, password });
      if (res.success) {
        await storeTokens(res.data.accessToken, res.data.refreshToken);
        router.replace('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || '로그인에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKakaoLogin = async () => {
    setIsKakaoLoading(true);
    try {
      const result = await startKakaoOAuth();
      if (!result) return;

      const res = await mobileApi.auth.kakaoOAuth(result);
      if (res.success) {
        await storeTokens(res.data.accessToken, res.data.refreshToken);
        router.replace('/');
      }
    } catch (err: any) {
      Alert.alert('오류', '카카오 로그인에 실패했습니다.');
    } finally {
      setIsKakaoLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logoIcon}>
            <Zap size={24} color="#fff" />
          </View>
          <Text style={styles.logoText}>CharacterVerse</Text>
        </View>

        <Text style={styles.title}>다시 만나요! 👋</Text>
        <Text style={styles.subtitle}>계정에 로그인하세요</Text>

        {/* Kakao OAuth */}
        <TouchableOpacity
          style={styles.kakaoButton}
          onPress={handleKakaoLogin}
          disabled={isKakaoLoading}
          activeOpacity={0.85}
        >
          {isKakaoLoading ? (
            <ActivityIndicator color="#3B1E1E" />
          ) : (
            <>
              <Text style={styles.kakaoIcon}>💬</Text>
              <Text style={styles.kakaoText}>카카오로 계속하기</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>또는 이메일로</Text>
          <View style={styles.dividerLine} />
        </View>

        {error !== '' && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>이메일</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="name@example.com"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>비밀번호</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry={!showPw}
                autoComplete="password"
                style={[styles.input, { paddingRight: 44 }]}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPw(!showPw)}
              >
                {showPw ? <EyeOff size={18} color={COLORS.textMuted} /> : <Eye size={18} color={COLORS.textMuted} />}
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.loginButton, (!email || !password || isLoading) && styles.loginButtonDisabled]}
            onPress={handleEmailLogin}
            disabled={!email || !password || isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>로그인</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.push('/auth/register')}>
          <Text style={styles.registerLink}>
            계정이 없으신가요? <Text style={styles.registerLinkBold}>회원가입</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingBottom: 40 },
  logoContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 32 },
  logoIcon: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: COLORS.brand, alignItems: 'center', justifyContent: 'center',
  },
  logoText: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '700' },
  title: { color: COLORS.textPrimary, fontSize: 26, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  subtitle: { color: COLORS.textMuted, fontSize: 14, textAlign: 'center', marginBottom: 28 },
  kakaoButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: '#FEE500', borderRadius: 14, paddingVertical: 14,
    marginBottom: 20,
  },
  kakaoIcon: { fontSize: 18 },
  kakaoText: { color: '#3B1E1E', fontWeight: '700', fontSize: 15 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { color: COLORS.textMuted, fontSize: 12 },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)', padding: 12, marginBottom: 16,
  },
  errorText: { color: COLORS.error, fontSize: 13, textAlign: 'center' },
  form: { gap: 16 },
  field: { gap: 6 },
  label: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '500' },
  input: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13,
    color: COLORS.textPrimary, fontSize: 15,
  },
  passwordContainer: { position: 'relative' },
  eyeButton: { position: 'absolute', right: 14, top: 14 },
  loginButton: {
    backgroundColor: COLORS.brand, borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', marginTop: 4,
  },
  loginButtonDisabled: { opacity: 0.5 },
  loginButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  registerLink: { color: COLORS.textMuted, fontSize: 14, textAlign: 'center', marginTop: 24 },
  registerLinkBold: { color: '#a590fd', fontWeight: '600' },
});
