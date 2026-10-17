import { afterEach, describe, expect, it, vi } from 'vitest';
import { withBasePath, withoutBasePath } from '@/lib/paths';

afterEach(() => vi.unstubAllEnvs());

describe('deployment paths', () => {
  it('keeps default local paths unchanged', () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', undefined);
    expect(withBasePath('/api/surveys')).toBe('/api/surveys');
    expect(withoutBasePath('/surveys/id/edit')).toBe('/surveys/id/edit');
  });

  it.each([
    ['/api/surveys/id/export?page=2', '/surveys/api/surveys/id/export?page=2'],
    ['/api/surveys/id/banner', '/surveys/api/surveys/id/banner'],
    ['/preview', '/surveys/preview'],
    ['/login', '/surveys/login'],
    ['/surveys', '/surveys/surveys'],
    ['/surveys/id/results', '/surveys/surveys/id/results'],
  ])('adds the prefix to the app-relative browser URL %s', (path, expected) => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/surveys');
    expect(withBasePath(path)).toBe(expected);
  });

  it.each([
    ['/surveys/surveys/id/edit', '/surveys/id/edit'],
    ['/surveys', '/'],
    ['/surveys/', '/'],
    ['/surveys-other', '/surveys-other'],
    ['/login', '/login'],
  ])('removes exactly one deployment segment from browser pathname %s', (path, expected) => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/surveys');
    expect(withoutBasePath(path)).toBe(expected);
  });
});
