import React from 'react';
import { Text } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AppProvider, useApp } from './src/AppContext';
import { t } from './src/lib/i18n';
import { Loading } from './src/components/ui';
import LoginScreen from './src/screens/LoginScreen';
import ChatsScreen from './src/screens/ChatsScreen';
import ChatScreen from './src/screens/ChatScreen';
import NewChatScreen from './src/screens/NewChatScreen';
import NewGroupScreen from './src/screens/NewGroupScreen';
import JoinGroupScreen from './src/screens/JoinGroupScreen';
import GroupInfoScreen from './src/screens/GroupInfoScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ComingSoonScreen from './src/screens/ComingSoonScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function Tabs() {
  const { colors } = useApp();
  const icon = (e) => ({ focused }) => <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.55 }}>{e}</Text>;
  const header = { headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text, headerTitleStyle: { fontWeight: '800', fontSize: 22 }, headerShadowVisible: false };
  return (
    <Tab.Navigator
      screenOptions={{
        ...header,
        tabBarActiveTintColor: colors.text,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border, height: 64, paddingBottom: 8 },
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tab.Screen name="Chats" component={ChatsScreen} options={{ headerShown: false, tabBarLabel: t('chats'), tabBarIcon: icon('💬'), tabBarBadge: undefined }} />
      <Tab.Screen name="Status" component={ComingSoonScreen} initialParams={{ icon: '⭕' }} options={{ title: t('news'), tabBarIcon: icon('⭕') }} />
      <Tab.Screen name="Communities" component={ComingSoonScreen} initialParams={{ icon: '👥' }} options={{ title: t('communities'), tabBarIcon: icon('👥') }} />
      <Tab.Screen name="Calls" component={ComingSoonScreen} initialParams={{ icon: '📞' }} options={{ title: t('calls'), tabBarIcon: icon('📞') }} />
    </Tab.Navigator>
  );
}

const linking = {
  prefixes: ['unichatplus://'],
  config: { screens: { JoinGroup: 'join/:code' } },
};

function Root() {
  const { ready, session, colors, theme, lang } = useApp();
  if (!ready) return <Loading />;
  const navTheme = theme === 'dark'
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, primary: colors.primary, background: colors.bg, card: colors.bg } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, primary: colors.primary, background: colors.bg } };
  const header = { headerStyle: { backgroundColor: colors.primary }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: '700' } };
  return (
    <NavigationContainer theme={navTheme} linking={session ? linking : undefined} key={lang}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <Stack.Navigator screenOptions={header}>
        {!session ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Home" component={Tabs} options={{ headerShown: false }} />
            <Stack.Screen name="Chat" component={ChatScreen} options={{ title: '' }} />
            <Stack.Screen name="NewChat" component={NewChatScreen} options={{ title: t('startChat') }} />
            <Stack.Screen name="NewGroup" component={NewGroupScreen} options={{ title: t('newGroup') }} />
            <Stack.Screen name="JoinGroup" component={JoinGroupScreen} options={{ title: t('joinWithCode') }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: t('settings') }} />
            <Stack.Screen name="GroupInfo" component={GroupInfoScreen} options={{ title: t('groupInfo') }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <Root />
      </AppProvider>
    </SafeAreaProvider>
  );
}
