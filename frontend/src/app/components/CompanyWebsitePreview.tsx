import { useEffect, useRef, useState } from 'react';
import { Building2, ExternalLink, Globe } from 'lucide-react';

function publicWebsite(value: string | null): URL | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`);
    const host = url.hostname.toLowerCase();
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port
      || !host.includes('.') || /^(\d+\.){3}\d+$/.test(host) || host.includes(':')
      || /\.(localhost|local|internal|test|invalid)$/.test(host)) return null;
    // Previews need only the public page, without tracking parameters or fragments.
    url.search = '';
    url.hash = '';
    return url;
  } catch {
    return null;
  }
}

export default function CompanyWebsitePreview({ website, name, color }: {
  website: string | null; name: string; color: string;
}) {
  const url = publicWebsite(website);
  return <WebsitePreview key={url?.href || 'no-site'} url={url} name={name} color={color} />;
}

function WebsitePreview({ url, name, color }: { url: URL | null; name: string; color: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const href = url?.href;
  const domain = url?.hostname.replace(/^www\./, '');

  useEffect(() => {
    if (!href || !container.current) return;
    if (!('IntersectionObserver' in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '200px' });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [href]);

  useEffect(() => {
    if (!visible || !href) return;
    const timer = window.setTimeout(() => {
      setStatus(current => current === 'loading' ? 'unavailable' : current);
    }, 20_000);
    return () => window.clearTimeout(timer);
  }, [visible, href, attempt]);

  useEffect(() => {
    if (status !== 'unavailable' || attempt >= 2) return;
    // mShots queues new sites and initially serves a 400 × 300 placeholder.
    // Retry twice, then leave the site link available without a broken image.
    const timer = window.setTimeout(() => {
      setStatus('loading');
      setAttempt(current => current + 1);
    }, attempt === 0 ? 6_000 : 18_000);
    return () => window.clearTimeout(timer);
  }, [status, attempt]);

  const preview = (
    <div ref={container} className="company-website-preview relative h-40 overflow-hidden border-b border-[#EAE5E0]" style={{ backgroundColor: `${color}0D` }}>
      <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
        <div className="absolute -right-8 -top-12 h-44 w-44 rounded-full" style={{ backgroundColor: `${color}0A` }} />
        <div className="absolute -bottom-16 -left-10 h-44 w-44 rounded-full" style={{ backgroundColor: `${color}08` }} />
        <Building2 size={44} strokeWidth={1.2} style={{ color: `${color}70` }} />
      </div>
      {href && visible && (
        <img
          key={attempt}
          src={`https://s.wordpress.com/mshots/v1/${encodeURIComponent(href)}?w=800&h=450${attempt ? `&retry=${attempt}` : ''}`}
          alt={`Aperçu du site de ${name}`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className={`absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-300 ${status === 'ready' ? 'opacity-100' : 'opacity-0'}`}
          onLoad={event => setStatus(event.currentTarget.naturalWidth > 400 ? 'ready' : 'unavailable')}
          onError={() => setStatus('unavailable')}
        />
      )}
      <div className="absolute inset-x-0 bottom-0 flex min-w-0 items-center gap-2 bg-white/95 px-3 py-2 text-[11px] text-[#57534E] backdrop-blur-sm">
        <Globe size={12} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate">{domain || 'Site web non renseigné'}</span>
        {href && <ExternalLink size={12} className="shrink-0 text-[#621E3E]" />}
      </div>
      {href && status !== 'ready' && (
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2 py-1 text-[10px] font-medium text-[#78716C]">
          {attempt < 2 || status === 'loading' ? 'Chargement de l’aperçu…' : 'Aperçu indisponible'}
        </span>
      )}
    </div>
  );

  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`Ouvrir le site de ${name} (nouvel onglet)`}
      className="block shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#621E3E]">
      {preview}
    </a>
  ) : preview;
}
