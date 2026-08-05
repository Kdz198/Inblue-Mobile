import React, { useMemo, useState } from 'react';
import {
  GestureResponderEvent,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

const SESSION_KEY_LENGTH = 6;

type ThemeName = 'dark' | 'light';
type Pointer = {
  x: number;
  y: number;
};

const palettes = {
  dark: {
    accent: '#7c5cff',
    accentSoft: 'rgba(124, 92, 255, 0.16)',
    bg: '#070b14',
    bgAlt: '#0b1220',
    border: '#22304d',
    card: '#101827',
    cardElevated: '#131d31',
    glow: 'rgba(59, 130, 246, 0.24)',
    glowAlt: 'rgba(16, 185, 129, 0.18)',
    ink: '#f8fbff',
    muted: '#a9b7cf',
    mutedStrong: '#d7e0ef',
    success: '#22c55e',
    warning: '#f59e0b',
  },
  light: {
    accent: '#2952d9',
    accentSoft: 'rgba(41, 82, 217, 0.1)',
    bg: '#eef3fb',
    bgAlt: '#f8fbff',
    border: '#c8d5ea',
    card: '#ffffff',
    cardElevated: '#f4f7fc',
    glow: 'rgba(41, 82, 217, 0.18)',
    glowAlt: 'rgba(20, 184, 166, 0.16)',
    ink: '#101828',
    muted: '#58708f',
    mutedStrong: '#25364d',
    success: '#059669',
    warning: '#d97706',
  },
};

function App() {
  const systemScheme = useColorScheme();
  const { height, width } = useWindowDimensions();
  const [selectedTheme, setSelectedTheme] = useState<ThemeName>(
    systemScheme === 'light' ? 'light' : 'dark',
  );
  const [sessionKey, setSessionKey] = useState('');
  const [pointer, setPointer] = useState<Pointer>({
    x: width * 0.54,
    y: height * 0.38,
  });
  const [isThemeHovered, setIsThemeHovered] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isPadPressed, setIsPadPressed] = useState(false);

  const theme = palettes[selectedTheme];
  const styles = useMemo(() => createStyles(theme), [theme]);

  const normalizedSessionKey = useMemo(
    () => sessionKey.replace(/[^a-zA-Z0-9]/g, '').toUpperCase(),
    [sessionKey],
  );
  const isReady = normalizedSessionKey.length === SESSION_KEY_LENGTH;

  const progressPercent =
    (normalizedSessionKey.length / SESSION_KEY_LENGTH) * 100;

  const updatePointer = (event: GestureResponderEvent) => {
    setPointer({
      x: event.nativeEvent.locationX,
      y: event.nativeEvent.locationY,
    });
  };

  const handleChangeSessionKey = (value: string) => {
    setSessionKey(
      value
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase()
        .slice(0, SESSION_KEY_LENGTH),
    );
  };

  const toggleTheme = () => {
    setSelectedTheme(current => (current === 'dark' ? 'light' : 'dark'));
  };

  const dynamicHandlers =
    Platform.OS === 'web'
      ? {
          onMouseMove: (event: {
            nativeEvent: { offsetX: number; offsetY: number };
          }) => {
            setPointer({
              x: event.nativeEvent.offsetX,
              y: event.nativeEvent.offsetY,
            });
          },
        }
      : {};

  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle={selectedTheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={theme.bg}
      />
      <SafeAreaView
        {...dynamicHandlers}
        onResponderGrant={updatePointer}
        onResponderMove={updatePointer}
        onStartShouldSetResponder={() => true}
        style={styles.screen}
      >
        <View
          pointerEvents="none"
          style={[
            styles.pointerGlow,
            {
              left: pointer.x - 220,
              top: pointer.y - 220,
            },
          ]}
        />
        <View pointerEvents="none" style={styles.cornerGlow} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardArea}
        >
          <View style={styles.shell}>
            <View style={styles.header}>
              <View style={styles.brandRow}>
                <View style={styles.brandMark}>
                  <Text style={styles.brandMarkText}>IN</Text>
                </View>
                <View>
                  <Text style={styles.brandName}>INBLUE KIOSK</Text>
                  <Text style={styles.brandMeta}>Trạm phỏng vấn AI</Text>
                </View>
              </View>

              <Pressable
                accessibilityLabel="Đổi giao diện sáng tối"
                onHoverIn={() => setIsThemeHovered(true)}
                onHoverOut={() => setIsThemeHovered(false)}
                onPress={toggleTheme}
                style={({ pressed }) => [
                  styles.themeToggle,
                  (isThemeHovered || pressed) && styles.themeToggleActive,
                ]}
              >
                <Text style={styles.themeIcon}>
                  {selectedTheme === 'dark' ? '☾' : '☀'}
                </Text>
                <Text style={styles.themeText}>
                  {selectedTheme === 'dark' ? 'Dark' : 'Light'}
                </Text>
              </Pressable>
            </View>

            <View style={styles.content}>
              <View style={styles.statusPill}>
                <View style={styles.statusPulse} />
                <Text style={styles.statusText}>Sẵn sàng nhận mã phiên</Text>
              </View>

              <Text style={styles.title}>Nhập mã PIN phỏng vấn</Text>
              <Text style={styles.subtitle}>
                Dùng mã 6 số được cấp sau khi đặt lịch Kiosk. Nếu chưa thấy mã,
                vui lòng kiểm tra email hoặc thông báo trên tài khoản InBlue.
              </Text>

              <Pressable
                onPressIn={() => setIsPadPressed(true)}
                onPressOut={() => setIsPadPressed(false)}
                style={[
                  styles.inputPad,
                  isInputFocused && styles.inputPadFocused,
                  isReady && styles.inputPadReady,
                  isPadPressed && styles.inputPadPressed,
                ]}
              >
                <View style={styles.inputTopLine}>
                  <Text style={styles.inputLabel}>Mã phiên</Text>
                  <Text
                    style={[styles.counter, isReady && styles.counterReady]}
                  >
                    {normalizedSessionKey.length}/{SESSION_KEY_LENGTH}
                  </Text>
                </View>

                <TextInput
                  accessibilityLabel="Nhập mã PIN phiên phỏng vấn"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  autoFocus
                  keyboardType="number-pad"
                  maxLength={SESSION_KEY_LENGTH}
                  onBlur={() => setIsInputFocused(false)}
                  onChangeText={handleChangeSessionKey}
                  onFocus={() => setIsInputFocused(true)}
                  placeholder="083405"
                  placeholderTextColor={
                    selectedTheme === 'dark' ? '#51627e' : '#9aabc2'
                  }
                  returnKeyType="done"
                  selectTextOnFocus
                  style={styles.input}
                  value={normalizedSessionKey}
                />

                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${progressPercent}%`,
                      },
                    ]}
                  />
                </View>
              </Pressable>

              <Text
                style={[styles.helperText, isReady && styles.helperTextReady]}
              >
                {isReady
                  ? 'Mã đã đủ 6 ký tự. Bạn có thể tiếp tục tại trạm Kiosk.'
                  : 'Chạm vào ô nhập và nhập đúng mã PIN trên lịch hẹn của bạn.'}
              </Text>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Gặp sự cố kỹ thuật? Liên hệ nhân viên hỗ trợ tại khu vực Kiosk.
              </Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function createStyles(theme: (typeof palettes)[ThemeName]) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.bg,
      overflow: 'hidden',
    },
    pointerGlow: {
      position: 'absolute',
      width: 440,
      height: 440,
      borderRadius: 220,
      backgroundColor: theme.glow,
      opacity: 0.92,
      transform: [{ scale: 1.02 }],
    },
    cornerGlow: {
      position: 'absolute',
      right: -130,
      bottom: -170,
      width: 430,
      height: 430,
      borderRadius: 215,
      backgroundColor: theme.glowAlt,
      opacity: 0.9,
    },
    keyboardArea: {
      flex: 1,
    },
    shell: {
      flex: 1,
      paddingHorizontal: 46,
      paddingVertical: 30,
    },
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 18,
    },
    brandRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 14,
    },
    brandMark: {
      alignItems: 'center',
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderRadius: 16,
      borderWidth: 1,
      height: 54,
      justifyContent: 'center',
      width: 54,
    },
    brandMarkText: {
      color: theme.accent,
      fontSize: 17,
      fontWeight: '900',
      letterSpacing: 1,
    },
    brandName: {
      color: theme.ink,
      fontSize: 18,
      fontWeight: '900',
      letterSpacing: 1.2,
    },
    brandMeta: {
      color: theme.muted,
      fontSize: 14,
      fontWeight: '700',
      marginTop: 3,
    },
    themeToggle: {
      alignItems: 'center',
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 8,
      minHeight: 48,
      paddingHorizontal: 18,
    },
    themeToggleActive: {
      backgroundColor: theme.cardElevated,
      borderColor: theme.accent,
    },
    themeIcon: {
      color: theme.accent,
      fontSize: 17,
      fontWeight: '900',
    },
    themeText: {
      color: theme.mutedStrong,
      fontSize: 15,
      fontWeight: '800',
    },
    content: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      paddingBottom: 28,
    },
    statusPill: {
      alignItems: 'center',
      backgroundColor: theme.accentSoft,
      borderColor: theme.accent,
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 18,
      paddingVertical: 10,
    },
    statusPulse: {
      backgroundColor: theme.success,
      borderRadius: 999,
      height: 10,
      width: 10,
    },
    statusText: {
      color: theme.mutedStrong,
      fontSize: 14,
      fontWeight: '900',
    },
    title: {
      color: theme.ink,
      fontSize: 42,
      fontWeight: '900',
      letterSpacing: -0.8,
      marginTop: 26,
      textAlign: 'center',
    },
    subtitle: {
      color: theme.muted,
      fontSize: 18,
      fontWeight: '700',
      lineHeight: 28,
      marginTop: 14,
      maxWidth: 760,
      textAlign: 'center',
    },
    inputPad: {
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderRadius: 24,
      borderWidth: 2,
      marginTop: 42,
      minWidth: 480,
      paddingHorizontal: 28,
      paddingTop: 18,
      paddingBottom: 20,
    },
    inputPadFocused: {
      borderColor: theme.accent,
    },
    inputPadReady: {
      borderColor: theme.success,
    },
    inputPadPressed: {
      transform: [{ scale: 0.992 }],
    },
    inputTopLine: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    inputLabel: {
      color: theme.muted,
      fontSize: 14,
      fontWeight: '900',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    counter: {
      color: theme.muted,
      fontSize: 15,
      fontWeight: '900',
    },
    counterReady: {
      color: theme.success,
    },
    input: {
      color: theme.ink,
      fontSize: 58,
      fontWeight: '900',
      letterSpacing: 17,
      lineHeight: 72,
      padding: 0,
      textAlign: 'center',
    },
    progressTrack: {
      backgroundColor: theme.bgAlt,
      borderRadius: 999,
      height: 8,
      marginTop: 10,
      overflow: 'hidden',
    },
    progressFill: {
      backgroundColor: theme.success,
      borderRadius: 999,
      height: 8,
    },
    helperText: {
      color: theme.muted,
      fontSize: 16,
      fontWeight: '800',
      marginTop: 18,
      textAlign: 'center',
    },
    helperTextReady: {
      color: theme.success,
    },
    footer: {
      alignItems: 'center',
      borderColor: theme.border,
      borderTopWidth: 1,
      paddingTop: 20,
    },
    footerText: {
      color: theme.muted,
      fontSize: 14,
      fontWeight: '700',
      textAlign: 'center',
    },
  });
}

export default App;
