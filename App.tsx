import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

const SESSION_KEY_LENGTH = 6;

function App() {
  const [sessionKey, setSessionKey] = useState('');

  const normalizedSessionKey = useMemo(
    () => sessionKey.replace(/[^a-zA-Z0-9]/g, '').toUpperCase(),
    [sessionKey],
  );
  const isReady = normalizedSessionKey.length === SESSION_KEY_LENGTH;

  const handleChangeSessionKey = (value: string) => {
    setSessionKey(
      value
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase()
        .slice(0, SESSION_KEY_LENGTH),
    );
  };

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#070b16" />
      <SafeAreaView style={styles.screen}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardArea}
        >
          <View style={styles.shell}>
            <View style={styles.brandRow}>
              <View style={styles.brandMark}>
                <Text style={styles.brandMarkText}>IN</Text>
              </View>
              <View>
                <Text style={styles.brandName}>INBLUE KIOSK</Text>
                <Text style={styles.brandMeta}>AI Interview Station</Text>
              </View>
            </View>

            <View style={styles.content}>
              <View style={styles.statusPill}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Sẵn sàng nhận mã phiên</Text>
              </View>

              <Text style={styles.title}>Nhập mã PIN phiên phỏng vấn</Text>
              <Text style={styles.subtitle}>
                Dùng mã 6 ký tự được gửi sau khi bạn đặt lịch Kiosk. Vui lòng
                kiểm tra email hoặc hộp thư thông báo nếu chưa thấy mã.
              </Text>

              <View
                style={[styles.inputFrame, isReady && styles.inputFrameReady]}
              >
                <TextInput
                  value={normalizedSessionKey}
                  onChangeText={handleChangeSessionKey}
                  placeholder="083405"
                  placeholderTextColor="#465777"
                  maxLength={SESSION_KEY_LENGTH}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  autoFocus
                  selectTextOnFocus
                  style={styles.input}
                  accessibilityLabel="Nhập mã PIN phiên phỏng vấn"
                />
              </View>

              <Text
                style={[styles.helperText, isReady && styles.helperTextReady]}
              >
                {isReady
                  ? 'Mã đã đủ 6 ký tự. Nhấn Enter trên bàn phím kiosk để tiếp tục.'
                  : `${normalizedSessionKey.length}/${SESSION_KEY_LENGTH} ký tự`}
              </Text>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Nếu gặp sự cố, vui lòng liên hệ nhân viên hỗ trợ tại khu vực
                kiosk.
              </Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#070b16',
  },
  keyboardArea: {
    flex: 1,
  },
  shell: {
    flex: 1,
    paddingHorizontal: 48,
    paddingVertical: 34,
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: '#101a32',
    borderColor: '#25355b',
    borderRadius: 18,
    borderWidth: 1,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  brandMarkText: {
    color: '#7dd3fc',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 1,
  },
  brandName: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  brandMeta: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  content: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 40,
  },
  statusPill: {
    alignItems: 'center',
    backgroundColor: '#0f1d35',
    borderColor: '#1f355f',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  statusDot: {
    backgroundColor: '#22c55e',
    borderRadius: 999,
    height: 9,
    width: 9,
  },
  statusText: {
    color: '#bfdbfe',
    fontSize: 14,
    fontWeight: '800',
  },
  title: {
    color: '#ffffff',
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -0.8,
    marginTop: 28,
    textAlign: 'center',
  },
  subtitle: {
    color: '#b6c3d8',
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 28,
    marginTop: 14,
    maxWidth: 720,
    textAlign: 'center',
  },
  inputFrame: {
    backgroundColor: '#0b1222',
    borderColor: '#263657',
    borderRadius: 22,
    borderWidth: 2,
    marginTop: 44,
    minWidth: 430,
    paddingHorizontal: 28,
    paddingVertical: 10,
  },
  inputFrameReady: {
    borderColor: '#22c55e',
  },
  input: {
    color: '#ffffff',
    fontSize: 54,
    fontWeight: '900',
    letterSpacing: 18,
    lineHeight: 66,
    padding: 0,
    textAlign: 'center',
  },
  helperText: {
    color: '#93a4bf',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 18,
    textAlign: 'center',
  },
  helperTextReady: {
    color: '#86efac',
  },
  footer: {
    alignItems: 'center',
    borderColor: '#1b2946',
    borderTopWidth: 1,
    paddingTop: 20,
  },
  footerText: {
    color: '#7e8da7',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default App;
