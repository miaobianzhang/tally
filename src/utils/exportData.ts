import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { CategoryDefinition, Session } from '../types';
import type { TallySnapshot } from './snapshot';

function stamp(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(
    date.getDate(),
  )}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

async function shareFile(
  name: string,
  content: string,
  mimeType: string,
  dialogTitle: string,
): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('当前设备不支持系统分享');
  }
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  await file.write(content);
  await Sharing.shareAsync(file.uri, {
    mimeType,
    dialogTitle,
    UTI: mimeType === 'text/csv' ? 'public.comma-separated-values-text' : 'public.json',
  });
}

export async function exportSnapshotJson(
  snapshot: TallySnapshot,
): Promise<void> {
  await shareFile(
    `tally-backup-${stamp()}.json`,
    JSON.stringify(snapshot, null, 2),
    'application/json',
    '导出 Tally 备份',
  );
}

function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export async function exportSessionsCsv(
  sessions: Session[],
  categories: CategoryDefinition[],
): Promise<void> {
  const labels = new Map(
    categories.map((category) => [category.id, category.label]),
  );
  const header = [
    'id',
    'activity',
    'category_id',
    'category_label',
    'started_at',
    'ended_at',
    'duration_seconds',
    'created_at',
  ];
  const rows = sessions
    .slice()
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((session) =>
      [
        session.id,
        session.activity,
        session.category,
        labels.get(session.category) ?? '未分类',
        new Date(session.startedAt).toISOString(),
        new Date(session.endedAt).toISOString(),
        Math.max(0, Math.round((session.endedAt - session.startedAt) / 1000)),
        new Date(session.createdAt).toISOString(),
      ]
        .map(csvCell)
        .join(','),
    );
  const content = `﻿${[header.join(','), ...rows].join('\r\n')}`;

  await shareFile(
    `tally-sessions-${stamp()}.csv`,
    content,
    'text/csv',
    '导出 Tally 记录',
  );
}
