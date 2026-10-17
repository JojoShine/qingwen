import { bannerCaptions } from '@/lib/survey';

export default function Banner({ theme, title, subtitle, image, small = false }: { theme: string; title?: string | null; subtitle?: string | null; image?: string | null; small?: boolean }) {
  if (theme === 'none') return null;
  const caption = bannerCaptions[theme];
  const heading = title ?? caption?.title ?? '';
  const eyebrow = subtitle ?? caption?.subtitle ?? '';
  return <div className={`survey-banner banner-${theme} ${small ? 'banner-small' : ''}`}>
    {theme === 'custom' ? image && <img className="banner-image" src={image} alt=""/> : <div aria-hidden="true"><div className="banner-grain"/><span className="banner-orbit orbit-one"/><span className="banner-orbit orbit-two"/><span className="banner-disc"/><span className="banner-pill"/><span className="banner-spark">✳</span></div>}
    {(heading || eyebrow) && <div className="banner-caption">{eyebrow && <span>{eyebrow}</span>}{heading && <strong>{heading}</strong>}</div>}
  </div>;
}
