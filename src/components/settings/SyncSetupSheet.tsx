import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSync } from '../../hooks/useSync';
import { useTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { ThemeColors } from '../../theme/types';
import { radius, spacing } from '../../theme';
import { hapticSelection } from '../../utils/haptics';

interface SyncSetupSheetProps {
  onClose: () => void;
}

function lastSyncLabel(value: number | null): string {
  if (!value) return '尚未同步';
  const minutes = Math.max(0, Math.floor((Date.now() - value) / 60000));
  if (minutes < 1) return '刚刚同步';
  if (minutes < 60) return `${minutes} 分钟前同步`;
  return `${Math.floor(minutes / 60)} 小时前同步`;
}

export function SyncSetupSheet({ onClose }: SyncSetupSheetProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const {
    config,
    configured,
    status,
    error,
    connect,
    syncNow,
    disconnect,
    setAutoSync,
  } = useSync();
  const [editing, setEditing] = useState(!configured);
  const [serverUrl, setServerUrl] = useState(config.serverUrl);
  const [username, setUsername] = useState(config.username);
  const [appPassword, setAppPassword] = useState('');
  const [syncPassword, setSyncPassword] = useState('');
  const [remotePath, setRemotePath] = useState(config.remotePath);
  const busy = status === 'syncing';

  const handleConnect = async () => {
    const ok = await connect({
      serverUrl,
      username,
      appPassword,
      syncPassword,
      remotePath,
    });
    if (ok) {
      hapticSelection();
      setEditing(false);
      setAppPassword('');
      setSyncPassword('');
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      '断开同步',
      '只清除这台设备保存的坚果云凭据，不会删除本机数据或云端文件。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '断开',
          style: 'destructive',
          onPress: () => {
            void disconnect().then(() => {
              hapticSelection();
              setEditing(true);
            });
          },
        },
      ],
    );
  };

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="关闭同步设置"
          onPress={onClose}
          style={styles.backdrop}
        />
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View
            style={[
              styles.sheet,
              { paddingBottom: Math.max(insets.bottom, spacing.xl) },
            ]}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              bounces={false}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.headerRow}>
                <Text style={styles.title}>云同步（可选）</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="关闭"
                  onPress={onClose}
                >
                  <Text style={styles.close}>完成</Text>
                </Pressable>
              </View>
              <Text style={styles.subtitle}>
                坚果云只用于多设备同步，不影响本机使用。数据会先用同步密码加密。
              </Text>

              {Platform.OS === 'web' ? (
                <Text style={styles.warning}>同步目前仅在 Android/iOS 可用。</Text>
              ) : null}

              {!editing && configured ? (
                <>
                  <View style={styles.statusCard}>
                    <Text style={styles.statusTitle}>
                      {status === 'syncing'
                        ? '正在同步…'
                        : status === 'error'
                          ? '同步失败'
                          : '已连接'}
                    </Text>
                    <Text style={styles.statusHint}>
                      {lastSyncLabel(config.lastSyncAt)} · {config.username}
                    </Text>
                    {error ? <Text style={styles.error}>{error}</Text> : null}
                    {status === 'syncing' ? (
                      <ActivityIndicator
                        color={colors.text}
                        style={styles.spinner}
                      />
                    ) : null}
                  </View>

                  <View style={styles.switchRow}>
                    <View style={styles.switchText}>
                      <Text style={styles.switchTitle}>自动同步</Text>
                      <Text style={styles.switchHint}>
                        启动或回到前台时同步，手动同步始终可用。
                      </Text>
                    </View>
                    <Switch
                      value={config.autoSync}
                      onValueChange={(value) => void setAutoSync(value)}
                      trackColor={{
                        false: colors.border,
                        true: colors.accent,
                      }}
                      thumbColor={colors.surface}
                      ios_backgroundColor={colors.border}
                    />
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => void syncNow()}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      busy && styles.disabled,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.primaryText}>
                      {busy ? '同步中…' : '立即同步'}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setEditing(true)}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.secondaryText}>修改同步设置</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={handleDisconnect}
                    style={({ pressed }) => [
                      styles.textButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.dangerText}>断开同步</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable
                    accessibilityRole="link"
                    onPress={() =>
                      void Linking.openURL(
                        'https://www.jianguoyun.com/#/register',
                      )
                    }
                    style={({ pressed }) => [
                      styles.registerLink,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.registerText}>
                      还没有坚果云账号？去注册 ›
                    </Text>
                  </Pressable>
                  <Text style={styles.hintText}>
                    注册后在坚果云「账户信息 → 安全选项 → 第三方应用管理」生成
                    16 位应用密码，不要填登录密码。
                  </Text>

                  {configured ? (
                    <Text style={styles.warning}>
                      修改设置需要重新输入应用密码和同步密码。
                    </Text>
                  ) : null}
                  <Text style={styles.label}>WebDAV 地址</Text>
                  <TextInput
                    value={serverUrl}
                    onChangeText={setServerUrl}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.input}
                    placeholder="https://dav.jianguoyun.com/dav/"
                    placeholderTextColor={colors.muted}
                  />
                  <Text style={styles.label}>坚果云邮箱</Text>
                  <TextInput
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    style={styles.input}
                    placeholder="name@example.com"
                    placeholderTextColor={colors.muted}
                  />
                  <Text style={styles.label}>应用密码（16 位）</Text>
                  <TextInput
                    value={appPassword}
                    onChangeText={setAppPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    style={styles.input}
                    placeholder="不是坚果云登录密码"
                    placeholderTextColor={colors.muted}
                  />
                  <Text style={styles.label}>Tally 同步密码</Text>
                  <TextInput
                    value={syncPassword}
                    onChangeText={setSyncPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    style={styles.input}
                    placeholder="至少 8 位，忘记无法找回"
                    placeholderTextColor={colors.muted}
                  />
                  <Text style={styles.hintText}>
                    同步密码只用于加密上传；忘记后云端数据无法解密。
                  </Text>
                  <Text style={styles.label}>同步文件路径</Text>
                  <TextInput
                    value={remotePath}
                    onChangeText={setRemotePath}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.input}
                    placeholder="Tally/tally-sync.json"
                    placeholderTextColor={colors.muted}
                  />

                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => void handleConnect()}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      busy && styles.disabled,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.primaryText}>
                      {busy ? '连接中…' : '连接并同步'}
                    </Text>
                  </Pressable>
                  {error ? <Text style={styles.error}>{error}</Text> : null}
                  {configured ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setEditing(false)}
                      style={({ pressed }) => [
                        styles.textButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.secondaryText}>取消修改</Text>
                    </Pressable>
                  ) : null}
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, justifyContent: 'flex-end' },
    flex: { flex: 1, justifyContent: 'flex-end' },
    backdrop: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      backgroundColor: colors.overlay,
    },
    sheet: {
      maxHeight: '90%',
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: { fontSize: 20, fontWeight: '600', color: colors.text },
    close: { fontSize: 14, color: colors.textSecondary },
    subtitle: {
      marginTop: 6,
      fontSize: 13,
      lineHeight: 19,
      color: colors.muted,
    },
    warning: {
      marginTop: spacing.md,
      fontSize: 12,
      color: colors.danger,
    },
    statusCard: {
      marginTop: spacing.lg,
      padding: spacing.lg,
      borderRadius: radius.md,
      backgroundColor: colors.rangeTint,
    },
    statusTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
    statusHint: { marginTop: 4, fontSize: 12, color: colors.muted },
    spinner: { marginTop: spacing.sm, alignSelf: 'flex-start' },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginTop: spacing.lg,
      paddingTop: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    switchText: { flex: 1 },
    switchTitle: { fontSize: 15, color: colors.text },
    switchHint: {
      marginTop: 3,
      fontSize: 12,
      lineHeight: 17,
      color: colors.muted,
    },
    registerLink: { marginTop: spacing.lg, alignSelf: 'flex-start' },
    registerText: { fontSize: 13, color: colors.textSecondary },
    hintText: {
      marginTop: spacing.sm,
      fontSize: 12,
      lineHeight: 18,
      color: colors.muted,
    },
    label: {
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
      fontSize: 13,
      color: colors.muted,
    },
    input: {
      height: 44,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.rangeTint,
    },
    primaryButton: {
      marginTop: spacing.xl,
      height: 48,
      borderRadius: radius.pill,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryText: { fontSize: 16, fontWeight: '600', color: colors.onAccent },
    secondaryButton: {
      marginTop: spacing.md,
      height: 44,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryText: { fontSize: 14, color: colors.text },
    textButton: {
      marginTop: spacing.md,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dangerText: { fontSize: 14, color: colors.danger },
    error: {
      marginTop: spacing.md,
      fontSize: 12,
      lineHeight: 18,
      color: colors.danger,
    },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.7 },
  });
