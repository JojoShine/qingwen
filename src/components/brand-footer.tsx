import { defaultBranding, type SurveyData } from '@/lib/survey';

export default function BrandFooter({ survey }: { survey: Pick<SurveyData, 'showBranding' | 'brandName' | 'brandDescription'> }) {
  if (survey.showBranding === false) return null;
  const name = survey.brandName ?? defaultBranding.brandName;
  const description = survey.brandDescription ?? defaultBranding.brandDescription;
  return <div className="survey-brand-footer">{name && <span className="brand-signature">由 <b>{name}</b></span>}{description && <span className="brand-description">{description}</span>}</div>;
}
