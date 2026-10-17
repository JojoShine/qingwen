import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { PublicSurveyLoader } from '@/components/public-survey';
export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: { params: Promise<{ shareId: string }> }): Promise<Metadata> {
  const survey = await db.survey.findUnique({ where: { shareId: (await params).shareId }, select: { title: true, browserTitle: true, status: true } });
  return { title: { absolute: survey && survey.status !== 'DRAFT' ? survey.browserTitle.trim() || survey.title : '问卷暂时无法访问' } };
}
export default async function Page({ params }: { params: Promise<{ shareId: string }> }) { return <PublicSurveyLoader shareId={(await params).shareId}/>; }
