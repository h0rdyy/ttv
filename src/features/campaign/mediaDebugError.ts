import { friendlyError } from '@/lib/friendlyError';

type ErrorRecord = Record<string, unknown>;

export function mediaDebugError(error: unknown, fallback: string) {
  const friendly = friendlyError(error, fallback);
  const technical = technicalParts(error);
  if (technical.length === 0) return `${friendly} · debug: unknown error payload`;
  return `${friendly} · ${technical.join(' · ')}`;
}

function technicalParts(error: unknown) {
  const record = error && typeof error === 'object' ? error as ErrorRecord : null;
  const parts: string[] = [];

  const message = error instanceof Error
    ? error.message
    : stringValue(record?.message);
  pushUnique(parts, message ? `message=${message}` : '');

  const name = error instanceof Error
    ? error.name
    : stringValue(record?.name);
  pushUnique(parts, name ? `name=${name}` : '');

  const status = stringValue(record?.statusCode) || stringValue(record?.status);
  pushUnique(parts, status ? `status=${status}` : '');

  const code = stringValue(record?.code) || stringValue(record?.error);
  pushUnique(parts, code ? `code=${code}` : '');

  const details = stringValue(record?.details);
  pushUnique(parts, details ? `details=${details}` : '');

  const hint = stringValue(record?.hint);
  pushUnique(parts, hint ? `hint=${hint}` : '');

  return parts;
}

function stringValue(value: unknown) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function pushUnique(parts: string[], value: string) {
  if (value && !parts.includes(value)) parts.push(value);
}
