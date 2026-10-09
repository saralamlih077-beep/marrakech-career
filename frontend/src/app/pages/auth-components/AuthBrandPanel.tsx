import { Building2, ClipboardList, Search } from 'lucide-react';

export function AuthBrandPanel() {
  return (
    <aside className="auth-brand-panel" aria-label="Bienvenue sur Marrakech Career">
      <div className="auth-brand-content">
        <img className="auth-brand-logo" src="/brand/marrakech-career-serif.svg" alt="Marrakech Career" width={440} height={128} />
        <div className="auth-brand-copy">
          <h1>Des opportunités<br />{' '}près de <span>chez vous</span></h1>
          <div className="auth-brand-accent" aria-hidden="true" />
          <p className="auth-brand-description">Trouvez des offres d’emploi, de stage<br className="auth-desktop-break" /> et d’alternance à Marrakech.</p>
        </div>
        <div className="auth-brand-features">
          <div><span className="auth-feature-icon"><Search size={28} /></span><p><strong>Trouvez</strong>{' '}<br />des offres adaptées</p></div>
          <div><span className="auth-feature-icon"><Building2 size={28} /></span><p><strong>Découvrez</strong>{' '}<br />des entreprises locales</p></div>
          <div><span className="auth-feature-icon"><ClipboardList size={28} /></span><p><strong>Postulez</strong>{' '}<br />simplement et rapidement</p></div>
        </div>
      </div>
    </aside>
  );
}
