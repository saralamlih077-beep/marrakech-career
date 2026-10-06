import { useState } from 'react';
import cachedPreviews from '../companyWebsitePreviews.json';
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
  const [imageFailed, setImageFailed] = useState(false);
  const href = url?.href;
  const domain = url?.hostname.replace(/^www\./, '');
  const image = href ? (cachedPreviews as Record<string, string>)[href] : undefined;

  const preview = (
    <div className="company-website-preview relative h-40 overflow-hidden border-b border-[#EAE5E0]" style={{ backgroundColor: `${color}0D` }}>
      <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
        <div className="absolute -right-8 -top-12 h-44 w-44 rounded-full" style={{ backgroundColor: `${color}0A` }} />
        <div className="absolute -bottom-16 -left-10 h-44 w-44 rounded-full" style={{ backgroundColor: `${color}08` }} />
        <Building2 size={44} strokeWidth={1.2} style={{ color: `${color}70` }} />
      </div>
      {image && !imageFailed && (
        <img
          src={image}
          alt={`Aperçu du site de ${name}`}
          width={640}
          height={360}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover object-top"
          onError={() => setImageFailed(true)}
        />
      )}
      <div className="absolute inset-x-0 bottom-0 flex min-w-0 items-center gap-2 bg-white/95 px-3 py-2 text-[11px] text-[#57534E] backdrop-blur-sm">
        <Globe size={12} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate">{domain || 'Site web non renseigné'}</span>
        {href && <ExternalLink size={12} className="shrink-0 text-[#621E3E]" />}
      </div>
      {href && (!image || imageFailed) && (
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2 py-1 text-[10px] font-medium text-[#78716C]">
          Aperçu indisponible
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
