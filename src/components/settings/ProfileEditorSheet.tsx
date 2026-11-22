import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useProfile } from '../../hooks/useProfile';
import { useTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { ThemeColors } from '../../theme/types';
import { radius, spacing } from '../../theme';
import { hapticSelection } from '../../utils/haptics';
import {
  deleteStoredImage,
  storePickedImage,
} from '../../utils/imageStorage';
import { UserAvatar } from './UserAvatar';

interface ProfileEditorSheetProps {
  onClose: () => void;
}

export function ProfileEditorSheet({ onClose }: ProfileEditorSheetProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { profile, updateProfile } = useProfile();
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [avatarUri, setAvatarUri] = useState<string | null>(profile.avatarUri);
  const [busy, setBusy] = useState(false);

  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('需要相册权限', '允许访问相册后才能更换头像。');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setBusy(true);
    try {
      setAvatarUri(await storePickedImage(result.assets[0].uri, 'avatar'));
      hapticSelection();
    } catch (error) {
      console.warn('[tally] avatar pick failed', error);
      Alert.alert('头像读取失败', '请换一张图片重试。');
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = () => {
    if (avatarUri && avatarUri !== profile.avatarUri) {
      deleteStoredImage(avatarUri);
    }
    onClose();
  };

  const handleSave = async () => {
    if (busy) return;
    setBusy(true);
    const previous = profile.avatarUri;
    const saved = await updateProfile({
      displayName: displayName.trim() || 'Tally 用户',
      avatarUri,
    });
    setBusy(false);
    if (!saved) {
      Alert.alert('保存失败', '请重试。');
      return;
    }
    if (previous && previous !== avatarUri) deleteStoredImage(previous);
    hapticSelection();
    onClose();
  };

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleCancel}
    >
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="关闭个人资料"
          onPress={handleCancel}
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
              <Text style={styles.title}>个人资料</Text>
              <Text style={styles.subtitle}>只显示在这台设备上，不参与同步。</Text>

              <View style={styles.avatarRow}>
                <UserAvatar
                  uri={avatarUri}
                  displayName={displayName}
                  size={72}
                />
                <View style={styles.avatarActions}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void pickAvatar()}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.secondaryText}>更换头像</Text>
                  </Pressable>
                  {avatarUri ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setAvatarUri(null)}
                      style={({ pressed }) => [
                        styles.textButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.textButtonLabel}>移除照片</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>

              <Text style={styles.label}>用户名</Text>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                maxLength={20}
                placeholder="Tally 用户"
                placeholderTextColor={colors.muted}
                style={styles.input}
                returnKeyType="done"
              />

              <Pressable
                accessibilityRole="button"
                onPress={() => void handleSave()}
                disabled={busy}
                style={({ pressed }) => [
                  styles.saveButton,
                  busy && styles.disabled,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.saveText}>{busy ? '保存中…' : '保存'}</Text>
              </Pressable>
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
      maxHeight: '85%',
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
    },
    title: { fontSize: 20, fontWeight: '600', color: colors.text },
    subtitle: {
      marginTop: 4,
      fontSize: 13,
      color: colors.muted,
      lineHeight: 18,
    },
    avatarRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
      marginTop: spacing.xl,
    },
    avatarActions: { flex: 1, gap: spacing.sm },
    secondaryButton: {
      height: 36,
      alignSelf: 'flex-start',
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
    },
    secondaryText: { fontSize: 13, color: colors.text },
    textButton: { alignSelf: 'flex-start', paddingVertical: 4 },
    textButtonLabel: { fontSize: 13, color: colors.danger },
    label: {
      marginTop: spacing.xl,
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
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.rangeTint,
    },
    saveButton: {
      marginTop: spacing.xl,
      height: 48,
      borderRadius: radius.pill,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveText: { fontSize: 16, fontWeight: '600', color: colors.onAccent },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.75 },
  });
