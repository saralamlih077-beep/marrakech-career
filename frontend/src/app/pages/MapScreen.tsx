import { useState, useRef, useEffect } from 'react';
import { MapPin, Eye, Heart, X } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DOMAIN_COLORS } from '../constants';
import { companyAddress, recommendationScore } from '../utils';
import { SectorPill, MatchBadge, CompanyStatus } from '../components/shared';
import type { Company } from '../types';
import { useProfile } from '../../hooks/useProfile';

function InteractiveCompanyMap({ companies, onSelect }: { companies: Company[]; onSelect: (id: number) => void }) {
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
        html: `<span style="background:${color}"><span class="company-map-marker-dot"></span></span>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });
      const marker = L.marker([company.latitude, company.longitude], { icon });
      marker.bindTooltip(company.nom, { direction: 'top', offset: [0, -18] });
      marker.on('click', () => onSelect(company.id));
      marker.addTo(markers);
    });
  }, [companies, onSelect]);

  return <div ref={mapElementRef} className="absolute inset-0 z-0" />;
}

export default function MapScreen({ companies, loading, error, favs, onFav, onView }: { companies: Company[]; loading: boolean; error: string | null; favs: Set<number>; onFav: (id: number) => void; onView: (c: Company) => void }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filterDomaine, setFilterDomaine] = useState('All');
  const [minimumMatch, setMinimumMatch] = useState(0);
  const { profile } = useProfile();
  const domaines = ['All', ...Array.from(new Set(companies.map(c => c.domaine).filter((value): value is string => Boolean(value))))];
  const selected = companies.find(c => c.id === selectedId);

  const visible = companies.filter(company =>
    (filterDomaine === 'All' || company.domaine === filterDomaine) &&
    recommendationScore(company, profile) >= minimumMatch,
  );

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Filter sidebar */}
      <div className="w-56 bg-white border-r border-[#EAE5E0] p-5 overflow-y-auto">
        <h3 className="text-sm font-bold text-[#1C1917] mb-4">Filters</h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[#57534E] mb-2 block">Domaine</label>
            <div className="space-y-1">
              {domaines.map(s => (
                <button key={s} onClick={() => setFilterDomaine(s)} className={`w-full text-left text-xs px-3 py-1.5 rounded-lg transition-colors ${filterDomaine === s ? 'bg-[#621E3E]/10 text-[#621E3E] font-semibold' : 'text-[#78716C] hover:bg-[#FBF9F7]'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2"><label className="text-xs font-semibold text-[#57534E]">Match Score</label><span className="text-xs font-bold text-[#621E3E]">{minimumMatch}%+</span></div>
            <input type="range" min={0} max={100} value={minimumMatch} onChange={(event) => setMinimumMatch(Number(event.target.value))} className="w-full accent-[#621E3E]" />
            <div className="flex justify-between text-[10px] text-[#A8A29E] mt-1"><span>0%</span><span>{visible.length} entreprise{visible.length > 1 ? 's' : ''}</span><span>100%</span></div>
          </div>
          <div>
            <label className="text-xs font-semibold text-[#57534E] mb-2 block">Opportunity</label>
            {['Internship', 'CDI', 'CDD', 'Freelance'].map(t => (
              <label key={t} className="flex items-center gap-2 text-xs text-[#78716C] py-1 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#621E3E]" /> {t}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Map area */}
      <div className="map-canvas-frame flex-1 relative overflow-hidden bg-[#E8E4DC]">
        <CompanyStatus loading={loading} error={error} />
        <InteractiveCompanyMap companies={visible} onSelect={setSelectedId} />

        {/* Selected company popup */}
        {selected && (
          <div className="absolute bottom-4 left-4 bg-white rounded-xl border border-[#EAE5E0] shadow-lg p-4 w-64 z-[1000]">
            <button onClick={() => setSelectedId(null)} className="absolute top-2.5 right-2.5 text-[#A8A29E] hover:text-[#1C1917]">
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
            <div className="flex items-center gap-1 text-xs text-[#78716C] mb-3"><MapPin size={10} />{companyAddress(selected)}</div>
            <div className="flex items-center justify-between">
              <MatchBadge pct={recommendationScore(selected, profile)} />
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

        {/* Map legend */}
        <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm rounded-xl border border-[#EAE5E0] shadow-sm p-3">
          <p className="text-[10px] font-bold text-[#57534E] mb-2">Legend</p>
          {Object.entries(DOMAIN_COLORS).slice(0, 4).map(([domaine, color]) => (
            <div key={domaine} className="flex items-center gap-1.5 mb-1">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[10px] text-[#78716C]">{domaine}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
