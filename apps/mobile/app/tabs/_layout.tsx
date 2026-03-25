import { Tabs } from 'expo-router';
import { Home, Compass, MessageCircle, Heart, User } from 'lucide-react-native';
import { View } from 'react-native';

const TAB_ICON_SIZE = 22;
const ACTIVE_COLOR = '#7c5cfc';
const INACTIVE_COLOR = '#7b7299';
const BG_COLOR = '#12101f';
const BORDER_COLOR = '#2d2a4a';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: BG_COLOR },
        headerTintColor: '#f0ecff',
        headerTitleStyle: { fontWeight: '600', fontSize: 16 },
        tabBarStyle: {
          backgroundColor: BG_COLOR,
          borderTopColor: BORDER_COLOR,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '500', marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          headerTitle: 'CharacterVerse',
          tabBarIcon: ({ color }) => <Home size={TAB_ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: '탐색',
          tabBarIcon: ({ color }) => <Compass size={TAB_ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: '대화',
          tabBarIcon: ({ color }) => <MessageCircle size={TAB_ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: '즐겨찾기',
          tabBarIcon: ({ color }) => <Heart size={TAB_ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '프로필',
          tabBarIcon: ({ color }) => <User size={TAB_ICON_SIZE} color={color} />,
        }}
      />
    </Tabs>
  );
}
