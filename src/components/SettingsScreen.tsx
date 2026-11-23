import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCategories } from '../hooks/useCategories';
import { loadTombstones, saveTombstones } from '../storage/tombstoneStorage';
import { usePlans } from '../hooks/usePlans';
import { useProfile } from '../hooks/useProfile';
import { useSync } from '../hooks/useSync';
import { useTally } from '../hooks/useTally';
import { useTheme } from '../theme/ThemeProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import type {
  BackgroundKind,
  ThemeColors,
  ThemeMode,
} from '../theme/types';
import { radius, spacing } from '../theme';
import { BACKGROUND_PRESETS } from '../theme/presets';
import type { CategoryDefinition } from '../types';
import { hapticSelection } from '../utils/haptics';
import {
  exportSessionsCsv,
  exportSnapshotJson,
} from '../utils/exportData';
import { buildSnapshot, isTallySnapshot } from '../utils/snapshot';
import { mergeSnapshots } from '../sync/merge';
import { replaceCategories } from '../storage/categoryStorage';
import { replaceSessions, savePrefs } from '../storage/tallyStorage';
import { replacePlanItems, savePlanPrefs } from '../storage/planStorage';
import { BackgroundEditorSheet } from './settings/BackgroundEditorSheet';
import { CategoryEditorSheet } from './settings/CategoryEditorSheet';
import { ColorChoiceSheet } from './settings/ColorChoiceSheet';
import { ProfileEditorSheet } from './settings/ProfileEditorSheet';
import { SyncSetupSheet } from './settings/SyncSetupSheet';
import { UserAvatar } from './settings/UserAvatar';

type ColorKey = 'pageColor' | 'surfaceColor' | 'accentColor';

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/(tabs)');
}

export function SettingsScreen() {
  const { colors, prefs, setMode, setColor, setBackground, resetAppearance } =
    useTheme();
  const styles = useThemedStyles(createStyles);
  const { profile } = useProfile();
  const { categories, reloadCategories } = useCategories();
  const {
    sessions,
    lastCategory,
    timer,
    reload: reloadTally,
  } = useTally();
  const {
    items: plans,
    prefs: planPrefs,
    reload: reloadPlans,
  } = usePlans();
  const { configured, status: syncStatus, config } = useSync();
  const [profileOpen, setProfileOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [editingCategory, setEditingCategory] =
    useState<CategoryDefinition | null | undefined>(undefined);
  const [colorSheet, setColorSheet] = useState<{
    key: ColorKey;
    title: string;
  } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [backgroundEditor, setBackgroundEditor] = useState<{
    sourceUri?: string;
  } | null>(null);

  const active = categories.filter((category) => !category.archived);
  const archived = categories.filter((category) => category.archived);
  const orderedCategories = [...active, ...archived];

  const handleExport = async (kind: 'json' | 'csv') => {
    if (exporting) return;
    setExporting(true);
    try {
      if (kind === 'json') {
        const tombstones = await loadTombstones();
        await exportSnapshotJson(
          buildSnapshot({
            categories,
            sessions,
            plans,
            prefs: { lastCategory },
            planPrefs,
            tombstones,
          }),
        );
      } else {
        await exportSessionsCsv(sessions, categories);
      }
    } catch (error) {
      console.warn('[tally] export failed', error);
      Alert.alert('导出失败', '请稍后重试。');
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    if (exporting) return;
    if (timer.status !== 'idle') {
      Alert.alert('请先结束当前计时', '计时完成后才能导入备份。');
      return;
    }
    setExporting(true);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled || !picked.assets[0]) return;
      const text = await new File(picked.assets[0].uri).text();
      const parsed: unknown = JSON.parse(text);
      if (!isTallySnapshot(parsed)) {
        Alert.alert('无法导入', '这不是有效的 Tally 备份文件。');
        return;
      }
      const tombstones = await loadTombstones();
      const local = buildSnapshot({
        categories,
        sessions,
        plans,
        prefs: { lastCategory },
        planPrefs,
        tombstones,
      });
      const merged = mergeSnapshots(local, parsed).snapshot;
      Alert.alert(
        '导入备份',
        `将合并备份中的记录（备份共 ${parsed.sessions.length} 条）。较新的本机记录会保留。`,
        [
          { text: '取消', style: 'cancel' },
          {
            text: '导入',
            onPress: () => {
              void (async () => {
                try {
                  await replaceCategories(merged.categories);
                  await replaceSessions(merged.sessions);
                  await replacePlanItems(merged.plans);
                  await savePrefs(merged.prefs);
                  await savePlanPrefs(merged.planPrefs);
                  await saveTombstones(merged.tombstones);
                  await Promise.all([
                    reloadTally(),
                    reloadPlans(),
                    reloadCategories(),
                  ]);
                  hapticSelection();
                  Alert.alert('导入完成', '备份记录已合并到本机。');
                } catch (error) {
                  console.warn('[tally] import failed', error);
                  Alert.alert('导入失败', '写入本机数据时出错。');
                }
              })();
            },
          },
        ],
      );
    } catch (error) {
      console.warn('[tally] import read failed', error);
      Alert.alert('导入失败', '无法读取或解析这个文件。');
    } finally {
      setExporting(false);
    }
  };

  const chooseBackground = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('需要相册权限', '允许访问相册后才能设置背景。');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (result.canceled || !result.assets[0]) return;
    setBackgroundEditor({ sourceUri: result.assets[0].uri });
    hapticSelection();
  };

  const setPreset = (id: string | null, kind: BackgroundKind) => {
    void setBackground({
      ...prefs.background,
      kind,
      presetId: id ?? undefined,
    });
    hapticSelection();
  };

  const handlePhotoTile = () => {
    if (!prefs.background.imageUri) {
      void chooseBackground();
      return;
    }
    if (prefs.background.kind === 'image') {
      setBackgroundEditor({});
    } else {
      void setBackground({
        ...prefs.background,
        kind: 'image',
        presetId: undefined,
      });
      hapticSelection();
    }
  };

  return (
    <SafeAreaView
      style={styles.safe}
      edges={['top', 'left', 'right', 'bottom']}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="返回"
            onPress={goBack}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>设置</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="编辑个人资料"
          onPress={() => setProfileOpen(true)}
          style={({ pressed }) => [
            styles.profileCard,
            pressed && styles.pressed,
          ]}
        >
          <UserAvatar
            uri={profile.avatarUri}
            displayName={profile.displayName}
            size={56}
            accessibilityLabel="个人头像"
          />
          <View style={styles.profileText}>
            <Text style={styles.profileName}>{profile.displayName}</Text>
            <Text style={styles.profileHint}>点击修改头像和用户名</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <Section title="分类" hint={`${active.length} 个使用中 · ${archived.length} 个已停用`}>
          {orderedCategories.map((category) => (
            <Pressable
              key={category.id}
              accessibilityRole="button"
              accessibilityLabel={`编辑分类 ${category.label}${category.archived ? '，已停用' : ''}`}
              onPress={() => setEditingCategory(category)}
              style={({ pressed }) => [
                styles.row,
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[styles.colorDot, { backgroundColor: category.color }]}
              />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{category.label}</Text>
                <Text style={styles.rowHint}>
                  {category.archived
                    ? '已停用 · 历史记录保留'
                    : category.countsAsFocus
                      ? '计入专注统计'
                      : '不参与专注统计'}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            onPress={() => setEditingCategory(null)}
            style={({ pressed }) => [
              styles.addRow,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.addText}>＋ 添加分类</Text>
          </Pressable>
        </Section>

        <Section title="外观" hint="跟随系统，或自定义关键颜色">
          <View style={styles.modeRow}>
            {(
              [
                ['system', '跟随系统'],
                ['light', '浅色'],
                ['dark', '深色'],
              ] as const
            ).map(([value, label]) => {
              const selected = prefs.mode === value;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    void setMode(value as ThemeMode);
                    hapticSelection();
                  }}
                  style={[
                    styles.modeChip,
                    selected && styles.modeChipSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.modeText,
                      selected && styles.modeTextSelected,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {(
            [
              ['pageColor', '页面背景'],
              ['surfaceColor', '卡片背景'],
              ['accentColor', '按钮与强调色'],
            ] as const
          ).map(([key, label]) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              onPress={() => setColorSheet({ key, title: label })}
              style={({ pressed }) => [
                styles.colorRow,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.colorLabel}>{label}</Text>
              <View style={styles.colorValue}>
                <View
                  style={[
                    styles.colorPreview,
                    {
                      backgroundColor:
                        prefs[key] ??
                        (key === 'pageColor'
                          ? colors.page
                          : key === 'surfaceColor'
                            ? colors.surface
                            : colors.accent),
                    },
                  ]}
                />
                <Text style={styles.colorHex}>
                  {prefs[key] ?? '默认'}
                </Text>
              </View>
            </Pressable>
          ))}

          <Text style={styles.subLabel}>首页背景</Text>
          <View style={styles.backgrounds}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="默认背景"
              accessibilityState={{ selected: prefs.background.kind === 'theme' }}
              onPress={() => setPreset(null, 'theme')}
              style={styles.backgroundTile}
            >
              <View
                style={[
                  styles.backgroundFill,
                  { backgroundColor: colors.page },
                  prefs.background.kind === 'theme' &&
                    styles.backgroundFillSelected,
                ]}
              />
              <Text
                style={[
                  styles.tileLabel,
                  prefs.background.kind === 'theme' && styles.tileLabelSelected,
                ]}
              >
                默认
              </Text>
              {prefs.background.kind === 'theme' ? (
                <View style={styles.checkBadge}>
                  <Text style={styles.checkText}>✓</Text>
                </View>
              ) : null}
            </Pressable>
            {BACKGROUND_PRESETS.map((preset) => {
              const selected =
                prefs.background.kind === 'preset' &&
                prefs.background.presetId === preset.id;
              return (
                <Pressable
                  key={preset.id}
                  accessibilityRole="button"
                  accessibilityLabel={`背景 ${preset.label}`}
                  accessibilityState={{ selected }}
                  onPress={() => setPreset(preset.id, 'preset')}
                  style={styles.backgroundTile}
                >
                  <LinearGradient
                    colors={colors.isDark ? preset.dark : preset.light}
                    style={[
                      styles.backgroundFill,
                      selected && styles.backgroundFillSelected,
                    ]}
                  />
                  <Text
                    style={[
                      styles.tileLabel,
                      selected && styles.tileLabelSelected,
                    ]}
                  >
                    {preset.label}
                  </Text>
                  {selected ? (
                    <View style={styles.checkBadge}>
                      <Text style={styles.checkText}>✓</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="从相册选择背景"
              accessibilityState={{
                selected: prefs.background.kind === 'image',
              }}
              onPress={handlePhotoTile}
              style={styles.backgroundTile}
            >
              {prefs.background.imageUri ? (
                <Image
                  source={{ uri: prefs.background.imageUri }}
                  style={[
                    styles.backgroundFill,
                    prefs.background.kind === 'image' &&
                      styles.backgroundFillSelected,
                  ]}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.photoFill}>
                  <Text style={styles.photoIcon}>＋</Text>
                </View>
              )}
              <Text
                style={[
                  styles.tileLabel,
                  prefs.background.kind === 'image' && styles.tileLabelSelected,
                ]}
              >
                相册
              </Text>
              {prefs.background.kind === 'image' ? (
                <View style={styles.checkBadge}>
                  <Text style={styles.checkText}>✓</Text>
                </View>
              ) : null}
            </Pressable>
          </View>
          {prefs.background.imageUri ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void chooseBackground()}
              style={({ pressed }) => [
                styles.changePhotoButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.changePhotoText}>更换背景照片</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void resetAppearance();
              hapticSelection();
            }}
            style={({ pressed }) => [
              styles.resetButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.resetText}>恢复默认外观</Text>
          </Pressable>
        </Section>

        <Section title="数据" hint="导出备份或记录；同步是可选项">
          <Pressable
            accessibilityRole="button"
            disabled={exporting}
            onPress={() => void handleExport('json')}
            style={({ pressed }) => [
              styles.actionRow,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.actionText}>导出数据备份（JSON）</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={exporting}
            onPress={() => void handleExport('csv')}
            style={({ pressed }) => [
              styles.actionRow,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.actionText}>导出记录表格（CSV）</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={exporting}
            onPress={() => void handleImport()}
            style={({ pressed }) => [
              styles.actionRow,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.actionText}>导入 JSON 备份</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          {exporting ? (
            <View style={styles.exportingRow}>
              <ActivityIndicator color={colors.text} />
              <Text style={styles.rowHint}>正在准备文件…</Text>
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="打开可选云同步设置"
            onPress={() => setSyncOpen(true)}
            style={({ pressed }) => [
              styles.syncRow,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.rowText}>
              <Text style={styles.syncTitle}>云同步（可选）</Text>
              <Text style={styles.rowHint}>
                {configured
                  ? config.lastSyncAt
                    ? '已连接 · 最近同步过'
                    : '已连接 · 等待首次同步'
                  : '仅本机 · 未开启同步'}
              </Text>
            </View>
            <Text style={styles.syncBadge}>
              {syncStatus === 'syncing'
                ? '同步中'
                : syncStatus === 'error'
                  ? '失败'
                  : configured
                    ? '已连接'
                    : '未开启'}
            </Text>
          </Pressable>
        </Section>

        <Section title="关于" hint="Tally 0.12.0 · 数据保存在本机">
          <Text style={styles.aboutText}>
            所有记录默认只保存在这台设备。开启坚果云同步后，数据会先加密再上传。
          </Text>
        </Section>
      </ScrollView>

      {profileOpen ? (
        <ProfileEditorSheet onClose={() => setProfileOpen(false)} />
      ) : null}
      {syncOpen ? (
        <SyncSetupSheet onClose={() => setSyncOpen(false)} />
      ) : null}
      {editingCategory !== undefined ? (
        <CategoryEditorSheet
          category={editingCategory}
          onClose={() => setEditingCategory(undefined)}
        />
      ) : null}
      {backgroundEditor ? (
        <BackgroundEditorSheet
          sourceUri={backgroundEditor.sourceUri}
          onClose={() => setBackgroundEditor(null)}
        />
      ) : null}
      {colorSheet ? (
        <ColorChoiceSheet
          title={colorSheet.title}
          value={prefs[colorSheet.key]}
          fallbackColor={
            colorSheet.key === 'pageColor'
              ? colors.page
              : colorSheet.key === 'surfaceColor'
                ? colors.surface
                : colors.accent
          }
          onSelect={(color) => {
            void setColor(colorSheet.key, color);
          }}
          onClose={() => setColorSheet(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.page },
    content: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xxl,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 44,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backIcon: { fontSize: 30, lineHeight: 34, color: colors.textOnPage },
    headerTitle: { fontSize: 18, fontWeight: '600', color: colors.textOnPage },
    headerSpacer: { width: 40 },
    profileCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginTop: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    profileText: { flex: 1 },
    profileName: { fontSize: 17, fontWeight: '600', color: colors.text },
    profileHint: { marginTop: 3, fontSize: 12, color: colors.muted },
    section: { marginTop: spacing.xl },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.mutedOnPage,
    },
    sectionHint: {
      marginTop: 3,
      fontSize: 12,
      color: colors.mutedOnPage,
    },
    sectionBody: {
      marginTop: spacing.sm,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: 56,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowText: { flex: 1 },
    rowTitle: { fontSize: 15, color: colors.text },
    rowHint: { marginTop: 2, fontSize: 12, color: colors.muted },
    colorDot: { width: 12, height: 12, borderRadius: 6 },
    chevron: { fontSize: 20, color: colors.muted },
    addRow: {
      minHeight: 50,
      paddingHorizontal: spacing.lg,
      justifyContent: 'center',
    },
    addText: { fontSize: 14, color: colors.textSecondary },
    modeRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      padding: spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    modeChip: {
      flex: 1,
      height: 34,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modeChipSelected: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    modeText: { fontSize: 12, color: colors.textSecondary },
    modeTextSelected: { color: colors.onAccent, fontWeight: '600' },
    colorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 52,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    colorLabel: { fontSize: 14, color: colors.text },
    colorValue: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    colorPreview: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: colors.border,
    },
    colorHex: { fontSize: 12, color: colors.muted },
    subLabel: {
      marginTop: spacing.lg,
      marginHorizontal: spacing.lg,
      fontSize: 13,
      color: colors.muted,
    },
    backgrounds: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
      padding: spacing.lg,
    },
    backgroundTile: {
      width: 64,
      alignItems: 'center',
      gap: 5,
    },
    backgroundFill: {
      width: 64,
      height: 64,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    backgroundFillSelected: {
      borderWidth: 2,
      borderColor: colors.accent,
    },
    tileLabel: { fontSize: 11, color: colors.muted },
    tileLabelSelected: { color: colors.text, fontWeight: '600' },
    checkBadge: {
      position: 'absolute',
      top: -6,
      right: 0,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.accent,
      borderWidth: 2,
      borderColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.onAccent,
    },
    changePhotoButton: {
      alignSelf: 'flex-start',
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      paddingVertical: spacing.xs,
    },
    changePhotoText: { fontSize: 12, color: colors.textSecondary },
    photoFill: {
      width: 64,
      height: 64,
      borderRadius: radius.md,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoIcon: { fontSize: 22, color: colors.muted },
    resetButton: { padding: spacing.lg, paddingTop: 0 },
    resetText: { fontSize: 13, color: colors.danger },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 52,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    actionText: { fontSize: 14, color: colors.text },
    exportingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    syncRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 56,
      paddingHorizontal: spacing.lg,
    },
    syncTitle: { fontSize: 13, color: colors.textSecondary },
    syncBadge: {
      fontSize: 11,
      color: colors.muted,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
    },
    aboutText: {
      padding: spacing.lg,
      fontSize: 13,
      lineHeight: 19,
      color: colors.textSecondary,
    },
    pressed: { opacity: 0.7 },
  });
