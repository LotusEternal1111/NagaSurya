// === Naga Surya — UI Layer (nav, sub-pages, CMS) ===
// Mounts into #ui-root. Talks to the Three.js scene via window.NS_navigate / NS_setConfig.

const { useState, useEffect, useRef } = React;

function App() {
  const [config, setConfig] = useState(window.NS_CONFIG || null);
  // The "page" state mirrors what the scene currently displays inside the frame.
  // We update it on the `ns-page` event (fired at the midpoint of the white-pulse
  // bridge), so DOM content swaps under cover of the light wash.
  const [page, setPage] = useState('home');
  const [cmsOpen, setCmsOpen] = useState(false);
  const [ready, setReady] = useState(!!window.NS_CONFIG);

  useEffect(() => {
    const onReady = () => { setConfig(window.NS_CONFIG); setReady(true); };
    const onPage = (e) => { setPage(e.detail.page); };
    if (window.NS_CONFIG) onReady();
    window.addEventListener('ns-ready', onReady);
    window.addEventListener('ns-page', onPage);
    return () => {
      window.removeEventListener('ns-ready', onReady);
      window.removeEventListener('ns-page', onPage);
    };
  }, []);

  const navigate = (pid) => {
    if (pid === page) return;
    if (window.NS_navigate) window.NS_navigate(pid);
    // No setPage here — scene fires ns-page at the pulse midpoint.
  };

  const updateConfig = (next) => {
    setConfig(next);
    if (window.NS_setConfig) window.NS_setConfig(next);
  };

  if (!ready || !config) return null;

  const pageCfg = config.pages[page];
  const isHero = pageCfg && pageCfg.type === 'hero';

  return (
    <>
      <NavBar nav={config.site.nav} active={page} onNavigate={navigate} title={config.site.title} />
      {/* The relief itself owns the homepage content (3D scene). The DOM only
          contributes the persistent tagline and, on sub-pages, typography +
          a small golden symbol. */}
      {isHero ? (
        <>
          <Tagline text={config.site.tagline} />
          <PalmEasterEggZone />
          <SunClickZone />
        </>
      ) : (
        <>
          <SubPage cfg={pageCfg} pageId={page} />
          <Tagline text={config.site.tagline} />
        </>
      )}
      <CMSGear open={cmsOpen} onToggle={() => setCmsOpen(!cmsOpen)} />
      {cmsOpen && (
        <CMSPanel
          config={config}
          page={page}
          onChange={updateConfig}
          onClose={() => setCmsOpen(false)}
        />
      )}
    </>
  );
}

function NavBar({ nav, active, onNavigate, title }) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 720);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 720);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (isMobile) {
    // Mobile layout: title above frame, gold hamburger top-right, slide-down panel.
    return (
      <>
        <div className="m-titlebar">
          <div className="m-title">{title}</div>
          <button
            className={`m-burger ${open ? 'open' : ''}`}
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen(o => !o)}
          >
            <span className="m-burger-bars" aria-hidden="true">
              <span></span><span></span><span></span>
            </span>
          </button>
        </div>
        <div className={`m-nav-panel ${open ? 'open' : ''}`} role="dialog" aria-label="Navigation">
          {nav.map((item, i) => (
            <div
              key={item.id}
              className={`m-nav-item ${active === item.id ? 'active' : ''}`}
              style={{ transitionDelay: open ? `${60 + i * 50}ms` : '0ms' }}
              onClick={() => { setOpen(false); onNavigate(item.id); }}
            >
              {item.label}
            </div>
          ))}
        </div>
        {/* Backdrop closes the panel on tap outside */}
        {open && <div className="m-nav-backdrop" onClick={() => setOpen(false)} />}
      </>
    );
  }

  return (
    <div className="nav-bar">
      {nav.map(item => (
        <div
          key={item.id}
          className={`nav-item ${active === item.id ? 'active' : ''}`}
          onClick={() => onNavigate(item.id)}
        >
          {item.label}
        </div>
      ))}
    </div>
  );
}

function Tagline({ text }) {
  return <div className="tagline">{text}</div>;
}

// Click zone over the palm-tree relief — a wedge in the bottom-center of the frame.
// Triggers a supercharged white-light wash without changing pages.
function PalmEasterEggZone() {
  const onActivate = () => {
    if (window.NS_easterEgg) window.NS_easterEgg();
  };
  return (
    <div
      className="palm-eggzone"
      role="button"
      aria-label="Activate"
      tabIndex={0}
      onClick={onActivate}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate(); } }}
    />
  );
}

// Click zone over the central sun in the relief. Tapping it triggers a page-wide
// radiant pulse (pebble-in-pond) plus an in-scene sun emissive flash.
function SunClickZone() {
  const onActivate = () => {
    if (window.NS_sunRipple) window.NS_sunRipple();
  };
  return (
    <div
      className="sun-clickzone"
      role="button"
      aria-label="Pulse the sun"
      tabIndex={0}
      onClick={onActivate}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate(); } }}
    />
  );
}

// Page-specific gold symbols. Drawn as inline SVG with a polished-gold gradient
// so they share the title's material.
const PAGE_SYMBOLS = {
  about: (
    // Open book with a small solar burst rising off the spine
    <svg viewBox="0 0 120 80" className="page-symbol" aria-hidden="true">
      <defs>
        <linearGradient id="goldA" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff8d4"/>
          <stop offset="0.18" stopColor="#ffe089"/>
          <stop offset="0.40" stopColor="#f4c14a"/>
          <stop offset="0.62" stopColor="#d4a02a"/>
          <stop offset="0.82" stopColor="#a37016"/>
          <stop offset="1" stopColor="#6a430c"/>
        </linearGradient>
      </defs>
      {/* burst */}
      <g stroke="url(#goldA)" strokeWidth="1.4" strokeLinecap="round">
        <line x1="60" y1="6" x2="60" y2="18"/>
        <line x1="50" y1="10" x2="55" y2="20"/>
        <line x1="70" y1="10" x2="65" y2="20"/>
        <line x1="42" y1="18" x2="50" y2="24"/>
        <line x1="78" y1="18" x2="70" y2="24"/>
      </g>
      <circle cx="60" cy="22" r="4" fill="url(#goldA)"/>
      {/* book */}
      <path d="M14 36 C 30 30, 50 30, 60 38 C 70 30, 90 30, 106 36 L 106 70 C 90 64, 70 64, 60 72 C 50 64, 30 64, 14 70 Z"
            fill="none" stroke="url(#goldA)" strokeWidth="2"/>
      <path d="M60 38 L 60 72" stroke="url(#goldA)" strokeWidth="1.5"/>
      <path d="M22 42 C 32 38, 48 38, 56 44" fill="none" stroke="url(#goldA)" strokeWidth="0.9" opacity="0.7"/>
      <path d="M22 50 C 32 46, 48 46, 56 52" fill="none" stroke="url(#goldA)" strokeWidth="0.9" opacity="0.7"/>
      <path d="M64 44 C 72 38, 88 38, 98 42" fill="none" stroke="url(#goldA)" strokeWidth="0.9" opacity="0.7"/>
      <path d="M64 52 C 72 46, 88 46, 98 50" fill="none" stroke="url(#goldA)" strokeWidth="0.9" opacity="0.7"/>
    </svg>
  ),
  services: (
    // Geometric solar-key glyph: a key whose bow is a small sun
    <svg viewBox="0 0 120 80" className="page-symbol" aria-hidden="true">
      <defs>
        <linearGradient id="goldS" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff8d4"/>
          <stop offset="0.18" stopColor="#ffe089"/>
          <stop offset="0.40" stopColor="#f4c14a"/>
          <stop offset="0.62" stopColor="#d4a02a"/>
          <stop offset="0.82" stopColor="#a37016"/>
          <stop offset="1" stopColor="#6a430c"/>
        </linearGradient>
      </defs>
      <circle cx="36" cy="40" r="14" fill="none" stroke="url(#goldS)" strokeWidth="2"/>
      <circle cx="36" cy="40" r="4" fill="url(#goldS)"/>
      <g stroke="url(#goldS)" strokeWidth="1.4" strokeLinecap="round">
        <line x1="36" y1="20" x2="36" y2="14"/>
        <line x1="36" y1="60" x2="36" y2="66"/>
        <line x1="16" y1="40" x2="22" y2="40"/>
        <line x1="50" y1="40" x2="56" y2="40"/>
        <line x1="22" y1="26" x2="26" y2="30"/>
        <line x1="46" y1="26" x2="50" y2="22"/>
        <line x1="22" y1="54" x2="26" y2="50"/>
        <line x1="46" y1="54" x2="50" y2="58"/>
      </g>
      {/* shaft */}
      <rect x="50" y="38" width="50" height="4" fill="url(#goldS)"/>
      <rect x="92" y="42" width="4" height="10" fill="url(#goldS)"/>
      <rect x="84" y="42" width="4" height="6" fill="url(#goldS)"/>
    </svg>
  ),
  contact: (
    // Sealed envelope with a small wax-seal sun
    <svg viewBox="0 0 120 80" className="page-symbol" aria-hidden="true">
      <defs>
        <linearGradient id="goldC" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff8d4"/>
          <stop offset="0.18" stopColor="#ffe089"/>
          <stop offset="0.40" stopColor="#f4c14a"/>
          <stop offset="0.62" stopColor="#d4a02a"/>
          <stop offset="0.82" stopColor="#a37016"/>
          <stop offset="1" stopColor="#6a430c"/>
        </linearGradient>
      </defs>
      <rect x="20" y="22" width="80" height="46" fill="none" stroke="url(#goldC)" strokeWidth="2"/>
      <path d="M20 22 L 60 50 L 100 22" fill="none" stroke="url(#goldC)" strokeWidth="1.5"/>
      <path d="M20 68 L 50 46" fill="none" stroke="url(#goldC)" strokeWidth="1.2" opacity="0.8"/>
      <path d="M100 68 L 70 46" fill="none" stroke="url(#goldC)" strokeWidth="1.2" opacity="0.8"/>
      {/* seal */}
      <circle cx="60" cy="56" r="9" fill="url(#goldC)"/>
      <g stroke="#3a2408" strokeWidth="0.9" strokeLinecap="round" opacity="0.8">
        <line x1="60" y1="50" x2="60" y2="48"/>
        <line x1="60" y1="62" x2="60" y2="64"/>
        <line x1="54" y1="56" x2="52" y2="56"/>
        <line x1="66" y1="56" x2="68" y2="56"/>
        <line x1="55" y1="51" x2="53" y2="49"/>
        <line x1="65" y1="51" x2="67" y2="49"/>
        <line x1="55" y1="61" x2="53" y2="63"/>
        <line x1="65" y1="61" x2="67" y2="63"/>
      </g>
    </svg>
  ),
};

function SubPage({ cfg, pageId }) {
  const symbol = PAGE_SYMBOLS[pageId];
  return (
    <div className="sub-page">
      <div className="sub-content">
        {symbol && <div className="sub-symbol">{symbol}</div>}
        {cfg.subtitle && <div className="sub-eyebrow">{cfg.subtitle}</div>}
        <h1 className="sub-title">{cfg.title}</h1>
        <div className="sub-body">{cfg.body}</div>
        {(cfg.email || cfg.phone) && (
          <div className="sub-meta">
            {cfg.email && <a href={`mailto:${cfg.email}`}>{cfg.email}</a>}
            {cfg.phone && <a href={`tel:${cfg.phone.replace(/\s+/g,'')}`}>{cfg.phone}</a>}
          </div>
        )}
      </div>
    </div>
  );
}

function CMSGear({ open, onToggle }) {
  return (
    <div className="cms-gear" onClick={onToggle} title={open ? 'Close editor' : 'Open content editor'}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    </div>
  );
}

function CMSPanel({ config, page, onChange, onClose }) {
  const [tab, setTab] = useState('page');
  const pageCfg = config.pages[page];

  const update = (path, value) => {
    const next = JSON.parse(JSON.stringify(config));
    let obj = next;
    const parts = path.split('.');
    for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
    obj[parts[parts.length - 1]] = value;
    onChange(next);
  };

  const downloadConfig = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'template.config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetConfig = () => {
    if (!confirm('Reset content to defaults? Your local edits will be lost.')) return;
    localStorage.removeItem('ns_config');
    location.reload();
  };

  return (
    <div className="cms-panel" onClick={e => e.stopPropagation()}>
      <h3>Content Editor</h3>

      <div className="cms-tabs">
        <div className={`cms-tab ${tab === 'page' ? 'active' : ''}`} onClick={() => setTab('page')}>Page · {page}</div>
        <div className={`cms-tab ${tab === 'site' ? 'active' : ''}`} onClick={() => setTab('site')}>Site</div>
        <div className={`cms-tab ${tab === 'media' ? 'active' : ''}`} onClick={() => setTab('media')}>Media</div>
        <div className={`cms-tab ${tab === 'tweaks' ? 'active' : ''}`} onClick={() => setTab('tweaks')}>Tweaks</div>
      </div>

      {tab === 'page' && (
        <div>
          {pageCfg.type === 'hero' ? (
            <>
              <h4>Hero · Tagline lives in Site tab</h4>
              <div className="cms-row">
                <label>Show Marble</label>
                <select value={pageCfg.showMarble ? 'yes' : 'no'} onChange={e => update(`pages.${page}.showMarble`, e.target.value === 'yes')}>
                  <option value="yes">yes</option><option value="no">no</option>
                </select>
              </div>
            </>
          ) : (
            <>
              <h4>Sub-page Content</h4>
              <div className="cms-row">
                <label>Eyebrow</label>
                <input value={pageCfg.subtitle || ''} onChange={e => update(`pages.${page}.subtitle`, e.target.value)} />
              </div>
              <div className="cms-row">
                <label>Title</label>
                <input value={pageCfg.title || ''} onChange={e => update(`pages.${page}.title`, e.target.value)} />
              </div>
              <div className="cms-row">
                <label>Body</label>
                <textarea value={pageCfg.body || ''} onChange={e => update(`pages.${page}.body`, e.target.value)} />
              </div>
              {page === 'contact' && (
                <>
                  <div className="cms-row">
                    <label>Email</label>
                    <input value={pageCfg.email || ''} onChange={e => update(`pages.${page}.email`, e.target.value)} />
                  </div>
                  <div className="cms-row">
                    <label>Phone</label>
                    <input value={pageCfg.phone || ''} onChange={e => update(`pages.${page}.phone`, e.target.value)} />
                  </div>
                </>
              )}
              <h4>Scene</h4>
              <div className="cms-row">
                <label>Dragon Position</label>
                <select value={pageCfg.dragonPos || 'left'} onChange={e => update(`pages.${page}.dragonPos`, e.target.value)}>
                  <option value="left">left</option>
                  <option value="coiled">coiled</option>
                  <option value="peeking">peeking (right)</option>
                </select>
              </div>
              <div className="cms-row">
                <label>Dragon Opacity: {(pageCfg.dragonOpacity || 0).toFixed(2)}</label>
                <input type="range" min="0" max="0.6" step="0.02" value={pageCfg.dragonOpacity || 0.18} onChange={e => update(`pages.${page}.dragonOpacity`, parseFloat(e.target.value))} />
              </div>
              <div className="cms-row">
                <label>Light Tilt: {pageCfg.lightTilt || 0}°</label>
                <input type="range" min="-30" max="30" step="2" value={pageCfg.lightTilt || 0} onChange={e => update(`pages.${page}.lightTilt`, parseInt(e.target.value))} />
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'site' && (
        <div>
          <h4>Site</h4>
          <div className="cms-row">
            <label>Site Title</label>
            <input value={config.site.title} onChange={e => update('site.title', e.target.value)} />
          </div>
          <div className="cms-row">
            <label>Tagline (Home)</label>
            <input value={config.site.tagline} onChange={e => update('site.tagline', e.target.value)} />
          </div>
          <h4>Nav Labels</h4>
          {config.site.nav.map((n, i) => (
            <div className="cms-row" key={n.id}>
              <label>{n.id}</label>
              <input value={n.label} onChange={e => {
                const nav = config.site.nav.map((x, j) => j === i ? { ...x, label: e.target.value } : x);
                update('site.nav', nav);
              }} />
            </div>
          ))}
        </div>
      )}

      {tab === 'media' && (
        <div>
          <h4>Hero Image (Home)</h4>
          <div className="cms-hint">To swap the hero, replace <code>assets/hero.png</code> in the project, then re-run the slicer (run_script in chat). Live upload preview below uses the file directly without re-slicing.</div>
          <div className="cms-row">
            <label>Accent Color</label>
            <input type="color" value={config.media.accent} onChange={e => update('media.accent', e.target.value)} />
          </div>
          <h4>Layer Sources (advanced)</h4>
          {['heroPlate','heroNormal','sunMask','dragonLeft','dragonRight','title','foliage'].map(k => (
            <div className="cms-row" key={k}>
              <label>{k}</label>
              <input value={config.media[k] || ''} onChange={e => update(`media.${k}`, e.target.value)} />
            </div>
          ))}
        </div>
      )}

      {tab === 'tweaks' && (
        <div>
          <h4>Motion</h4>
          <div className="cms-row">
            <label>Parallax Intensity: {config.tweaks.parallax}</label>
            <input type="range" min="0" max="60" step="5" value={config.tweaks.parallax} onChange={e => update('tweaks.parallax', parseInt(e.target.value))} />
          </div>
          <div className="cms-row">
            <label>Light Drift: {config.tweaks.lightDrift}</label>
            <input type="range" min="0" max="60" step="5" value={config.tweaks.lightDrift} onChange={e => update('tweaks.lightDrift', parseInt(e.target.value))} />
          </div>
          <h4>Magic Toggles</h4>
          {[
            ['dragonHeadFollow','Dragon head follow cursor'],
            ['sunPulse','Sun pulse'],
            ['navGlow','Nav hover glow'],
            ['panelShimmer','Solar panel shimmer'],
            ['veinFlow','Marble vein flow'],
            ['letterSettle','Letter settle'],
            ['particleMotes','Ambient motes'],
            ['globeRotate','Globe rotate'],
          ].map(([k, label]) => (
            <div className="cms-row" key={k} style={{flexDirection:'row', alignItems:'center', gap:8}}>
              <input type="checkbox" checked={!!config.tweaks[k]} onChange={e => update(`tweaks.${k}`, e.target.checked)} style={{width:'auto'}}/>
              <label style={{textTransform:'none', letterSpacing:0, fontFamily:'Cormorant Garamond, serif', fontSize:14}}>{label}</label>
            </div>
          ))}
        </div>
      )}

      <div className="cms-actions">
        <button className="cms-btn" onClick={downloadConfig}>Download JSON</button>
        <button className="cms-btn danger" onClick={resetConfig}>Reset</button>
      </div>
      <div className="cms-hint">Edits save to local preview. <strong>Download JSON</strong> and replace <code>template.config.json</code> in the project to persist.</div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('ui-root')).render(<App />);
