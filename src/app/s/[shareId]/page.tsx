import { PublicSurveyLoader } from '@/components/public-survey';
export default async function Page({ params }: { params: Promise<{ shareId: string }> }) { return <PublicSurveyLoader shareId={(await params).shareId}/>; }
