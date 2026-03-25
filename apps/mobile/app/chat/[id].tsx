import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ExpoImage as Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { Send, ArrowLeft } from 'lucide-react-native';
import { mobileApi, apiClient, getStoredTokens } from '../../src/lib/api';
import { formatRelativeTime, getCharacterAvatarUrl } from '@characterverse/utils';
import type { ChatMessage } from '@characterverse/types';

const BASE_URL = 'http://localhost:4000';
const COLORS = {
  bg: '#0d0b18',
  surface: '#1a1729',
  brand: '#7c5cfc',
  textPrimary: '#f0ecff',
  textSecondary: '#b8b0d8',
  textMuted: '#7b7299',
  border: '#2d2a4a',
  userBubble: 'rgba(124,92,252,0.2)',
};

export default function ChatScreen() {
  const { id: conversationId } = useLocalSearchParams<{ id: string }>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const abortRef = useRef<AbortController | null>(null);
  const router = useRouter();

  // Fetch messages
  const { isLoading } = useQuery({
    queryKey: ['messages-mobile', conversationId],
    queryFn: () => mobileApi.chat.messages(conversationId),
    onSuccess: (res: any) => setMessages(res.data),
  } as any);

  // Fetch conversation info
  const { data: convsData } = useQuery({
    queryKey: ['conversations-mobile'],
    queryFn: () => mobileApi.chat.conversations(),
  });

  const conversation = (convsData?.data ?? []).find((c: any) => c.id === conversationId);
  const character = conversation?.character;
  const avatarSrc = character?.avatarUrl || getCharacterAvatarUrl(null, character?.name || '');

  const scrollToEnd = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  useEffect(() => {
    if (messages.length) scrollToEnd();
  }, [messages, scrollToEnd]);

  useEffect(() => {
    if (isStreaming) scrollToEnd();
  }, [streamingContent, isStreaming, scrollToEnd]);

  const sendMessage = async () => {
    const content = input.trim();
    if (!content || isStreaming) return;
    setInput('');
    setIsStreaming(true);
    setStreamingContent('');

    const tempMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      conversationId,
      role: 'USER',
      content,
      status: 'SENT',
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    const { accessToken } = await getStoredTokens();
    abortRef.current = new AbortController();

    try {
      const response = await fetch(
        `${BASE_URL}/api/chat/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({ content }),
          signal: abortRef.current.signal,
        }
      );

      if (!response.ok) {
        setIsStreaming(false);
        setMessages((prev) => [
          ...prev,
          { id: `err-${Date.now()}`, conversationId, role: 'ASSISTANT', content: '오류가 발생했습니다.', status: 'ERROR', createdAt: new Date().toISOString() },
        ]);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              const eventLine = i > 0 && lines[i - 1].startsWith('event: ') ? lines[i - 1].slice(7).trim() : '';

              if (eventLine === 'delta' && data.text) {
                fullContent += data.text;
                setStreamingContent(fullContent);
              } else if (eventLine === 'done') {
                setMessages((prev) => [
                  ...prev,
                  { id: data.messageId || `done-${Date.now()}`, conversationId, role: 'ASSISTANT', content: fullContent, status: 'SENT', createdAt: new Date().toISOString() },
                ]);
                setIsStreaming(false);
                setStreamingContent('');
              }
            } catch {}
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setIsStreaming(false);
        setStreamingContent('');
      }
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'USER';
    return (
      <View style={[styles.msgRow, isUser && styles.msgRowUser]}>
        {!isUser && (
          <View style={styles.avatarContainer}>
            <Image source={{ uri: avatarSrc }} style={styles.avatar} contentFit="cover" />
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
          <Text style={styles.bubbleText}>{item.content}</Text>
          <Text style={styles.bubbleTime}>{formatRelativeTime(item.createdAt)}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        {character && (
          <View style={styles.headerInfo}>
            <Image source={{ uri: avatarSrc }} style={styles.headerAvatar} contentFit="cover" />
            <Text style={styles.headerName}>{character.name}</Text>
          </View>
        )}
      </View>

      {/* Messages */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={COLORS.brand} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={scrollToEnd}
          ListFooterComponent={
            isStreaming ? (
              <View style={[styles.msgRow]}>
                <View style={styles.avatarContainer}>
                  <Image source={{ uri: avatarSrc }} style={styles.avatar} contentFit="cover" />
                </View>
                <View style={styles.bubbleAssistant}>
                  {streamingContent ? (
                    <Text style={styles.bubbleText}>{streamingContent}</Text>
                  ) : (
                    <View style={styles.typingDots}>
                      <View style={[styles.dot, { opacity: 0.4 }]} />
                      <View style={[styles.dot, { opacity: 0.7 }]} />
                      <View style={[styles.dot, { opacity: 1 }]} />
                    </View>
                  )}
                </View>
              </View>
            ) : null
          }
        />
      )}

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="메시지를 입력하세요..."
          placeholderTextColor={COLORS.textMuted}
          multiline
          maxLength={4000}
          style={styles.textInput}
          editable={!isStreaming}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!input.trim() || isStreaming) && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={!input.trim() || isStreaming}
        >
          <Send size={18} color={input.trim() && !isStreaming ? '#fff' : COLORS.textMuted} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  backButton: { padding: 4 },
  headerInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: { width: 34, height: 34, borderRadius: 17 },
  headerName: { color: COLORS.textPrimary, fontWeight: '600', fontSize: 15 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  messageList: { padding: 16, paddingBottom: 8, gap: 12 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 4 },
  msgRowUser: { flexDirection: 'row-reverse' },
  avatarContainer: { width: 32, height: 32, borderRadius: 16, overflow: 'hidden', flexShrink: 0 },
  avatar: { width: '100%', height: '100%' },
  bubble: {
    maxWidth: '75%', padding: 12, borderRadius: 18,
  },
  bubbleUser: {
    backgroundColor: COLORS.userBubble,
    borderWidth: 1, borderColor: 'rgba(124,92,252,0.2)',
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { color: COLORS.textPrimary, fontSize: 14, lineHeight: 20 },
  bubbleTime: { color: COLORS.textMuted, fontSize: 10, marginTop: 4 },
  typingDots: { flexDirection: 'row', gap: 4, paddingVertical: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.textMuted },
  inputContainer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  textInput: {
    flex: 1, backgroundColor: '#221f38', borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
    color: COLORS.textPrimary, fontSize: 14, maxHeight: 120,
  },
  sendButton: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: COLORS.brand, alignItems: 'center', justifyContent: 'center',
  },
  sendButtonDisabled: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
});
