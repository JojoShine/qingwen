import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  survey: { id: 'survey-id', ownerId: 'owner', shareId: 'share-id', status: 'ACTIVE', qrLogoImage: null as string | null },
  actor: { id: 'owner', role: 'USER', active: true },
}));
vi.mock('@/lib/auth', () => ({ requireUser: async () => state.actor }));
vi.mock('@/lib/db', () => {
  const db = {
    survey: {
      findUnique: async () => state.survey,
      update: vi.fn(async ({ data }: { data: { qrLogoImage: string | null } }) => {
        state.survey.qrLogoImage = data.qrLogoImage;
        return { qrLogoImage: data.qrLogoImage };
      }),
    },
    $queryRaw: async () => [],
    $transaction: async (fn: (tx: unknown) => unknown) => fn(db),
  };
  return { db };
});
import { GET, PATCH } from '@/app/api/surveys/[id]/share/route';
import { db } from '@/lib/db';
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1cAAAAASUVORK5CYII=';
const context = { params: Promise.resolve({ id: 'survey-id' }) };
const get = () => GET(new Request('https://forms.example.com/api/surveys/survey-id/share'), context);
const patch = (data: unknown, origin = 'https://forms.example.com') => PATCH(new Request('https://forms.example.com/api/surveys/survey-id/share', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(data) }), context);

beforeEach(() => {
  state.survey.status = 'ACTIVE'; state.survey.qrLogoImage = null; state.actor.id = 'owner';
  vi.clearAllMocks(); vi.stubEnv('APP_URL', ''); vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '');
});
afterEach(() => vi.unstubAllEnvs());

describe('saved share QR logos', () => {
  it('saves a logo, returns it when reopening and supports removing it', async () => {
    expect(await (await get()).json()).toEqual({ url: '/s/share-id', qrLogoImage: null });
    expect((await patch({ qrLogoImage: image })).status).toBe(200);
    expect(await (await get()).json()).toEqual({ url: '/s/share-id', qrLogoImage: image });
    expect((await patch({ qrLogoImage: null })).status).toBe(200);
    expect((await (await get()).json()).qrLogoImage).toBeNull();
  });
  it.each(['https://example.com/logo.png', 'data:image/svg+xml;base64,PHN2Zy8+', 'data:image/png;base64,aW52YWxpZA==', 'data:image/png;base64,' + 'A'.repeat(100000), 123, undefined])('rejects an invalid logo without saving it', async qrLogoImage => {
    expect((await patch({ qrLogoImage })).status).toBe(422);
    expect(db.survey.update).not.toHaveBeenCalled();
  });
  it('denies another user access and modifications', async () => {
    state.actor.id = 'someone-else';
    expect((await get()).status).toBe(404);
    expect((await patch({ qrLogoImage: image })).status).toBe(404);
    expect(db.survey.update).not.toHaveBeenCalled();
  });
  it('requires publication and rejects cross-site modifications', async () => {
    state.survey.status = 'DRAFT';
    expect((await get()).status).toBe(409);
    expect((await patch({ qrLogoImage: image })).status).toBe(409);
    state.survey.status = 'ACTIVE';
    expect((await patch({ qrLogoImage: image }, 'https://untrusted.example.com')).status).toBe(403);
    expect(db.survey.update).not.toHaveBeenCalled();
  });
});
