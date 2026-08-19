import { describe, expect, it } from 'vitest';
import { mediaDebugError } from '../../src/features/campaign/mediaDebugError';

describe('mediaDebugError', () => {
  it('includes Supabase storage message, status and code', () => {
    const message = mediaDebugError({
      message: 'new row violates row-level security policy',
      name: 'StorageApiError',
      statusCode: 403,
      error: 'Unauthorized',
    }, 'Не удалось загрузить изображение.');

    expect(message).toContain('message=new row violates row-level security policy');
    expect(message).toContain('name=StorageApiError');
    expect(message).toContain('status=403');
    expect(message).toContain('code=Unauthorized');
  });

  it('keeps an explicit unknown payload marker when the error has no useful fields', () => {
    expect(mediaDebugError({}, 'Ошибка загрузки')).toContain('debug: unknown error payload');
  });
});
