import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarCheck, ClipboardText, ChartLine, User } from 'phosphor-react-native';
import { Colors } from '@/theme';

const TAB_LABELS: Record<string, string> = {
  today:   'Today',
  plan:    'Plan',
  history: 'History',
  profile: 'Profile',
};

function TabIcon({ name, color }: { name: string; color: string }) {
  const props = { size: 20, color };
  switch (name) {
    case 'today':   return <CalendarCheck {...props} />;
    case 'plan':    return <ClipboardText {...props} />;
    case 'history': return <ChartLine {...props} />;
    case 'profile': return <User {...props} />;
    default:        return null;
  }
}

// Routes with href: null are hidden — don't render them in the tab bar
const HIDDEN_ROUTES = new Set(['log-workout', 'post-workout-checkin']);

export function AppTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {state.routes.map((route, index) => {
        if (HIDDEN_ROUTES.has(route.name)) return null;

        const isFocused = state.index === index;
        const color = isFocused ? Colors.text.primary : Colors.text.muted;
        const label = TAB_LABELS[route.name] ?? route.name;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({ type: 'tabLongPress', target: route.key });
        };

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={descriptors[route.key].options.tabBarAccessibilityLabel}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tab}
          >
            {/* 2px primary active indicator at top — overlaps the border */}
            {isFocused && <View style={styles.activeIndicator} />}

            <TabIcon name={route.name} color={color} />

            <Text style={[styles.label, { color }]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.bg.base,
    borderTopWidth: 1,
    borderTopColor: Colors.border.strong,
  } as ViewStyle,

  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 14,
    paddingBottom: 18,
    position: 'relative',
    gap: 5,
  } as ViewStyle,

  activeIndicator: {
    position: 'absolute',
    top: -1, // overlap the top border
    left: '20%' as any,
    right: '20%' as any,
    height: 2,
    backgroundColor: Colors.primary,
  } as ViewStyle,

  label: {
    fontFamily: 'Lato_700Bold',
    fontSize: 10,
    lineHeight: 10,
    letterSpacing: 1.4, // 0.14em at 10px
    textTransform: 'uppercase',
  } as TextStyle,
});
