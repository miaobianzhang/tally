import { fromByteArray } from 'base64-js';
import { utf8ToBytes } from '@noble/hashes/utils.js';

export interface WebdavCredentials {
  serverUrl: string;
  username: string;
  appPassword: string;
}

export interface WebdavFile {
  status: number;
  body?: string;
  etag?: string;
  lastModified?: string;
}

export class WebdavError extends Error {
  status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = 'WebdavError';
    this.status = status;
  }
}

function normalizeServerUrl(value: string): string {
  const url = value.trim().replace(/\/+$/, '');
  if (!/^https:\/\//i.test(url)) {
    throw new WebdavError('WebDAV 地址必须以 https:// 开头');
  }
  return url;
}

function encodePath(path: string): string {
  return path
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function buildUrl(credentials: WebdavCredentials, path: string): string {
  return `${normalizeServerUrl(credentials.serverUrl)}/${encodePath(path)}`;
}

function authHeader(credentials: WebdavCredentials): string {
  const token = fromByteArray(
    utf8ToBytes(`${credentials.username}:${credentials.appPassword}`),
  );
  return `Basic ${token}`;
}

async function request(
  credentials: WebdavCredentials,
  method: string,
  path: string,
  options: {
    body?: string;
    headers?: Record<string, string>;
    timeoutMs?: number;
  } = {},
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 20_000,
  );
  try {
    const response = await fetch(buildUrl(credentials, path), {
      method,
      headers: {
        Authorization: authHeader(credentials),
        ...options.headers,
      },
      body: options.body,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof WebdavError) throw error;
    throw new WebdavError(
      '无法连接坚果云，请检查网络或 WebDAV 地址',
    );
  } finally {
    clearTimeout(timeout);
  }
}

function statusError(status: number): WebdavError {
  if (status === 401 || status === 403) {
    return new WebdavError('坚果云邮箱或应用密码不正确', status);
  }
  if (status === 429) {
    return new WebdavError('坚果云请求过于频繁，请稍后重试', status);
  }
  if (status === 507) {
    return new WebdavError('坚果云空间不足', status);
  }
  return new WebdavError(`WebDAV 请求失败（${status}）`, status);
}

export async function ensureParentDirectory(
  credentials: WebdavCredentials,
  path: string,
  timeoutMs = 20_000,
): Promise<void> {
  const segments = path.split('/').filter(Boolean);
  segments.pop();
  if (segments.length === 0) return;

  for (let index = 1; index <= segments.length; index += 1) {
    const parent = segments.slice(0, index).join('/') + '/';
    const response = await request(credentials, 'MKCOL', parent, {
      timeoutMs,
    });
    if (response.status === 201 || response.status === 405 || response.status === 301) {
      continue;
    }
    if (response.status === 409) {
      throw new WebdavError('WebDAV 目录不存在，请检查路径', 409);
    }
    if (response.status >= 400) throw statusError(response.status);
  }
}

export async function getFile(
  credentials: WebdavCredentials,
  path: string,
): Promise<WebdavFile> {
  const response = await request(credentials, 'GET', path, {
    timeoutMs: 15_000,
  });
  if (response.status === 404) return { status: 404 };
  if (response.status >= 400) throw statusError(response.status);

  return {
    status: response.status,
    body: await response.text(),
    etag: response.headers.get('etag') ?? undefined,
    lastModified: response.headers.get('last-modified') ?? undefined,
  };
}

export async function putFile(
  credentials: WebdavCredentials,
  path: string,
  body: string,
  options: { etag?: string; createOnly?: boolean } = {},
): Promise<{ etag?: string }> {
  await ensureParentDirectory(credentials, path);
  const headers: Record<string, string> = {
    'Content-Type': 'application/octet-stream',
    Overwrite: 'T',
  };
  if (options.createOnly) headers['If-None-Match'] = '*';
  else if (options.etag) headers['If-Match'] = options.etag;

  const response = await request(credentials, 'PUT', path, {
    body,
    headers,
    timeoutMs: 30_000,
  });
  if (response.status >= 400) throw statusError(response.status);
  return { etag: response.headers.get('etag') ?? undefined };
}

export async function propfindEtag(
  credentials: WebdavCredentials,
  path: string,
): Promise<string | undefined> {
  const response = await request(credentials, 'PROPFIND', path, {
    body: '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:getetag/></d:prop></d:propfind>',
    headers: { Depth: '0', 'Content-Type': 'application/xml' },
    timeoutMs: 15_000,
  });
  if (response.status >= 400) return undefined;
  const text = await response.text();
  const match = text.match(/<[^>]*getetag[^>]*>([^<]+)<\/[^>]*getetag>/i);
  return match?.[1]?.trim();
}

export async function testWebdav(
  credentials: WebdavCredentials,
  path: string,
): Promise<{ exists: boolean; etag?: string; body?: string }> {
  const file = await getFile(credentials, path);
  return {
    exists: file.status !== 404,
    etag: file.etag,
    body: file.body,
  };
}
