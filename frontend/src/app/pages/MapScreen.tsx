import { useState, useRef, useEffect } from 'react';
import { MapPin, Eye, Heart, X } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DOMAIN_COLORS } from '../constants';
import { companyAddress, recommendationScore } from '../utils';
import { SectorPill, MatchBadge, CompanyStatus } from '../components/shared';
import type { Company } from '../types';
import { useProfile } from '../../hooks/useProfile';
import type { JobOffer } from '../../hooks/useJobOffers';

function InteractiveCompanyMap({ companies, onSelect, focusCompanyId, focusedOfferTitle }: { companies: Company[]; onSelect: (id: number) => void; focusCompanyId?: number | null; focusedOfferTitle?: string | null }) {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) return;

    const map = L.map(mapElementRef.current, { zoomControl: true }).setView([31.634, -7.999], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    markersRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
    };
  }, []);

  useEffect(() => {
    const markers = markersRef.current;
    if (!markers) return;
    markers.clearLayers();

    companies.forEach(company => {
      if (company.latitude === null || company.longitude === null) return;
      const color = DOMAIN_COLORS[company.domaine || ''] || '#621E3E';
      const icon = L.divIcon({
        className: 'company-map-marker',
        html: `<svg width="22" height="28" viewBox="0 0 24 30" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 29C12 29 22 18.3 22 11A10 10 0 1 0 2 11C2 18.3 12 29 12 29Z" fill="${color}" stroke="white" stroke-width="1.5"/><circle cx="12" cy="11" r="3.2" fill="white"/></svg>`,
        iconSize: [22, 28],
        iconAnchor: [11, 28],
      });
      const marker = L.marker([company.latitude, company.longitude], { icon });
      marker.bindTooltip(focusedOfferTitle || company.nom, { direction: 'top', offset: [0, -28] });
      marker.on('click', () => onSelect(company.id));
      marker.addTo(markers);
    });
  }, [companies, focusedOfferTitle, onSelect]);

  useEffect(() => {
    if (!focusCompanyId || !mapRef.current) return;
    const company = companies.find((item) => item.id === focusCompanyId);
    if (company && company.latitude !== null && company.longitude !== null) {
      mapRef.current.flyTo([company.latitude, company.longitude], 15, { duration: 0.6 });
    }
  }, [companies, focusCompanyId]);

  return <div ref={mapElementRef} className="absolute inset-0 z-0" />;
}

export default function MapScreen({ companies, loading, error, favs, onFav, onView, focusedOffer, onClearFocusedOffer }: { companies: Company[]; loading: boolean; error: string | null; favs: Set<number>; onFav: (id: number) => void; onView: (c: Company) => void; focusedOffer?: JobOffer | null; onClearFocusedOffer?: () => void }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filterDomaine, setFilterDomaine] = useState('All');
  const [minimumMatch, setMinimumMatch] = useState(0);
  const { profile } = useProfile();
  const hasProfileForMatching = Boolean(profile.job_title.trim() || profile.skills.trim() || profile.education.trim() || profile.experience.trim() || profile.projects.trim() || profile.languages.trim());
  const domaines = ['All', ...Array.from(new Set(companies.map(c => c.domaine).filter((value): value is string => Boolean(value))))];
  const selected = companies.find(c => c.id === selectedId);

  useEffect(() => {
    setSelectedId(focusedOffer?.entreprise_id ?? null);
  }, [focusedOffer]);

  const visible = companies.filter(company =>
    (filterDomaine === 'All' || company.domaine === filterDomaine) &&
    (!hasProfileForMatching || recommendationScore(company, profile) >= minimumMatch),
  );
  const mapCompanies = focusedOffer
    ? companies.filter((company) => company.id === focusedOffer.entreprise_id)
    : visible;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:flex-row">
      {/* Filter sidebar */}
      <div className="w-full shrink-0 border-b border-[#EAE5E0] bg-white p-4 md:w-56 md:border-b-0 md:border-r md:p-5">
        <div className="space-y-3 md:space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#57534E]">Domaine</label>
            <select value={filterDomaine} onChange={(event) => setFilterDomaine(event.target.value)} className="w-full rounded-xl border border-[#EAE5E0] bg-white px-3 py-2.5 text-sm text-[#1C1917] outline-none focus:border-[#621E3E]">
              {domaines.map((domaine) => <option key={domaine} value={domaine}>{domaine === 'All' ? 'Tous les domaines' : domaine}</option>)}
            </select>
          </div>
          {hasProfileForMatching && <div>
            <div className="mb-2 flex items-center justify-between"><label className="text-xs font-semibold text-[#57534E]">Match Score</label><span className="text-xs font-bold text-[#621E3E]">{minimumMatch}%+</span></div>
            <input type="range" min={0} max={100} value={minimumMatch} onChange={(event) => setMinimumMatch(Number(event.target.value))} className="w-full accent-[#621E3E]" />
            <div className="mt-1 flex justify-between text-[10px] text-[#A8A29E]"><span>0%</span><span>{visible.length} entreprise{visible.length > 1 ? 's' : ''}</span><span>100%</span></div>
          </div>}
        </div>
      </div>

      {/* Map area */}
      <div className="map-canvas-frame relative min-h-0 flex-1 overflow-hidden bg-[#E8E4DC]">
        <CompanyStatus loading={loading} error={error} />
        <InteractiveCompanyMap companies={mapCompanies} onSelect={setSelectedId} focusCompanyId={focusedOffer?.entreprise_id} focusedOfferTitle={focusedOffer?.title} />

        {/* Selected company popup */}
        {selected && !focusedOffer && (
          <div className="absolute bottom-4 left-4 bg-white rounded-xl border border-[#EAE5E0] shadow-lg p-4 w-64 z-[1000]">
            <button onClick={() => { setSelectedId(null); onClearFocusedOffer?.(); }} className="absolute top-2.5 right-2.5 text-[#A8A29E] hover:text-[#1C1917]">
              <X size={14} />
            </button>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: DOMAIN_COLORS[selected.domaine || ''] || '#621E3E' }}>
                {selected.nom.split(' ').slice(0, 2).map(w => w[0]).join('')}
              </div>
              <div>
                <p className="text-xs font-bold text-[#1C1917]">{selected.nom}</p>
                <SectorPill domaine={selected.domaine || 'Domaine non renseign\u00e9'} sousDomaine={selected.sous_domaine} />
              </div>
            </div>
            {focusedOffer && <div className="mb-3 rounded-lg bg-[#621E3E]/7 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wide text-[#621E3E]">Offre sélectionnée</p><p className="mt-0.5 text-xs font-bold text-[#1C1917]">{focusedOffer.title}</p></div>}
            <div className="flex items-center gap-1 text-xs text-[#78716C] mb-3"><MapPin size={10} />{companyAddress(selected)}</div>
            <div className="flex items-center justify-between">
              {hasProfileForMatching && <MatchBadge pct={recommendationScore(selected, profile)} />}
              <div className="flex gap-1.5">
                <button onClick={() => onFav(selected.id)} className="p-1.5 rounded-lg bg-[#FBF9F7] hover:bg-[#EAE5E0]">
                  <Heart size={12} className={favs.has(selected.id) ? 'fill-[#D9828D] text-[#D9828D]' : 'text-[#A8A29E]'} />
                </button>
                <button onClick={() => onView(selected)} className="flex items-center gap-1 px-2.5 py-1 bg-[#621E3E] text-white rounded-lg text-xs font-semibold">
                  <Eye size={10} /> View
                </button>
              </div>
            </div>
          </div>
        )}
        {focusedOffer && (
          <div className="absolute bottom-4 left-4 z-[1000] w-72 rounded-xl border border-[#EAE5E0] bg-white p-4 shadow-lg">
            <button onClick={() => { setSelectedId(null); onClearFocusedOffer?.(); }} className="absolute right-2.5 top-2.5 text-[#A8A29E] hover:text-[#1C1917]"><X size={14} /></button>
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#621E3E]">Offre sélectionnée</p>
            <p className="mt-1 pr-4 text-sm font-bold text-[#1C1917]">{focusedOffer.title}</p>
            <p className="mt-2 flex items-center gap-1 text-xs text-[#78716C]"><MapPin size={11} /> {focusedOffer.location}</p>
            <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-[#57534E]">{focusedOffer.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}
