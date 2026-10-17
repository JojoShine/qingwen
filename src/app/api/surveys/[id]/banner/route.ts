import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { canManage } from '@/lib/permissions';
import { handle, HttpError } from '@/lib/http';
import { decodeBannerImage } from '@/lib/banner-image';

export function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const survey = await db.survey.findUnique({ where: { id: (await ctx.params).id }, select: { ownerId: true, status: true, banner: true, bannerImage: true } });
    if (!survey?.bannerImage) throw new HttpError(404, 'Banner 图片不存在');
    if (survey.status === 'DRAFT' || survey.banner !== 'custom') {
      const user = await requireUser();
      if (!canManage(user, survey.ownerId)) throw new HttpError(404, 'Banner 图片不存在');
    }
    const image = decodeBannerImage(survey.bannerImage);
    if (!image) throw new HttpError(404, 'Banner 图片不存在');
    return new Response(new Uint8Array(image.bytes), { headers: { 'Content-Type': image.mime, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  });
}
