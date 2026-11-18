/* =====================================================================
   UK Scaleup Cluster Map — controller
   Independent filters (Sectors / Regions / Investors), full-company base,
   canvas dot layer, cluster hulls, company popups, investor system,
   live detail panel.
   ===================================================================== */
'use strict';

/* ---------- Sector palette (exact data labels) ---------- */
const SECTOR_COLORS = {
  'Professional and Business Service': '#2F6DB5',
  'Wholesale and retail':              '#E8843C',
  'Construction':                      '#B0894B',
  'Creative Industries':               '#C64B8C',
  'Digital and Technologies':          '#17A2B8',
  'Financial Services':                '#4C8C4A',
  'Education':                         '#8E6FCF',
  'Transportation and storage':        '#6C8693',
  'Clean Energy Industries':           '#2FB380',
  'Advanced Manufacturing':            '#D64550',
  'Life Sciences':                     '#7BAF3A',
  'Defence':                           '#566573'
};
/* Size-filter stops. Round numbers the eye can read rather than a linear sweep:
   turnover runs from nothing to £34bn and headcount to 159,684, so a plain
   slider would spend almost all of its travel on the smallest companies. Index
   0 is "no lower bound" and the last index is "no upper bound", so a fresh
   slider filters nothing. */
const TURN_STOPS = [0, 1e6, 5e6, 1e7, 2.5e7, 5e7, 1e8, 2.5e8, 5e8, 1e9, 5e9, 1e10, Infinity];
const EMP_STOPS  = [0, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, Infinity];

/* Growth stops. Open at both ends: a handful of companies sit above 1,000% a
   year and a floor of -Infinity means "no lower bound". */
const GROWTH_STOPS = [-Infinity, -25, 0, 10, 20, 30, 50, 100, 200, Infinity];

const NOISE_COLOR = '#aab6c0';

/* One glyph per sector for the rail chips and the map legend. Stroke-only on a
   16px box, drawn in the sector's own colour, so a chip reads at a glance
   instead of asking you to learn twelve dots. */
const SECTOR_ICONS = {
  // A cog loses its teeth at 14px and reads as a sunburst, so: a factory.
  'Advanced Manufacturing':
    '<path d="M1.9 13.6V7.7l4 2.3V7.7l4 2.3V3.3h4.2v10.3z"/><path d="M1.9 13.6h12.2"/>',
  'Clean Energy Industries':
    '<path d="M2.8 13.2C2.8 7.9 7 3.4 13.2 2.8c.3 6.1-3.6 10.4-10.4 10.4z"/>'+
    '<path d="M3.4 12.6c1.9-3.1 4.4-5.3 7.6-6.7"/>',
  'Construction':
    '<path d="M1.9 11.6h12.2"/><path d="M4 11.6V8.1a4 4 0 0 1 8 0v3.5"/>'+
    '<path d="M6.6 4.7V2.9h2.8v1.8"/>',
  'Creative Industries':
    '<path d="M8 14A6 6 0 1 1 14 8c0 1.8-1.7 2.1-2.7 2.1h-1.2a1.4 1.4 0 0 0-1 2.4'+
    'c.3.5 0 1.2-.6 1.3A6 6 0 0 1 8 14z"/><circle cx="5.4" cy="7.1" r=".85"/>'+
    '<circle cx="8" cy="5.1" r=".85"/><circle cx="10.7" cy="7.1" r=".85"/>',
  'Defence':
    '<path d="M8 1.8 13.1 4v4.1c0 3-2.1 5.4-5.1 6.1-3-.7-5.1-3.1-5.1-6.1V4z"/>',
  'Digital and Technologies':
    '<rect x="5" y="5" width="6" height="6" rx="1.1"/>'+
    '<path d="M6.6 2.4v2.4M9.4 2.4v2.4M6.6 11.2v2.4M9.4 11.2v2.4'+
    'M2.4 6.6h2.4M2.4 9.4h2.4M11.2 6.6h2.4M11.2 9.4h2.4"/>',
  'Education':
    '<path d="M8 2.6 1.6 5.9 8 9.2l6.4-3.3z"/>'+
    '<path d="M4.3 7.5v3.2c0 1 1.7 1.9 3.7 1.9s3.7-.9 3.7-1.9V7.5"/>',
  'Financial Services':
    '<circle cx="8" cy="8" r="6.1"/>'+
    '<path d="M6 11.3h4.1M5.9 8.4h2.8M9.6 5.5A1.9 1.9 0 0 0 6.5 7v2.2c0 1-.3 1.5-.8 2.1"/>',
  'Life Sciences':
    '<path d="M6.4 2.2v4L3.1 11.5c-.6 1 .1 2.2 1.3 2.2h7.2c1.2 0 1.9-1.2 1.3-2.2L9.6 6.2v-4"/>'+
    '<path d="M5.5 2.2h5"/><path d="M4.6 9.7h6.8"/>',
  'Professional and Business Service':
    '<rect x="1.9" y="5.2" width="12.2" height="7.7" rx="1.2"/>'+
    '<path d="M6 5.2V4.1a1.1 1.1 0 0 1 1.1-1.1h1.8A1.1 1.1 0 0 1 10 4.1v1.1"/>'+
    '<path d="M1.9 8.6h12.2"/>',
  'Transportation and storage':
    '<path d="M1.8 4.5h7.4v6.3H1.8z"/><path d="M9.2 7.1h2.5l2.5 2.2v1.5H9.2z"/>'+
    '<circle cx="4.6" cy="12.1" r="1.3"/><circle cx="11.5" cy="12.1" r="1.3"/>',
  'Wholesale and retail':
    '<path d="M3.2 5.3h9.6l-.8 8.1a1 1 0 0 1-1 .9H5a1 1 0 0 1-1-.9z"/>'+
    '<path d="M6 7.1V4.7a2 2 0 0 1 4 0v2.4"/>'
};
function sectorIcon(sec, cls){
  const g=SECTOR_ICONS[sec];
  const col=SECTOR_COLORS[sec]||NOISE_COLOR;
  if(!g) return '<span class="'+(cls||'sicon')+'-dot" style="background:'+col+'"></span>';
  return '<svg class="'+(cls||'sicon')+'" viewBox="0 0 16 16" aria-hidden="true" style="color:'+col+
         '" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" '+
         'stroke-linejoin="round">'+g+'</svg>';
}

const BASE_DOT = '#7d97ab';   /* light uniform colour for the base layer (no sector selected) */
/* Read from CSS so the dots, the rail swatch and the legend key share one value. */
const FEM_DOT = (getComputedStyle(document.documentElement).getPropertyValue('--fem')||'').trim() || '#E0479E';

/* ---------- Final Area -> ITL1 region ---------- */
const FA_TO_ITL1 = {
  'Buckinghamshire':'South East (England)','Cambridgeshire and Peterborough':'East of England',
  'Cheshire and Warrington':'North West (England)','Coast to Capital':'South East (England)',
  'Cornwall and Isles of Scilly':'South West (England)','Cumbria':'North West (England)',
  'Devon':'South West (England)','Dorset':'South West (England)','East Midlands CCA':'East Midlands (England)',
  'East Sussex':'South East (England)','Essex':'East of England','Gloucestershire':'South West (England)',
  'Greater Lincolnshire':'East Midlands (England)','Greater Manchester CA':'North West (England)',
  'Hampshire area':'South East (England)','Hertfordshire':'East of England',
  'Hull and East Yorkshire':'Yorkshire and The Humber','Kent':'South East (England)',
  'Lancashire':'North West (England)','Leicester and Leicestershire':'East Midlands (England)',
  'Liverpool City Region CA':'North West (England)','London':'London','New Anglia':'East of England',
  'North East CA':'North East (England)','Northern Ireland':'Northern Ireland','Oxfordshire':'South East (England)',
  'Scotland':'Scotland','Wales':'Wales','Solent':'South East (England)','Somerset':'South West (England)',
  'South East Midlands':'East Midlands (England)','South Yorkshire CA':'Yorkshire and The Humber',
  'Stoke-on-Trent and Staffordshire':'West Midlands (England)','Surrey':'South East (England)',
  'Swindon and Wiltshire':'South West (England)','Tees Valley CA':'North East (England)',
  'Thames Valley Berkshire':'South East (England)','The Marches':'West Midlands (England)',
  'Warwickshire':'West Midlands (England)','West Midlands CA':'West Midlands (England)',
  'West of England CA':'South West (England)','West Yorkshire CA':'Yorkshire and The Humber',
  'Worcestershire':'West Midlands (England)','York and North Yorkshire CA':'Yorkshire and The Humber'
};
const ITL1_ORDER = ['London','South East (England)','North West (England)','East of England','West Midlands (England)',
  'South West (England)','Scotland','Yorkshire and The Humber','East Midlands (England)','North East (England)',
  'Wales','Northern Ireland'];
const regionShort = n => n.replace(' (England)','');

/* =================================================================== SCOPE
   A region build (tools/make_region_build.py) ships a data file holding one
   region and nothing else -- the British Business Bank copy carries the North
   East alone. meta.scope is how that file announces itself, and everything
   below keys off S.scope being set. Nothing here hides data: the data is
   already absent. What it does is stop the interface claiming a national view
   it no longer has -- a region picker with one entry, a regions-comparison tab
   with one bar, and figures captioned "of the UK" that are nothing of the
   kind. The national build sets no scope and is untouched by all of it. */
let SCOPE_REGION = null, SCOPE_LABEL = null;
function scoped(){ return !!SCOPE_REGION; }
/* What to call the universe in a caption: "the UK", or "the North East". */
function universeName(){ return scoped() ? 'the '+SCOPE_LABEL : 'the UK'; }
let scopeLayer = null;
/* The region sits under a permanent tint rather than being selected as a
   filter: selecting it would put a chip in the active-filter bar for a filter
   that excludes nothing, and would zoom the map to the region on load. The
   brief was that the UK map still opens as it does now, with the region
   highlighted on it. */
function drawScopeRegion(){
  if(!scoped() || !S.regionGeo) return;
  if(scopeLayer){ map.removeLayer(scopeLayer); scopeLayer=null; }
  const feat=S.regionGeo.features.filter(f=>f.properties.ITL121NM===SCOPE_REGION);
  if(!feat.length) return;
  const accent=getComputedStyle(document.documentElement).getPropertyValue('--accent-ink').trim()||'#0a7a67';
  scopeLayer=L.geoJSON({type:'FeatureCollection',features:feat},{interactive:false,
    style:()=>({color:accent,weight:1.8,opacity:.95,fill:true,fillColor:accent,fillOpacity:.07})}).addTo(map);
  scopeLayer.bringToBack();
}
/* Strip the parts of the interface that only mean something nationally. */
function applyScope(){
  if(!scoped()) return;
  document.documentElement.setAttribute('data-scope','region');
  // No scope badge: the product name right above it already reads
   // "North East Scaleup Map", so the chip only repeated it.
  const p=document.querySelector('.brand .product');
  if(p) p.textContent=SCOPE_LABEL+' Scaleup Map';
  document.title=SCOPE_LABEL+' Scaleup Map | Scaleup Institute';
  // The regions tab compares twelve regions; there is one.
  const rb=document.querySelector('.dashtabs button[data-tab="regions"]');
  if(rb) rb.hidden=true;
  // Hidden at the client's request. The tab is NOT empty in a region build --
  // the North East one carries all 27 of its seats, 517 scaleups and their MPs
  // -- so this is a presentation choice, and deleting these two lines restores
  // it exactly as it was.
  const cb=document.querySelector('.dashtabs button[data-tab="constituencies"]');
  if(cb) cb.hidden=true;
  // The region rail section would offer a single choice that filters nothing.
  const rs=document.querySelector('.rail-sec[data-group="regions"]');
  if(rs) rs.hidden=true;
  // Dashboard "region" dropdowns, same reason.
  // secRegionWrap is the Sectors tab's multi-region picker (it replaced a
  // <select id="secRegionFilter">); invRegionFilter is still a plain dropdown.
  // Both offer one choice in a region build, so neither earns its space.
  ['secRegionWrap','invRegionFilter'].forEach(id=>{ const el=$(id); if(el) el.hidden=true; });
  // Charts that break the population down BY REGION draw a single bar when the
  // file holds one region. The Regions tab and the region filter are already
  // gone for the same reason; these three were left behind.
  ['ovRegionBar','invByRegion','invAllByRegion'].forEach(id=>{
    const c=$(id), card=c&&c.closest('.chart-card'); if(card) card.hidden=true; });
  // Headings written for a national file. Rewritten rather than removed: a
  // reader needs to know which population every figure on the page is drawn
  // from, and "the UK's scaleups" on a 521-company North East file is wrong.
  const poss=SCOPE_LABEL+"'s";
  [['ovSub',    'The '+poss+' high-growth company population at a glance.'],
   ['secSub',   'How the '+poss+' scaleup population breaks down by sector.'],
   ['invSub',   'Equity raised, all funding types combined, and who is backing the '+poss+' scaleups.'],
   ['helpIntro','Explore where the '+poss+' high-growth companies, known as scaleups, cluster, who funds them, and how they break down by sector. '+
                'This is the '+SCOPE_LABEL+' edition: it holds that region only. Use the tabs at the top; the Map tab is interactive.']
  ].forEach(([id,txt])=>{ const el=$(id); if(el) el.textContent=txt; });
  drawScopeRegion();
}


/* ---------- Country -> ISO2 (for flag icons) ---------- */
const ISO = {'united kingdom':'gb','united states':'us','united states of america':'us','ireland':'ie','france':'fr',
  'germany':'de','spain':'es','italy':'it','netherlands':'nl','belgium':'be','luxembourg':'lu','switzerland':'ch',
  'sweden':'se','norway':'no','denmark':'dk','finland':'fi','iceland':'is','canada':'ca','australia':'au',
  'new zealand':'nz','japan':'jp','china':'cn','hong kong':'hk','singapore':'sg','south korea':'kr','korea':'kr',
  'india':'in','israel':'il','united arab emirates':'ae','uae':'ae','saudi arabia':'sa','qatar':'qa','kuwait':'kw',
  'oman':'om','south africa':'za','brazil':'br','mexico':'mx','argentina':'ar','chile':'cl','portugal':'pt',
  'austria':'at','poland':'pl','czech republic':'cz','czechia':'cz','hungary':'hu','greece':'gr','turkey':'tr',
  'russia':'ru','estonia':'ee','latvia':'lv','lithuania':'lt','romania':'ro','bulgaria':'bg','croatia':'hr',
  'slovenia':'si','slovakia':'sk','ukraine':'ua','taiwan':'tw','malaysia':'my','thailand':'th','indonesia':'id',
  'philippines':'ph','vietnam':'vn','cayman islands':'ky','jersey':'je','guernsey':'gg','isle of man':'im',
  'bermuda':'bm','british virgin islands':'vg','malta':'mt','cyprus':'cy','liechtenstein':'li','monaco':'mc',
  'mauritius':'mu','egypt':'eg','barbados':'bb','puerto rico':'pr'};
const isoFor = c => ISO[String(c||'').trim().toLowerCase()] || '';

/* ---------- Investor categories ---------- */
const CATS = {
  central_gov:  {label:'Central Government',            list:true, inv:v=>v.type==='Central Government'},
  devolved_gov: {label:'Devolved Government',           list:true, inv:v=>v.type==='Devolved Government'},
  regions:      {label:'Regions: Mayoral & Council',    list:true, inv:v=>v.type==='Regions: Mayoral and Council Authorities'},
  international: {label:'International investors',        list:true, inv:v=>v.country && v.country!=='United Kingdom'},
  top_number:   {label:'Top 15 by companies backed',    list:true, top:'number'},
  /* These three select companies by a FUNDING FLAG, not by equity investor, so
     they are not subsets of "Show all investor-backed". An Innovate UK grant is
     not equity: 722 of the 945 Innovate UK companies have no equity investor at
     all, which is why picking Innovate UK can return MORE companies than
     "all investor-backed" for the same sector (Advanced Manufacturing: 259 vs
     203, overlapping on just 77). The labels say so explicitly. */
  bbb:          {label:'British Business Bank',          comp:'bbb',  flag:true},
  iuk:          {label:'Innovate UK grant',               comp:'iuk',  flag:true},
  bbb_iuk_both: {label:'Both',                            comp:'both', flag:true},
  uk_pension:   {label:'UK pension / institutional',     list:true, inv:v=>v.pension==='uk_pension'},
  intl_pension: {label:'International pension / SWF',     list:true, inv:v=>v.pension==='intl_pension'||v.pension==='swf'},
  top_value:    {label:'Top 15 by value',                dev:true},
  nwf:          {label:'NWF-backed',                     dev:true},
  ukef:         {label:'UKEF-backed',                    dev:true}
};

/* ---------- State ---------- */
const S = {
  all: [], sectors: [], enriched: {}, invNames: [],
  flags: { bbb:new Set(), iuk:new Set() },
  regionGeo: null, eco: { universities:[], infrastructure:[], support:[] },
  selSectors: new Set(), selRegions: new Set(), selInvestors: new Set(),
  invOrigin:false, origin:{}, investorsRaw:[],
  // Women-led filter: narrows to c.women and paints the dots pink. The flag is
  // WHO LEADS the company (Datacity's GenderLedCategory), not who founded it —
  // see tools/merge_datacity.py. The UI says "Women-led" for that reason.
  femOnly:false,
  /* Size filters, held as INDEXES into TURN_STOPS / EMP_STOPS. The high ends are
     set to the last stop at boot, so nothing is filtered until a handle moves. */
  /* Size / growth bounds, held as REAL VALUES rather than slider positions, so
     a typed figure is not rounded to the nearest stop. The stops only decide
     where the handles land. An open end is the first stop, or Infinity. */
  turnMin:TURN_STOPS[0], turnMax:Infinity,
  empMin:EMP_STOPS[0],   empMax:Infinity,
  growMin:-Infinity,     growMax:Infinity,
  /* "Any funding received" — the broad version of the investor rail. True when a
     company raised equity, took a grant, or has a named investor. */
  fundAny:false,
  invTypes: new Set(), invAll:false, invCats: new Set(), _invSet: null,
  primes:{}, procurement:{}, byNum:{}, secsByNum:{}, primesOn:false, procOn:false, selectedProc:null,
  // procListOpen is purely the list panel's collapsed state — procOn is what
  // controls the markers. Collapsing the list must not remove them from the map.
  procListOpen:true,
  procBuyerType:'', procMinValue:0, procSme:false, procFramework:false,
  displayMode: 'both', view: 'clusters', tab:'map', rendered: [], hulls: [], markersShown: false,
  focus:{}, compareMode:'regions', compareRegions:new Set(), compareSectors:new Set(),
  conData:null, conMode:'off', conParty:'', conQuery:'', selCon:null, selConIdx:-1,
  ccMode:'seats', ccSeats:new Set(), ccParties:new Set(),
  detailOpen:false, detailUserClosed:false
};

/* ---------- Helpers ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s==null?'':s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function normNum(v){ if(v==null) return ''; let x=String(v).trim().toUpperCase(); return /^\d+$/.test(x)?x.padStart(8,'0'):x; }
function num(v){ if(v==null) return 0; let n=parseFloat(String(v).replace(/[^0-9.\-]/g,'')); return isNaN(n)?0:n; }
function money(v){ if(v>=1e9) return '£'+(v/1e9).toFixed(1)+'B'; if(v>=1e6) return '£'+(v/1e6).toFixed(1)+'M'; if(v>=1e3) return '£'+(v/1e3).toFixed(0)+'K'; return '£'+Math.round(v); }
const nf = n => Math.round(n).toLocaleString('en-GB');
function compact(n){ n=n||0; if(n>=1e9) return (n/1e9).toFixed(1)+'B'; if(n>=1e6) return (n/1e6).toFixed(1)+'M'; if(n>=1e3) return (n/1e3).toFixed(1)+'K'; return String(Math.round(n)); }

/* ---------- Map ---------- */
const ESRI='https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/';
const ESRI_ATTR='Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors';
const lightTiles = L.layerGroup([
  L.tileLayer(ESRI+'World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',{attribution:ESRI_ATTR,noWrap:true,maxZoom:16}),
  L.tileLayer(ESRI+'World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',{noWrap:true,maxZoom:16})
]);
const darkTiles = L.layerGroup([
  L.tileLayer(ESRI+'World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',{attribution:ESRI_ATTR,noWrap:true,maxZoom:16}),
  L.tileLayer(ESRI+'World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',{noWrap:true,maxZoom:16})
]);
const UK_BOUNDS = L.latLngBounds(L.latLng(49.8,-8.7), L.latLng(60.9,1.9));
const map = L.map('map',{minZoom:5,maxZoom:16,zoomControl:true,preferCanvas:true}).fitBounds(UK_BOUNDS);
/* Sandboxed embeds (a published Artifact, say) block external tile images. When
   the host sets window.NO_BASEMAP_TILES we skip tiles and instead paint the land
   mass from our own ITL1 boundaries, so the map still reads as the UK. */
const NO_TILES = (typeof window!=='undefined' && window.NO_BASEMAP_TILES===true);
let landLayer=null;
/* Redrawn on a theme change, because the tint is mixed from --accent-ink. */
function drawLandLayer(){
  if(!NO_TILES || !S.regionGeo) return;
  if(landLayer){ map.removeLayer(landLayer); landLayer=null; }
  const dark=document.documentElement.getAttribute('data-theme')==='dark';
  landLayer=L.geoJSON(S.regionGeo,{interactive:false,style:{
    fillColor:dark?'#16293a':'#e7edf2', fillOpacity:1,
    color:dark?'#243b4e':'#d2dce3', weight:1 }}).addTo(map);
  landLayer.bringToBack();
}
if(!NO_TILES) (document.documentElement.getAttribute('data-theme')==='dark' ? darkTiles : lightTiles).addTo(map);

let hullLayer = L.layerGroup().addTo(map);
let regionLayer = null;
let ecoLayer = L.layerGroup().addTo(map);
let invMarkerLayer = L.layerGroup().addTo(map);
/* Above this many investor pins the map falls back to dots. Raised from 1500
   when the Datacity investor links took "all investor-backed" from 1,194 to
   2,179 companies — at 1500 the national view silently stopped drawing pins
   altogether. Measured at 2,179 markers: 6ms to build, 111ms to add to the
   map, 13ms to reflow on pan, so the ceiling is comfortable. */
const MARKER_CAP = 2600;

/* investor marker icons */
const mkIcon = u => L.icon({iconUrl:u, iconSize:[30,30], iconAnchor:[15,30], popupAnchor:[0,-28]});
const INV_UK='#0e9f86', INV_BBB='#E8843C', INV_IUK='#8E6FCF';
/* Investor pins use the same marker artwork as the procurement/prime pins,
   recoloured to the investor palette above (and split BBB|IUK for "both") by
   tools/make_investor_markers.py. That script also lays each pin out on the
   same 512x512 canvas geometry as 'procurement marker.png', so they go through
   the same mkIcon() and render at exactly the same size — the earlier
   hand-built SVG pins filled a 28x38 box and came out ~48% larger than every
   other marker on the map. */
const INV_PINS={ uk:'data/inv_uk_marker.png', bbb:'data/inv_bbb_marker.png',
                 iuk:'data/inv_iuk_marker.png', dual:'data/inv_dual_marker.png',
                 intl:'data/inv_intl_marker.png', mixed:'data/inv_mixed_marker.png' };
const ukPinIcon=mkIcon(INV_PINS.uk), bbbIcon=mkIcon(INV_PINS.bbb),
      iukIcon=mkIcon(INV_PINS.iuk), dualIcon=mkIcon(INV_PINS.dual),
      intlIcon=mkIcon(INV_PINS.intl), mixedIcon=mkIcon(INV_PINS.mixed);
/* Where a company's backing comes from: 'uk', 'intl', 'mixed', or null when no
   backer has a recorded country. 470 of the 2,184 backed companies fall in that
   last bucket — they are the Datacity-sourced investors, whose export carries
   names but no country — so they keep the plain UK-investor pin rather than
   being asserted to be one thing or the other. */
function originOf(num){ return S.origin[num] || null; }
function buildOrigin(){
  S.origin={};
  const byComp={};
  (S.investorsRaw||[]).forEach(o=>{
    const ctry=(o.country||'').trim();
    (o.companies||[]).forEach(id=>{ (byComp[normNum(id)]||(byComp[normNum(id)]=new Set())).add(ctry); });
  });
  Object.keys(byComp).forEach(n=>{
    const known=[...byComp[n]].filter(Boolean);
    if(!known.length) return;
    const uk=known.includes('United Kingdom'), other=known.some(c=>c!=='United Kingdom');
    S.origin[n] = (uk&&other) ? 'mixed' : (uk ? 'uk' : 'intl');
  });
}
function iconFor(c){
  if(S.invOrigin){
    const o=originOf(c.num);
    return o==='intl' ? intlIcon : (o==='mixed' ? mixedIcon : ukPinIcon);
  }
  const b=S.flags.bbb.has(c.num), i=S.flags.iuk.has(c.num);
  return (b&&i)?dualIcon:(b?bbbIcon:(i?iukIcon:ukPinIcon));
}
function pinImg(src){ return '<img src="'+src+'" alt="" />'; }
/* The primes / procurement / investor keys live in one shared box. Each group is
   toggled by its own code path, so this reconciles the wrapper afterwards: show it
   only if some group is visible, and strip the divider off the first visible one. */
function syncMarkerLegend(){
  const box=$('marker-legend'); if(!box) return;
  const groups=[...box.querySelectorAll('.pl-group')];
  const shown=groups.filter(g=>g.style.display!=='none');
  groups.forEach(g=>g.classList.remove('pl-first'));
  if(shown.length) shown[0].classList.add('pl-first');
  box.style.display = shown.length ? '' : 'none';
}
function updateInvestorLegend(show){ const box=$('investor-legend'); if(!box) return; box.style.display=show?'':'none'; syncMarkerLegend(); if(!show) return;
  if(S.invOrigin){
    $('ilUK').innerHTML=pinImg(INV_PINS.uk)+' UK investors only';
    $('ilBBB').innerHTML=pinImg(INV_PINS.intl)+' International investors';
    $('ilIUK').innerHTML=pinImg(INV_PINS.mixed)+' UK + international';
    $('ilDual').innerHTML='<span class="pl-note">Shown only where an investor country is recorded.</span>'; return;
  }
  // Under "any funding" the fourth pin is everyone funded who carries neither
  // public flag -- calling that "UK investor" would overstate what is known.
  $('ilUK').innerHTML=pinImg(INV_PINS.uk)+
    (S.fundAny && !investorActive() ? ' Equity or other funding' : ' UK investor');
  $('ilBBB').innerHTML=pinImg(INV_PINS.bbb)+' British Business Bank-backed';
  $('ilIUK').innerHTML=pinImg(INV_PINS.iuk)+' Innovate UK-backed';
  $('ilDual').innerHTML=pinImg(INV_PINS.dual)+' Backed by both'; }

/* ---------- Canvas dot layer ---------- */
const DotLayer = L.Layer.extend({
  initialize(){ this._pts=[]; },
  setData(pts){ this._pts=pts; if(this._map) this._redraw(); return this; },
  onAdd(m){ this._map=m; const c=this._canvas=L.DomUtil.create('canvas','dot-canvas leaflet-zoom-hide');
    const sz=m.getSize(); c.width=sz.x; c.height=sz.y; c.style.position='absolute';
    m.getPanes().overlayPane.appendChild(c); m.on('moveend zoomend resize',this._redraw,this); this._redraw(); },
  onRemove(m){ m.off('moveend zoomend resize',this._redraw,this); L.DomUtil.remove(this._canvas); },
  _redraw(){ if(!this._map) return; const m=this._map,c=this._canvas,sz=m.getSize();
    if(c.width!==sz.x||c.height!==sz.y){ c.width=sz.x; c.height=sz.y; }
    const tl=m.containerPointToLayerPoint([0,0]); L.DomUtil.setPosition(c,tl);
    const ctx=c.getContext('2d'); ctx.clearRect(0,0,c.width,c.height); const b=m.getBounds();
    const byS = S.selSectors.size>0;   // colour by sector only once a sector is chosen
    // The women-led filter paints every remaining dot pink — that highlight is
    // the whole point of the filter, so it wins over sector colouring (the hulls and
    // the sector legend still carry the sector colours underneath).
    const fem = S.femOnly;
    // faded "noise" only makes sense when colouring by sector; base layer is uniform.
    // Dots are filled colour only (no outline) — the outline/highlight is added on hover.
    for(let pass=0; pass<2; pass++){
      for(let i=0;i<this._pts.length;i++){ const p=this._pts[i];
        const isNoise = !fem && byS && p.noise;
        if((pass===0)!==!!isNoise) continue;
        if(p.lat<b.getSouth()||p.lat>b.getNorth()||p.lng<b.getWest()||p.lng>b.getEast()) continue;
        const pt=m.latLngToLayerPoint([p.lat,p.lng]).subtract(tl);
        // slightly under the sector dot size — the pink already carries the highlight,
        // so the dots don't need extra bulk on top of it
        // The 1.9px / 40% base wash below is tuned for 19,138 dots, where sheer
        // density does the work. A region build carries a few hundred, so at UK
        // zoom that wash is invisible -- the same way a funded selection was.
        // Both get drawn at selection weight instead.
        const sel = (S.dotsAreSelection || scoped()) && !isNoise;
        const r = fem ? 2.5 : (isNoise ? 1.6 : (byS ? 2.9 : (sel ? 2.7 : 1.9)));
        ctx.beginPath(); ctx.arc(pt.x,pt.y, r, 0, 6.283);
        ctx.fillStyle = fem ? FEM_DOT : (isNoise ? NOISE_COLOR : (byS ? p.color : BASE_DOT));
        // Base layer (no sector) is a light, even wash; sector view is bold + outlined.
        ctx.globalAlpha = fem ? 0.95 : (isNoise ? 0.4 : (byS ? 0.95 : (sel ? 0.92 : 0.4)));
        ctx.fill();
        // crisp black outline only when coloured by sector (fewer, meaningful dots)
        if(fem || sel || (byS && !isNoise)){ ctx.globalAlpha=0.55; ctx.lineWidth=0.6; ctx.strokeStyle='#000000'; ctx.stroke(); }
      }
    }
    ctx.globalAlpha=1;
  }
});
const dotLayer = new DotLayer().addTo(map);

/* ---------- Convex hull ---------- */
function hull(points){ if(points.length<3) return points.slice();
  const p=points.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  const lo=[]; for(const q of p){ while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],q)<=0) lo.pop(); lo.push(q); }
  const up=[]; for(let i=p.length-1;i>=0;i--){ const q=p[i]; while(up.length>=2&&cr(up[up.length-2],up[up.length-1],q)<=0) up.pop(); up.push(q); }
  up.pop(); lo.pop(); return lo.concat(up);
}

/* =================================================================== DATA
   Everything comes from one pre-joined file, data/master.json, built offline by
   tools/build_master.py. All cleaning, joining, type-coercion, company-number
   normalisation and boundary simplification happen at build time, so the browser
   only decodes and renders. Re-run the script whenever a source CSV/JSON changes.

   Companies are stored columnar — a `companyFields` header plus an array of rows —
   which is roughly half the size of an array of objects and faster to parse.     */
/* cache:'no-cache' forces a conditional request on every load, so a rebuilt
   data file is picked up immediately. Without it the browser caches
   master.json heuristically off Last-Modified and keeps serving the previous
   build — the page would show stale company counts long after a rebuild, and
   bumping ?v= on the css/js does nothing for the data files. The cost is one
   revalidation; unchanged files come back 304 with no body. */
function getJSON(url){
  // The secure build ships the data encrypted and loads js/gate.js ahead of
  // this file. gate.js asks for the passphrase, derives the key and returns a
  // promise that settles once the file is decrypted, so the call below is
  // unchanged and fires at page load either way. Plain builds never define it.
  if(window.__SECURE_GET__) return window.__SECURE_GET__(url);
  return fetch(url,{cache:'no-cache'}).then(r=>{ if(!r.ok) throw new Error(url+' → HTTP '+r.status); return r.json(); }); }

getJSON('data/master.json').then(M=>{
  const F={}; M.companyFields.forEach((n,i)=>{ F[n]=i; });
  const SEC=M.sectors, REG=M.regions;

  // investors: metadata map + the company → investors inversion
  S.enriched={}; S.invNames=[];
  S.investorsRaw=M.investors||[];
  const compInv={};
  (M.investors||[]).forEach(v=>{
    S.enriched[v.name]={ type:v.type, country:v.country, bbb:v.bbb, iuk:v.iuk, pension:v.pension, n:v.n, companies:v.companies||[] };
    S.invNames.push(v.name);
    (v.companies||[]).forEach(cid=>{ (compInv[cid]=compInv[cid]||[]).push(v.name); });
  });
  S.flags.bbb=new Set(M.flags&&M.flags.bbb||[]); S.flags.iuk=new Set(M.flags&&M.flags.iuk||[]);

  S.all=(M.companies||[]).map(r=>{
    const sector=SEC[r[F.sector]], cluster=String(r[F.cluster]), numKey=r[F.num];
    return { num:numKey, name:r[F.name], lat:r[F.lat], lng:r[F.lng], sector, cluster, noise:(cluster==='0'),
      color:SECTOR_COLORS[sector]||NOISE_COLOR,
      region:(r[F.region]>=0 ? REG[r[F.region]] : null),
      employees:r[F.employees], turnover:r[F.turnover],
      // Three-year employment CAGR as a whole percent, or null where the company
      // has no usable figure. null is NOT zero growth -- see tools/build_growth.py.
      growth:(F.growth!=null ? r[F.growth] : null),
      // investment = EQUITY only; funding = every funding type combined
      // (equity + debt + grants, incl. Innovate UK). See tools/build_funding.py.
      investment:r[F.investment], funding:(r[F.funding]||r[F.investment]||0), iuk:r[F.iuk],
      women:!!r[F.women], investors:compInv[numKey]||[] };
  });
  S.sectorsRaw=SEC;              // original order; constituency sectorCounts index into this
  S.sectors=SEC.slice().sort();
  // byNum keeps the LAST row per company. lat/lng/region/women are identical
  // across a company's rows so that is fine for them, but `sector` is not —
  // hence secsByNum, every sector a company belongs to.
  buildOrigin();
  S.byNum={}; S.secsByNum={};
  S.all.forEach(c=>{ S.byNum[c.num]=c; (S.secsByNum[c.num]||(S.secsByNum[c.num]=new Set())).add(c.sector); });
  S.primes=M.primes||{}; S.procurement=M.procurement||{};
  S.regionGeo=M.regionGeo;   // ITL1 boundaries, already renamed + simplified for drawing
  // A region build announces itself here; see SCOPE above.
  const sc=(M.meta&&M.meta.scope)||null;
  if(sc && sc.region){ SCOPE_REGION=sc.region; SCOPE_LABEL=sc.label||regionShort(sc.region); }
  drawLandLayer();
  S.eco=M.ecosystem||{universities:[],infrastructure:[],support:[]};
  console.log('Loaded companies:',S.all.length,'| sectors:',S.sectors.length,'| investors:',S.invNames.length,'| BBB:',S.flags.bbb.size,'IUK:',S.flags.iuk.size,'| built',M.meta&&M.meta.generated);
  boot();
  applyScope();
  if(/[?&]demo=1/.test(location.search)) runDemo();
}).catch(e=>{ console.error('Data load failed',e); const l=$('mapLoading'); if(l) l.textContent='Failed to load data.'; });

/* =================================================================== INVESTOR LOGIC */
function investorActive(){ return S.selInvestors.size>0 || S.invCats.size>0 || S.invTypes.size>0 || S.invAll; }
/* No type selected = every type. */
function invTypeOk(name){ if(!S.invTypes.size) return true; return S.invTypes.has(((S.enriched[name]||{}).type||'').trim()); }
function investorMode(){ return investorActive(); }
/* What the right-hand panel should call the current investor-rail filter. It used
   to always read "investor-filtered", which mis-described the funding-flag
   categories — Innovate UK grant recipients are not investor-backed companies. */
function investorFilterLabel(){
  if(S.invCats.size) return [...S.invCats].map(k=>(CATS[k]||{}).label||k).join(' + ');
  if(S.selInvestors.size) return S.selInvestors.size+' investor'+(S.selInvestors.size===1?'':'s');
  if(S.invTypes.size) return [...S.invTypes].join(' + ');
  if(S.invAll) return 'investor-backed';
  return '';
}
function categoryInvestors(){
  const names=new Set();
  const cats=[...S.invCats].map(k=>CATS[k]).filter(c=>c&&c.list&&!c.dev);
  cats.forEach(c=>{
    if(c.top==='number') S.invNames.filter(invTypeOk).sort((a,b)=>S.enriched[b].n-S.enriched[a].n).slice(0,15).forEach(n=>names.add(n));
    else if(c.inv) S.invNames.forEach(n=>{ if(c.inv(S.enriched[n]) && invTypeOk(n)) names.add(n); });
  });
  return names;
}
function investorCompanySet(){
  const set=new Set();
  if(S.selInvestors.size){ S.selInvestors.forEach(nm=>{ (S.enriched[nm]&&S.enriched[nm].companies||[]).forEach(id=>set.add(normNum(id))); }); return set; }
  if(S.invCats.size){
    S.invCats.forEach(k=>{ const c=CATS[k]; if(!c||c.dev) return;
      if(c.comp==='both'){ S.flags.bbb.forEach(id=>{ if(S.flags.iuk.has(id)) set.add(id); }); }
      else if(c.comp){ S.flags[c.comp].forEach(id=>set.add(id)); }
    });
    categoryInvestors().forEach(nm=>{ (S.enriched[nm].companies||[]).forEach(id=>set.add(normNum(id))); });
    return set;
  }
  if(S.invTypes.size){ S.invNames.forEach(nm=>{ if(invTypeOk(nm)) (S.enriched[nm].companies||[]).forEach(id=>set.add(normNum(id))); }); return set; }
  // "Show all investor-backed": every company any investor has backed.
  if(S.invAll){ S.invNames.forEach(nm=>{ (S.enriched[nm].companies||[]).forEach(id=>set.add(normNum(id))); }); return set; }
  return set;
}

/* =================================================================== FILTER */
/* Has this company been funded at all? Deliberately broad: equity raised, OR any
   funding including grants, OR an Innovate UK grant, OR a BBB / IUK flag, OR a
   named investor. The investor rail below answers the narrower questions. */
function fundedAtAll(c){
  return (c.investment>0) || (c.funding>0) || (c.iuk>0) ||
         S.flags.bbb.has(c.num) || S.flags.iuk.has(c.num) ||
         !!(c.investors && c.investors.length);
}
function rangeOpen(id){
  const cf=rangeCfg(id);
  return S[cf.min]<=cf.stops[0] && S[cf.max]===Infinity;
}
function sizeActive(){ return ['rngTurn','rngEmp','rngGrow'].some(id=>!rangeOpen(id)); }
function growthActive(){ return !rangeOpen('rngGrow'); }
/* A company with no figure on file carries 0, which is not the same as "£0 of
   turnover". It therefore passes while the lower handle is at 0 and drops out
   the moment a floor is set — the rail says so underneath the slider. */
function sizeOk(c){
  const t=c.turnover||0, e=c.employees||0;
  if(t<S.turnMin || t>S.turnMax) return false;
  if(e<S.empMin  || e>S.empMax)  return false;
  if(growthActive()){
    // No figure is not zero growth, so an unmeasured company cannot satisfy a
    // growth band and drops out.
    if(c.growth==null) return false;
    if(c.growth<S.growMin || c.growth>S.growMax) return false;
  }
  return true;
}
function getFiltered(opts){
  opts=opts||{};
  const useRegion=!opts.ignoreRegion && S.selRegions.size>0;
  const invSet=(!opts.ignoreInvestor && investorMode()) ? (S._invSet||investorCompanySet()) : null;
  const conIdx=(!opts.ignoreCon && S.selCon!=null) ? S.selConIdx : -1;
  const size=!opts.ignoreSize && sizeActive();
  return S.all.filter(c=>{
    if(conIdx>=0 && c.conIdx!==conIdx) return false;
    if(S.selSectors.size && !S.selSectors.has(c.sector)) return false;
    if(useRegion && (!c.region || !S.selRegions.has(c.region))) return false;
    if(invSet && !invSet.has(c.num)) return false;
    if(S.femOnly && !c.women) return false;
    if(S.fundAny && !opts.ignoreFunding && !fundedAtAll(c)) return false;
    if(size && !sizeOk(c)) return false;
    return true;
  });
}
/* Collapse a company-sector row list to one entry per company. Needed wherever
   a figure is "number of companies" rather than "number of sector memberships". */
function uniqueCompanies(list){
  const seen=new Set(), out=[];
  list.forEach(c=>{ if(c.num){ if(seen.has(c.num)) return; seen.add(c.num); } out.push(c); });
  return out;
}

/* The company list holds one entry per COMPANY-SECTOR: 5,645 companies sit in
   more than one sector. Sector tallies count every membership (a company really
   does belong to both), but company-level figures — headcount, turnover, equity,
   the company count itself — must count each company ONCE, or a company in four
   sectors would contribute its turnover four times. */
function aggregate(list){
  const s={n:0,rows:list.length,emp:0,turn:0,inv:0,fund:0,iuk:0,women:0,bySector:{},invCount:{}};
  const seen=new Set();
  list.forEach(c=>{
    s.bySector[c.sector]=(s.bySector[c.sector]||0)+1;
    if(c.num){ if(seen.has(c.num)) return; seen.add(c.num); }
    s.n++; s.emp+=c.employees; s.turn+=c.turnover; s.inv+=c.investment; s.fund+=c.funding; s.iuk+=c.iuk;
    if(c.women) s.women++;
    c.investors.forEach(iv=>{ s.invCount[iv]=(s.invCount[iv]||0)+1; });
  });
  s.femPct=s.n?(s.women/s.n*100):0; return s;
}

/* =================================================================== MAP RENDER */
function renderMap(){
  const list=getFiltered(); S.rendered=list;
  const invMode=investorMode();
  // Investor-filtered results are shown as pins whenever they are few enough to
  // plot. Previously a sector selection forced the dot/hull view, but the
  // investor-and-sector intersection is usually tiny (often single figures), which
  // rendered as a handful of ~2px dots and no hulls — the map looked empty. Pins
  // keep those matches findable and clickable; large sets still fall back to dots.
  // Investor pins sit as a LAYER ON TOP of the cluster layer. The dots and hulls
  // therefore come from the same selection with the investor filter REMOVED, so
  // the polygons keep their true cluster shape and the pins simply highlight
  // which of those companies the chosen investors back. Drawing hulls around the
  // investor subset alone would imply clusters that aren't in the data.
  // "Any funding received" puts pins on the map on the same terms as the
  // investor filters: the dots and hulls keep the UNFILTERED shape underneath
  // and the pins mark which of those companies carry funding.
  const fundMode = S.fundAny;
  const pinMode = invMode || fundMode;
  const baseList = pinMode ? getFiltered({ignoreInvestor:true, ignoreFunding:true}) : list;
  // One pin per COMPANY: a company in several sectors would otherwise get
  // several identical pins stacked at one point, and count several times
  // against the marker cap.
  // In origin mode only companies whose backers have a recorded country are
  // pinned. Falling back to the UK pin would assert UK-only backing for the 470
  // companies whose investors (all Datacity-sourced) carry no country at all.
  const pinList = pinMode ? ((S.invOrigin && invMode) ? uniqueCompanies(list).filter(c=>originOf(c.num))
                                                     : uniqueCompanies(list)) : [];
  const useMarkers = pinMode && pinList.length>0 && pinList.length<=MARKER_CAP;
  S.markersShown = useMarkers;
  // With no sector chosen, investor browsing stays a clean pin-only view;
  // once a sector is chosen the cluster context comes back underneath.
  // ...and the pink dots are the point of the female filter, so they stay on too.
  //
  // The dots are only allowed to go away when the pins are actually THERE to
  // replace them. Hiding them on pinMode alone emptied the map whenever the
  // selection was bigger than MARKER_CAP -- "Any funding received" is 3,400
  // companies against a cap of 2,600, so it drew neither pins nor dots while
  // the panel still reported the count.
  const showDots = !useMarkers || S.selSectors.size>0 || S.femOnly;
  // ...and with the pins suppressed, those dots must be the FILTERED set.
  // baseList deliberately ignores the pin-driving filter so that pins can mark
  // a subset of it; with no pins to do the marking it would show every company
  // and the filter would look as though it had done nothing.
  const dotRows = (pinMode && !useMarkers) ? list : baseList;
  // Those stand-in dots are a selection of 3,400, not the 19,138-dot base wash.
  // Drawn at the base weight (1.9px, 40% opacity) they read as an empty map --
  // you only knew they were there by hovering one. Flagged so the dot layer
  // gives them the weight a selection deserves.
  S.dotsAreSelection = pinMode && !useMarkers;
  dotLayer.setData((S.displayMode==='polygons' || !showDots) ? [] : dotRows);
  // The sector legend and the Points/Polygons/Both switch both only describe the
  // sector cluster layer, so neither is meaningful until a sector is selected.
  const lgEl=$('legend'); if(lgEl) lgEl.style.display = S.selSectors.size ? '' : 'none';
  const pill=document.querySelector('.display-pill'); if(pill) pill.style.display = S.selSectors.size ? '' : 'none';
  const femLg=$('female-legend'); if(femLg) femLg.style.display = S.femOnly ? '' : 'none';
  invMarkerLayer.clearLayers();
  // No explicit raise is needed (and L.layerGroup has no bringToFront): pins are
  // L.markers, which Leaflet puts in markerPane (z-index 600), while the hull
  // polygons and the dot canvas both sit in overlayPane (400). The pins are
  // therefore already drawn as a layer on top of the cluster layer.
  if(useMarkers) pinList.forEach(c=>{ L.marker([c.lat,c.lng],{icon:iconFor(c)}).bindPopup(companyPopup(c),{maxWidth:280}).addTo(invMarkerLayer); });
  updateInvestorLegend(useMarkers);

  hullLayer.clearLayers(); S.hulls=[]; hoveredHull=null;
  // Cluster polygons appear whenever sector(s) are selected (a sector-driven filter),
  // never as the default base view.
  // Hulls are drawn whenever sectors are selected — including alongside investor
  // pins — and always from baseList, so they show the real cluster shape.
  if(S.displayMode!=='points' && S.selSectors.size>0){
    const groups={}; baseList.forEach(c=>{ if(c.cluster==='0') return; const k=c.sector+'||'+c.cluster; (groups[k]=groups[k]||[]).push(c); });
    Object.keys(groups).forEach(k=>{ const g=groups[k]; if(g.length<3) return; const col=g[0].color;
      const ring=hull(g.map(c=>[c.lat,c.lng]));
      // polygons are visual only; hover + click handling is centralised on the map
      const poly=L.polygon(ring,{color:col,weight:1,opacity:.6,fillColor:col,fillOpacity:.1,interactive:false}).addTo(hullLayer);
      S.hulls.push({ring:ring, group:g, layer:poly});
    });
  }
}
function companyPopup(c){
  const inv=c.investors||[];
  return '<div class="popup"><div class="ph">'+esc(c.name)+'</div>'+
    '<div class="row"><span>Company no.</span><b>'+esc(c.num)+'</b></div>'+
    '<div class="row"><span>Sector</span><b>'+esc(c.sector)+'</b></div>'+
    '<div class="row"><span>Cluster</span><b>'+(c.cluster==='0'?'Ungrouped':('Cluster '+esc(c.cluster)))+'</b></div>'+
    '<div class="row"><span>Region</span><b>'+esc(regionShort(c.region||'—'))+'</b></div>'+
    (inv.length ? ('<div class="ph2">Investors ('+inv.length+')</div><ul>'+inv.slice(0,25).map(i=>'<li>'+esc(i)+'</li>').join('')+'</ul>') : '')+
    '</div>';
}
function clusterBody(g){
  const s=aggregate(g);
  return '<div class="ph">'+esc(g[0].sector)+' · Cluster '+esc(g[0].cluster)+'</div>'+
    '<div class="row"><span>Region</span><b>'+esc(regionShort(g[0].region||'—'))+'</b></div>'+
    '<div class="row"><span>Companies</span><b>'+nf(s.n)+'</b></div>'+
    '<div class="row"><span>Employees</span><b>'+compact(s.emp)+'</b></div>'+
    '<div class="row"><span>Turnover</span><b>'+money(s.turn)+'</b></div>'+
    '<div class="row"><span>Investment</span><b>'+money(s.inv)+'</b></div>'+
    '<div class="row"><span>Women-led</span><b>'+s.femPct.toFixed(0)+'%</b></div>';
}
function clusterPopup(g){ return '<div class="popup">'+clusterBody(g)+'</div>'; }
// Overlapping clusters -> one popup with a tab per cluster
function clusterTabsPopup(hits){
  const wrap=document.createElement('div'); wrap.className='popup';
  const tabs=document.createElement('div'); tabs.className='ptabs';
  const body=document.createElement('div'); body.className='ptab-body';
  hits.forEach((h,i)=>{
    const g=h.group; const col=g[0].color;
    const btn=document.createElement('button'); btn.type='button'; btn.className='ptab'+(i===0?' active':'');
    btn.style.setProperty('--tabc', col);
    btn.innerHTML='<i style="background:'+col+'"></i>'+esc(g[0].sector.split(/\s+/)[0])+' · C'+esc(g[0].cluster);
    btn.title=g[0].sector+' · Cluster '+g[0].cluster;
    btn.addEventListener('click',()=>{ wrap.querySelectorAll('.ptab').forEach(x=>x.classList.remove('active')); btn.classList.add('active'); body.innerHTML=clusterBody(g); });
    tabs.appendChild(btn);
  });
  body.innerHTML=clusterBody(hits[0].group);
  wrap.appendChild(tabs); wrap.appendChild(body); return wrap;
}
/* Single prioritised click handler (canvas dots + polygons aren't individually
   clickable, so we resolve the click ourselves):
     1. a *visible* company dot within ~7px  -> company popup
     2. inside a cluster hull                -> cluster popup
     3. inside a UK region                   -> region popup
   Company hit-testing is skipped in polygons-only mode and when investor
   markers are drawn (those markers carry their own popups) — this is what
   was wrongly snapping to an off-screen company when a polygon was clicked. */
function hullContains(ring,lat,lng){ let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){ const yi=ring[i][0],xi=ring[i][1],yj=ring[j][0],xj=ring[j][1];
    if(((yi>lat)!==(yj>lat)) && (lng<(xj-xi)*(lat-yi)/(yj-yi)+xi)) inside=!inside; } return inside; }
function ringContains(ring,x,y){ let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){ const xi=ring[i][0],yi=ring[i][1],xj=ring[j][0],yj=ring[j][1];
    if(((yi>y)!==(yj>y)) && (x<(xj-xi)*(y-yi)/(yj-yi)+xi)) inside=!inside; } return inside; }
function pointInFeature(lat,lng,feat){ const g=feat.geometry; if(!g) return false;
  const polys=g.type==='Polygon'?[g.coordinates]:(g.type==='MultiPolygon'?g.coordinates:[]);
  for(const poly of polys){ if(ringContains(poly[0],lng,lat)){ let hole=false;
    for(let h=1;h<poly.length;h++){ if(ringContains(poly[h],lng,lat)){ hole=true; break; } }
    if(!hole) return true; } } return false; }
function regionPopup(feat){
  const name=feat.properties.ITL121NM;
  const list=getFiltered({ignoreRegion:true}).filter(c=>c.region===name); const s=aggregate(list);
  const mix=Object.keys(s.bySector).sort((a,b)=>s.bySector[b]-s.bySector[a]).slice(0,4)
    .map(k=>'<li>'+esc(k)+' · '+nf(s.bySector[k])+'</li>').join('');
  return '<div class="popup"><div class="ph">'+esc(regionShort(name))+'</div>'+
    '<div class="row"><span>Companies</span><b>'+nf(s.n)+'</b></div>'+
    '<div class="row"><span>Employees</span><b>'+compact(s.emp)+'</b></div>'+
    '<div class="row"><span>Turnover</span><b>'+money(s.turn)+'</b></div>'+
    '<div class="row"><span>Investment</span><b>'+money(s.inv)+'</b></div>'+
    '<div class="row"><span>Women-led</span><b>'+s.femPct.toFixed(0)+'%</b></div>'+
    (mix?'<div class="ph2">Top sectors</div><ul>'+mix+'</ul>':'')+'</div>';
}
map.on('click', e=>{
  const lat=e.latlng.lat, lng=e.latlng.lng;
  const hits=[]; for(const h of S.hulls){ if(hullContains(h.ring,lat,lng)) hits.push(h); }
  // 1) overlapping clusters -> tabbed popup takes priority (disambiguation)
  if(hits.length>1){ L.popup({maxWidth:300}).setLatLng(e.latlng).setContent(clusterTabsPopup(hits)).openOn(map); return; }
  // 2) a visible company dot
  if(S.displayMode!=='polygons' && !S.markersShown && S.rendered.length){
    const cp=e.containerPoint, b=map.getBounds(); let best=null, bd=1e9;
    for(const c of S.rendered){
      if(c.lat<b.getSouth()||c.lat>b.getNorth()||c.lng<b.getWest()||c.lng>b.getEast()) continue;
      const p=map.latLngToContainerPoint([c.lat,c.lng]); const dx=p.x-cp.x, dy=p.y-cp.y, d=dx*dx+dy*dy;
      if(d<bd){ bd=d; best=c; }
    }
    if(best && bd<=49){ L.popup({maxWidth:280}).setLatLng([best.lat,best.lng]).setContent(companyPopup(best)).openOn(map); return; }
  }
  // 3) a single cluster hull
  if(hits.length===1){ L.popup({maxWidth:260}).setLatLng(e.latlng).setContent(clusterPopup(hits[0].group)).openOn(map); return; }
  // 4) UK region — only when that region is actually selected
  if(S.selRegions.size && S.regionGeo){
    for(const f of S.regionGeo.features){ if(S.selRegions.has(f.properties.ITL121NM) && pointInFeature(lat,lng,f)){ L.popup({maxWidth:280}).setLatLng(e.latlng).setContent(regionPopup(f)).openOn(map); return; } }
  }
});

/* Hover: highlight cluster hulls + show a pointer cursor over company dots
   (canvas dots aren't real DOM nodes, so we resolve hover ourselves). */
let hoveredHull = null;
const hoverDot = L.circleMarker([0,0], { radius:6, weight:2, color:'#ffffff', fillColor:'#333', fillOpacity:1, opacity:1, interactive:false });
function dotColor(c){ if(S.femOnly) return FEM_DOT; if(!S.selSectors.size) return BASE_DOT; return c.noise?NOISE_COLOR:c.color; }
function dotNearCompany(e){
  if(S.displayMode==='polygons' || S.markersShown || !S.rendered.length) return null;
  const cp=e.containerPoint, lat=e.latlng.lat, lng=e.latlng.lng;
  const b=map.getBounds(), sz=map.getSize();
  const dLng=(b.getEast()-b.getWest())/sz.x*9, dLat=(b.getNorth()-b.getSouth())/sz.y*9;
  let best=null, bd=49;
  for(let i=0;i<S.rendered.length;i++){ const c=S.rendered[i];
    if(Math.abs(c.lat-lat)>dLat || Math.abs(c.lng-lng)>dLng) continue;
    const p=map.latLngToContainerPoint([c.lat,c.lng]); const dx=p.x-cp.x, dy=p.y-cp.y, d=dx*dx+dy*dy;
    if(d<=bd){ bd=d; best=c; } }
  return best;
}
function showHoverDot(c){ const dark=document.documentElement.getAttribute('data-theme')==='dark';
  hoverDot.setStyle({ fillColor:dotColor(c), color: dark?'#0a141e':'#ffffff' });
  hoverDot.setLatLng([c.lat,c.lng]); if(!map.hasLayer(hoverDot)) hoverDot.addTo(map); }
function hideHoverDot(){ if(map.hasLayer(hoverDot)) map.removeLayer(hoverDot); }
map.on('mousemove', e=>{
  const lat=e.latlng.lat, lng=e.latlng.lng; let hit=null;
  for(const h of S.hulls){ if(hullContains(h.ring,lat,lng)){ hit=h; break; } }
  if(hit!==hoveredHull){
    if(hoveredHull && hoveredHull.layer && hoveredHull.layer.setStyle) hoveredHull.layer.setStyle({weight:1, opacity:.6, fillOpacity:.1});
    hoveredHull=hit;
    if(hit && hit.layer && hit.layer.setStyle){ hit.layer.setStyle({weight:2.5, opacity:.95, fillOpacity:.26}); if(hit.layer.bringToFront) hit.layer.bringToFront(); }
  }
  const dc = hit ? null : dotNearCompany(e);
  if(dc) showHoverDot(dc); else hideHoverDot();
  map.getContainer().style.cursor = (hit || dc) ? 'pointer' : '';
});
map.on('mouseout', ()=>{
  if(hoveredHull && hoveredHull.layer && hoveredHull.layer.setStyle) hoveredHull.layer.setStyle({weight:1, opacity:.6, fillOpacity:.1});
  hoveredHull=null; hideHoverDot(); map.getContainer().style.cursor='';
});

/* ============================================================== SIZE SLIDERS */
function rangeCfg(id){
  if(id==='rngTurn') return {stops:TURN_STOPS,   min:'turnMin', max:'turnMax', kind:'money', title:'Turnover'};
  if(id==='rngGrow') return {stops:GROWTH_STOPS, min:'growMin', max:'growMax', kind:'pct',   title:'Growth rate'};
  return {stops:EMP_STOPS, min:'empMin', max:'empMax', kind:'count', title:'Employees'};
}
/* Accepts what a person would actually type: 25m, 1.5bn, 10k, 250, -5. */
function parseAmount(txt, kind){
  const t=String(txt||'').trim().toLowerCase().replace(/[, £%]/g,'');
  if(!t) return null;
  const m=t.match(/^(-?\d*\.?\d+)(k|m|bn|b)?$/);
  if(!m) return NaN;
  let v=parseFloat(m[1]);
  if(kind!=='pct'){ const u=m[2];
    if(u==='k') v*=1e3; else if(u==='m') v*=1e6; else if(u==='b'||u==='bn') v*=1e9; }
  return v;
}
/* The handle sits on the nearest stop; the bound itself keeps the exact value. */
function nearestStop(stops, v){
  const fin=x=>x===Infinity?1e18:(x===-Infinity?-1e18:x);
  let best=0, gap=Infinity;
  for(let i=0;i<stops.length;i++){
    const d=Math.abs(fin(stops[i])-fin(v));
    if(d<gap){ gap=d; best=i; }
  }
  return best;
}
function stopText(v, kind){
  if(v===Infinity || v===-Infinity) return 'Any';
  if(kind==='pct') return v+'%';
  if(v===0) return kind==='money' ? '£0' : '0';
  return kind==='money' ? money(v) : nf(v);
}
/* One label for both the slider and its chip, so the two can never disagree. */
function rangeLabel(id){
  const cf=rangeCfg(id), lo=S[cf.min], hi=S[cf.max];
  const openLo=lo<=cf.stops[0], openHi=hi===Infinity;
  if(openLo && openHi) return {full:true, text:'Any'};
  if(openLo) return {full:false, text:'Up to '+stopText(hi,cf.kind)};
  if(openHi) return {full:false, text:stopText(lo,cf.kind)+' and above'};
  return {full:false, text:stopText(lo,cf.kind)+' – '+stopText(hi,cf.kind)};
}
function sizeLabelShort(){
  return ['rngTurn','rngEmp','rngGrow'].map(id=>{ const l=rangeLabel(id);
    return l.full ? null : rangeCfg(id).title.toLowerCase()+' '+l.text; }).filter(Boolean).join(', ');
}
function syncRange(id){
  const el=$(id); if(!el) return;
  const cf=rangeCfg(id), last=cf.stops.length-1;
  const lo=S[cf.min], hi=S[cf.max];
  const li=nearestStop(cf.stops,lo), hj=nearestStop(cf.stops,hi);
  const a=el.querySelector('.rng-lo'), b=el.querySelector('.rng-hi');
  a.max=last; b.max=last; a.value=li; b.value=hj;
  const f=el.querySelector('.rng-fill');
  f.style.left=(li/last*100)+'%';
  f.style.right=((last-hj)/last*100)+'%';
  const lab=rangeLabel(id);
  el.querySelector('.rng-val').textContent=lab.text;
  el.classList.toggle('on',!lab.full);
  // The boxes stay blank at an open end rather than printing an infinity, and
  // are left alone while they have focus so typing is never overwritten.
  const nMin=el.querySelector('.rng-min'), nMax=el.querySelector('.rng-max');
  if(nMin && document.activeElement!==nMin) nMin.value = lo<=cf.stops[0] ? '' : plainNum(lo,cf.kind);
  if(nMax && document.activeElement!==nMax) nMax.value = hi===Infinity  ? '' : plainNum(hi,cf.kind);
}
/* What goes in the typing box: short, and parseable straight back. */
function plainNum(v,kind){
  if(v===Infinity||v===-Infinity) return '';
  if(kind==='money'){
    if(Math.abs(v)>=1e9 && v%1e8===0) return (v/1e9)+'bn';
    if(Math.abs(v)>=1e6 && v%1e5===0) return (v/1e6)+'m';
  }
  return String(v);
}
function wireRange(id){
  const el=$(id); if(!el) return;
  const cf=rangeCfg(id), last=cf.stops.length-1;
  const a=el.querySelector('.rng-lo'), b=el.querySelector('.rng-hi');
  a.max=last; b.max=last; b.value=last;
  const push=()=>{ syncRange(id); onFilterChange(); };
  // Handles may not cross: each one stops at the other.
  a.addEventListener('input',()=>{
    S[cf.min]=cf.stops[Math.min(+a.value, nearestStop(cf.stops,S[cf.max]))]; push(); });
  b.addEventListener('input',()=>{
    S[cf.max]=cf.stops[Math.max(+b.value, nearestStop(cf.stops,S[cf.min]))]; push(); });

  const nMin=el.querySelector('.rng-min'), nMax=el.querySelector('.rng-max');
  const typed=(box,key,openTo)=>{
    const v=parseAmount(box.value,cf.kind);
    box.classList.toggle('bad', Number.isNaN(v));
    if(Number.isNaN(v)) return;
    S[key] = (v===null) ? openTo : v;
    // A pair typed the wrong way round is swapped rather than refused.
    if(S[cf.min]>S[cf.max]){ const t=S[cf.min]; S[cf.min]=S[cf.max]; S[cf.max]=t; }
    syncRange(id); onFilterChange();
  };
  if(nMin && nMax){
    nMin.addEventListener('change',()=>typed(nMin,cf.min,cf.stops[0]));
    nMax.addEventListener('change',()=>typed(nMax,cf.max,Infinity));
    [nMin,nMax].forEach(n=>n.addEventListener('keydown',e=>{ if(e.key==='Enter') n.blur(); }));
  }
  syncRange(id);
}
function resetSize(){
  S.turnMin=TURN_STOPS[0]; S.turnMax=Infinity;
  S.empMin=EMP_STOPS[0];   S.empMax=Infinity;
  S.growMin=-Infinity;     S.growMax=Infinity;
  ['rngTurn','rngEmp','rngGrow'].forEach(syncRange);
}

/* ========================================================== FUNDING CONTROLS */
function syncFundAnyBtn(){ const b=$('fundAnyBtn'); if(b) b.setAttribute('aria-pressed', S.fundAny?'true':'false'); }
/* "Investor-backed" is a strict SUBSET of "any funding": every one of those
   companies sits inside the larger set, the difference being the grant-only
   ones with no named investor. Printing both counts is the clearest way to
   show the two controls are nested rather than alternatives. */
function labelFundingCounts(){
  const uniq=uniqueCompanies(S.all);
  const m=document.querySelector('#fundAnyBtn .meta');
  if(m) m.textContent='Equity, grant or a named investor \u00b7 '+nf(uniq.filter(fundedAtAll).length);
}
/* The pin-colour control only changes pins that are already on the map. */
function syncOriginHint(){ const h=$('originHint'); if(h) h.hidden=investorActive(); }
/* The three funding FLAGS get their own visible control rather than hiding in
   the category dropdown with the investor groups. They answer a different
   question -- what a company received, not who backed it -- and the old mixed
   list was the main thing making this section hard to read. */
function flagKeys(){ return Object.keys(CATS).filter(k=>CATS[k].flag); }
function syncFlagSeg(){
  document.querySelectorAll('#flagSeg .seg-btn').forEach(b=>
    b.classList.toggle('on', S.invCats.has(b.dataset.k)));
}
function renderFlagSeg(){
  const el=$('flagSeg'); if(!el) return;
  el.innerHTML=flagKeys().map(k=>'<button type="button" class="seg-btn" data-k="'+k+'">'+
    esc(CATS[k].label)+'</button>').join('');
  el.querySelectorAll('.seg-btn').forEach(b=>b.addEventListener('click',()=>{
    const k=b.dataset.k;
    if(S.invCats.has(k)) S.invCats.delete(k);
    else { S.invCats.add(k); S.selInvestors.clear(); renderInvTags();
           // a category outranks "all investor-backed" in investorCompanySet()
           S.invAll=false; syncInvAllBtn(); }
    syncFlagSeg(); renderCatField(); syncCatMenu(); renderActiveBar(); onFilterChange(); }));
  syncFlagSeg();
}

/* ============================================================== ACTIVE FILTERS */
/* The rail has six sections, five of them collapsed. Without this bar a filter
   set earlier can keep cutting the map down with nothing on screen to say so. */
function activeChips(){
  const out=[];
  S.selSectors.forEach(s=>out.push({k:'sec|'+s, t:s}));
  S.selRegions.forEach(r=>out.push({k:'reg|'+r, t:regionShort(r)}));
  if(S.femOnly)  out.push({k:'fem', t:'Women-led'});
  if(S.fundAny)  out.push({k:'fund', t:'Any funding'});
  ['rngTurn','rngEmp','rngGrow'].forEach(id=>{ const l=rangeLabel(id);
    if(!l.full) out.push({k:'size|'+id, t:rangeCfg(id).title+' '+l.text}); });
  S.invCats.forEach(k=>{ const c=CATS[k]; if(c) out.push({k:'cat|'+k, t:c.label}); });
  S.invTypes.forEach(t=>out.push({k:'type|'+t, t:t}));
  S.selInvestors.forEach(n=>out.push({k:'inv|'+n, t:n}));
  if(S.invAll) out.push({k:'invall', t:'Investor-backed'});
  return out;
}
function renderActiveBar(){
  const bar=$('activeBar'); if(!bar) return;
  const chips=activeChips();
  bar.hidden=!chips.length;
  if(!chips.length){ bar.innerHTML=''; return; }
  bar.innerHTML='<div class="ab-head"><span>'+chips.length+' filter'+(chips.length===1?'':'s')+
    ' active</span><button type="button" class="linkbtn" data-k="__all">Clear all</button></div>'+
    '<div class="ab-chips">'+chips.map(c=>'<span class="ab-chip">'+esc(c.t)+
      '<button type="button" aria-label="Remove '+esc(c.t)+'" data-k="'+esc(c.k)+'">×</button></span>').join('')+'</div>';
}
/* The bar can be dragged anywhere on screen and stays put for the session. It
   starts docked at the top of the rail; the first drag lifts it to fixed
   positioning. Pointer events, so a touchscreen drags it too. */
function makeBarDraggable(bar){
  let id=null, dx=0, dy=0;
  const place=(x,y)=>{
    const w=bar.offsetWidth, h=bar.offsetHeight;
    x=Math.max(4, Math.min(window.innerWidth-w-4, x));
    y=Math.max(4, Math.min(window.innerHeight-h-4, y));
    bar.style.left=x+'px'; bar.style.top=y+'px';
    try{ sessionStorage.setItem('cm_bar', x+','+y); }catch(e){}
  };
  bar.addEventListener('pointerdown',e=>{
    if(e.target.closest('button')) return;      // chips stay clickable
    const r=bar.getBoundingClientRect();
    bar.classList.add('floating','dragging');
    bar.style.width=r.width+'px';
    dx=e.clientX-r.left; dy=e.clientY-r.top;
    id=e.pointerId; bar.setPointerCapture(id);
    place(r.left, r.top);
    e.preventDefault();
  });
  bar.addEventListener('pointermove',e=>{ if(id===e.pointerId) place(e.clientX-dx, e.clientY-dy); });
  const stop=e=>{ if(id===e.pointerId){ bar.classList.remove('dragging');
    try{ bar.releasePointerCapture(id); }catch(err){} id=null; } };
  bar.addEventListener('pointerup',stop);
  bar.addEventListener('pointercancel',stop);
  try{                                          // back where it was left
    const saved=sessionStorage.getItem('cm_bar');
    if(saved){ const xy=saved.split(',').map(Number);
      bar.classList.add('floating'); bar.style.left=xy[0]+'px'; bar.style.top=xy[1]+'px'; }
  }catch(e){}
}
function syncSectorChips(){
  document.querySelectorAll('.chip[data-sector]').forEach(c=>
    c.setAttribute('aria-pressed', S.selSectors.has(c.dataset.sector)?'true':'false'));
}
function syncInvAllBtn(){
  const ab=$('invAllBtn'); if(!ab) return;
  ab.classList.toggle('active',S.invAll);
  ab.textContent=S.invAll?'Hide all investor-backed':'Show all investor-backed';
}
/* Drop one filter, named by the chip carrying it. */
function clearFilter(key){
  const i=key.indexOf('|'), kind=i<0?key:key.slice(0,i), val=i<0?'':key.slice(i+1);
  if(kind==='__all'){ resetAllFilters(); return; }
  if(kind==='sec'){ S.selSectors.delete(val); syncSectorChips(); }
  else if(kind==='reg')  { S.selRegions.delete(val); }
  else if(kind==='fem')  { S.femOnly=false; syncFemBtn(); }
  else if(kind==='fund') { S.fundAny=false; syncFundAnyBtn(); }
  else if(kind==='size') { const cf=rangeCfg(val);
    S[cf.min]=cf.stops[0]; S[cf.max]=Infinity; syncRange(val); }
  else if(kind==='cat')  { S.invCats.delete(val); syncFlagSeg(); renderCatField(); syncCatMenu(); }
  else if(kind==='type') { S.invTypes.delete(val); renderTypeField(); syncTypeMenu(); }
  else if(kind==='inv')  { S.selInvestors.delete(val); renderInvTags(); }
  else if(kind==='invall'){ S.invAll=false; syncInvAllBtn(); }
  onFilterChange({region:kind==='reg'});
}
function resetAllFilters(){
  S.selSectors.clear(); S.selRegions.clear(); S.selInvestors.clear();
  S.invCats.clear(); S.invTypes.clear(); S.invAll=false; S.femOnly=false; S.fundAny=false;
  S.selCon=null; S.selConIdx=-1;
  resetSize(); syncFemBtn(); femVideo(false); syncFundAnyBtn(); syncInvAllBtn(); syncFlagSeg();
  syncSectorChips(); renderTypeField(); syncTypeMenu(); renderInvTags(); renderCatField(); syncCatMenu();
  onFilterChange({region:true});
}
function renderDetail(){
  const list=getFiltered(); const s=aggregate(list);
  const regs=[...S.selRegions];
  // On a region build the whole file is one region, so "United Kingdom" would
  // name a population that is not there.
  let name = scoped() ? SCOPE_LABEL : 'United Kingdom', kicker='Overview';
  const selCon=(S.selCon!=null)?conList().find(c=>c.code===S.selCon):null;
  if(selCon){ name=selCon.name; kicker=selCon.gov?'Government-held seat':'Constituency'; }
  else if(regs.length===1){ name=regionShort(regs[0]); kicker='Region'; }
  else if(regs.length>1){ name=regs.length+' regions'; kicker='Regions'; }
  const sub=[nf(s.n)+' companies'];
  if(S.selSectors.size) sub.push(S.selSectors.size+' of '+S.sectors.length+' sectors');
  if(investorActive()){ const l=investorFilterLabel(); if(l) sub.push(l); }
  if(S.fundAny) sub.push('funded');
  if(sizeActive()) sub.push(sizeLabelShort());
  $('dKicker').textContent=kicker; $('dName').textContent=name; $('dSub').textContent=sub.join(' · ');
  const mpCard=$('conMpCard');
  if(mpCard){
    if(selCon){
      mpCard.hidden=false;
      mpCard.innerHTML='<h3>Member of Parliament</h3>'+
        (selCon.vacant
          ? '<div class="mp-name">Seat vacant</div>'
          : '<div class="mp-head">'+mpAvatar(selCon)+
              '<div><div class="mp-name">'+esc(selCon.mp)+'</div>'+
              '<div class="mp-party">'+esc(selCon.party)+'</div></div></div>')+
        '<div class="mp-role">'+esc(selCon.role||'—')+'</div>'+
        (selCon.gov?'<div class="gov-badge">UK Government post</div>':'');
    } else { mpCard.hidden=true; mpCard.innerHTML=''; }
  }
  $('detailReset').hidden=!hasActiveFilter();

  $('statGrid').innerHTML=[['Companies',nf(s.n),''],['Employees',compact(s.emp),''],['Turnover',money(s.turn),'aggregate'],
    ['Investment',money(s.inv),'equity raised'],['IUK funding',money(s.iuk),'grants'],['Women-led',s.femPct.toFixed(1)+'%','of companies']]
    .map(c=>'<div class="stat"><div class="lab">'+c[0]+'</div><div class="val">'+c[1]+'</div>'+(c[2]?'<div class="sub">'+c[2]+'</div>':'')+'</div>').join('');

  // sector mix — map-embedded mini doughnut
  const mix=Object.keys(s.bySector).sort((a,b)=>s.bySector[b]-s.bySector[a]);
  const canv=$('detailSectorChart'), empty=$('sectorMixEmpty');
  if(mix.length && typeof miniDoughnut==='function'){ if(canv) canv.style.display=''; if(empty) empty.style.display='none';
    const top=mix.slice(0,7), rest=mix.slice(7).reduce((a,k)=>a+s.bySector[k],0);
    const labels=top.slice(), vals=top.map(k=>s.bySector[k]), cols=top.map(k=>SECTOR_COLORS[k]||NOISE_COLOR);
    if(rest>0){ labels.push('Other'); vals.push(rest); cols.push(NOISE_COLOR); }
    miniDoughnut('detailSectorChart', labels, vals, cols, nf);
  } else { destroyChart('detailSectorChart'); if(canv) canv.style.display='none'; if(empty) empty.style.display=''; }

  const invMode = investorActive();
  if(invMode) renderInvestorList(list,s); else renderTopInvestors(s);
}
function renderTopInvestors(s){
  $('invListTitle').textContent='Top investors here';
  const inv=Object.keys(s.invCount).sort((a,b)=>s.invCount[b]-s.invCount[a]).slice(0,6);
  $('invList').innerHTML=inv.length?inv.map(nm=>invRow(nm,s.invCount[nm],false)).join(''):'<div class="empty">No investor links in this selection.</div>';
}
function renderInvestorList(list,s){
  let candidates, title;
  if(S.selInvestors.size){ candidates=[...S.selInvestors]; title='Selected investor'+(S.selInvestors.size>1?'s':''); }
  else { const li=categoryInvestors();
    if(li.size){ candidates=[...li]; title='Investors in category'; }
    else { candidates=S.invNames.filter(invTypeOk); title='Investors'; } }
  candidates.sort((a,b)=>(s.invCount[b]||0)-(s.invCount[a]||0) || (S.enriched[b].n-S.enriched[a].n));
  const shown=candidates.slice(0,40);
  $('invListTitle').textContent=title+' ('+nf(candidates.length)+')';
  let html='';
  // backed-business stats for BBB / IUK when those categories are on
  if(S.invCats.has('bbb')||S.invCats.has('bbb_iuk_both')) html+=backedBlock('bbb','British Business Bank backed',list);
  if(S.invCats.has('iuk')||S.invCats.has('bbb_iuk_both')) html+=backedBlock('iuk','Innovate UK backed',list);
  html+= shown.length ? shown.map(nm=>invRow(nm,s.invCount[nm]||0,true)).join('') : '<div class="empty">No investors match.</div>';
  $('invList').innerHTML=html;
  $('invList').querySelectorAll('.inv.clickable').forEach(el=>el.addEventListener('click',()=>{
    const nm=el.getAttribute('data-inv'); S.selInvestors=new Set([nm]); S.invCats.clear(); renderCatField(); syncCatMenu(); renderInvTags(); onFilterChange();
  }));
}
function invRow(nm,count,clickable){
  const v=S.enriched[nm]||{type:'',country:''}; const iso=isoFor(v.country);
  const flag=iso?'<span class="fi fi-'+iso+'"></span>':'<span style="width:20px;flex:0 0 auto"></span>';
  const init=nm.split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase();
  return '<div class="inv'+(clickable?' clickable':'')+'" data-inv="'+esc(nm)+'">'+flag+
    '<div class="im"><div class="n" title="'+esc(nm)+'">'+esc(nm)+'</div><div class="t">'+esc(v.type||'Investor')+(v.country?' · '+esc(v.country):'')+'</div></div>'+
    '<div class="ct">'+nf(count)+' cos</div></div>';
}
function backedBlock(flag,label,list){
  const ids=S.flags[flag]; const sub=list.filter(c=>ids.has(c.num)); const a=aggregate(sub);
  return '<div class="backed"><h4>'+label+': '+nf(a.n)+' companies</h4><div class="m">'+
    '<div><span class="v">'+compact(a.emp)+'</span><span class="l">Employees</span></div>'+
    '<div><span class="v">'+money(a.turn)+'</span><span class="l">Turnover</span></div>'+
    '<div><span class="v">'+a.femPct.toFixed(0)+'%</span><span class="l">Women-led</span></div></div></div>';
}

/* =================================================================== REGIONS */
function renderRegionList(){
  // count companies, not sector rows — a multi-sector company sits in one region
  const base=uniqueCompanies(getFiltered({ignoreRegion:true})); const counts={};
  base.forEach(c=>{ if(c.region) counts[c.region]=(counts[c.region]||0)+1; });
  const el=$('regionList'); el.innerHTML='';
  ITL1_ORDER.forEach(r=>{ const row=document.createElement('div');
    row.className='region-item'; row.setAttribute('role','button'); row.tabIndex=0;
    row.setAttribute('aria-pressed',S.selRegions.has(r)?'true':'false');
    row.innerHTML='<span>'+esc(regionShort(r))+'</span><span class="cnt">'+nf(counts[r]||0)+'</span>';
    const toggle=()=>{ S.selRegions.has(r)?S.selRegions.delete(r):S.selRegions.add(r); onFilterChange({region:true}); };
    row.addEventListener('click',toggle);
    row.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();} });
    el.appendChild(row);
  });
}
function renderRegionBoundary(){
  if(regionLayer){ map.removeLayer(regionLayer); regionLayer=null; }
  if(!S.regionGeo||!S.selRegions.size) return;
  const accent=getComputedStyle(document.documentElement).getPropertyValue('--accent-ink').trim()||'#0a7a67';
  const feats=S.regionGeo.features.filter(f=>S.selRegions.has(f.properties.ITL121NM));
  regionLayer=L.geoJSON({type:'FeatureCollection',features:feats},{style:()=>({color:accent,weight:1.6,opacity:.9,fill:false}),interactive:false}).addTo(map);
  try{ map.fitBounds(regionLayer.getBounds(),{padding:[40,40]}); }catch(e){}
}

/* =================================================================== ECOSYSTEM */
const ecoIcons={ universities:mkIcon('data/university_marker.png'), infrastructure:mkIcon('data/infra_marker.png'), support:mkIcon('data/support prog_marker.png') };
function renderEco(){
  ecoLayer.clearLayers();
  const mode=$('ecoSelect').value, legend=$('ecoLegend'); legend.innerHTML=''; legend.classList.toggle('show',mode!=='none');
  const wanted=mode==='all'?['universities','infrastructure','support']:(mode==='none'?[]:[mode]);
  const secFilter=S.selSectors.size?S.selSectors:null;
  const labels={universities:'Universities',infrastructure:'Infrastructure',support:'Support programmes'};
  wanted.forEach(kind=>{
    legend.insertAdjacentHTML('beforeend','<div class="row"><img src="'+ecoIcons[kind].options.iconUrl+'" alt="">'+labels[kind]+'</div>');
    (S.eco[kind]||[]).forEach(rec=>{
      // master.json normalises all three ecosystem sources to one shape
      const lat=rec.lat, lng=rec.lng, sector=rec.sector, title=rec.title, site=rec.site, pc=rec.pc;
      if(lat==null||lng==null) return;
      // A support programme often serves several sectors in one cell, so the
      // filter tests the parsed LIST; a single-sector record still works
      // because build_master gives it a one-item list.
      if(secFilter){ const ss=(rec.secs&&rec.secs.length)?rec.secs:(sector?[sector]:[]);
        if(ss.length && !ss.some(x=>secFilter.has(x))) return; }
      let siteHtml=''; if(site){ try{ siteHtml='<div class="row"><span>Website</span><b><a href="'+esc(site)+'" target="_blank" rel="noopener">'+esc(new URL(site).hostname)+'</a></b></div>'; }catch(e){} }
      L.marker([lat,lng],{icon:ecoIcons[kind]}).bindPopup('<div class="popup"><div class="ph">'+esc(title)+'</div>'+
        (sector?'<div class="row"><span>Sector</span><b>'+esc(sector)+'</b></div>':'')+
        (pc?'<div class="row"><span>Postcode</span><b>'+esc(pc)+'</b></div>':'')+siteHtml+'</div>',{maxWidth:260}).addTo(ecoLayer);
    });
  });
}

/* =================================================================== MPs & CONSTITUENCIES
   data/constituencies.json is ~3.4 MB, so it is fetched lazily the first time the
   user switches this section on rather than on every page load.               */
const PARTY_COLORS={ 'Labour':'#D64550','Conservative':'#2F6DB5','Liberal Democrats':'#E8843C',
  'SNP':'#C9A227','Reform':'#17A2B8','Green':'#4C8C4A','Plaid Cymru':'#0e9f86',
  'Sinn Fein':'#2FB380','DUP':'#8E6FCF','Independent':'#6C8693','UUP':'#8E6FCF',
  'SDLP':'#4C8C4A','Alliance':'#C9A227','TUV':'#8E6FCF','Restore':'#9B6A4F' };
const partyColor=p=>PARTY_COLORS[p]||'#6C8693';
/* Official portraits come from the UK Parliament Members API and are attached at
   build time only where the name matches our MP list. If one is missing (or fails
   to load) the <img> removes itself and the party-coloured initials show through. */
function mpAvatar(c, small){
  const initials=(c.mp||'').split(/\s+/).filter(Boolean).map(w=>w[0]).slice(0,2).join('').toUpperCase() || '—';
  return '<span class="mp-avatar'+(small?' sm':'')+'" style="--pc:'+partyColor(c.party)+'">'+
    '<span class="mp-initials">'+esc(initials)+'</span>'+
    // NB: no loading="lazy" here — the avatar is a single on-demand image and lazy
    // loading simply never fired for it inside the detail panel / popup.
    (c.photo?'<img src="'+esc(c.photo)+'" alt="'+esc(c.mp||'')+'" onerror="this.remove()">':'')+
    '</span>';
}
let conLayer=null;

function loadConstituencies(){
  if(S.conData) return Promise.resolve(S.conData);
  if(S._conLoading) return S._conLoading;
  const el=$('conStatus'); if(el) el.textContent='Loading constituencies…';
  S._conLoading=getJSON('data/constituencies.json').then(d=>{
    S.conData=d;
    // companyConstituency is index-aligned to master.companies, and S.all is built
    // from that array in order, so positional indexing is safe here.
    const map=d.companyConstituency||[];
    S.all.forEach((c,i)=>{ c.conIdx=(map[i]==null?-1:map[i]); });
    conPrepareStats();
    if(el) el.textContent='';
    return d;
  }).catch(e=>{ console.error('constituency load failed',e); if(el) el.textContent='Could not load constituency data.'; throw e; });
  return S._conLoading;
}
function conList(){ return (S.conData&&S.conData.constituencies)||[]; }
/* Rank each seat and work out the national sector mix once, so the popup can
   show where a seat sits among the 650 and which sectors it over-indexes on. */
function conPrepareStats(){
  const list=conList();
  list.slice().sort((a,b)=>b.companies-a.companies).forEach((c,i)=>{ c._rank=i+1; });
  S._conCount=list.length;
  const nat={}; let tot=0;
  S.all.forEach(c=>{ nat[c.sector]=(nat[c.sector]||0)+1; tot++; });
  S._natShare={}; Object.keys(nat).forEach(k=>{ S._natShare[k]=nat[k]/tot; });
}
/* Location quotient: a seat's share of a sector divided by the share across
   the whole file -- the UK normally, the region in a region build, since that
   is the only population present to compare against. 2.0x means the sector is
   twice as concentrated here as across that population. Needs at least 3
   companies in the sector so one or two firms can't manufacture a spike. */
function conSpecialisms(c){
  if(!c.sectorCounts || !c.companies || !S._natShare || !S.sectorsRaw) return [];
  const out=[];
  Object.keys(c.sectorCounts).forEach(k=>{
    const n=c.sectorCounts[k]; if(n<3) return;   // 2 firms is too thin to call a specialism
    const name=S.sectorsRaw[+k]; if(!name) return;
    const natShare=S._natShare[name]; if(!natShare) return;
    const lq=(n/c.companies)/natShare;
    if(lq>=1.25) out.push({sector:name, n:n, lq:lq});
  });
  return out.sort((a,b)=>b.lq-a.lq).slice(0,3);
}
function conMatches(c){
  if(S.conMode==='gov' && !c.gov) return false;
  if(S.conParty && c.party!==S.conParty) return false;
  if(S.conQuery){ const q=S.conQuery.toLowerCase();
    if(!((c.name||'').toLowerCase().includes(q) || (c.mp||'').toLowerCase().includes(q) ||
         (c.role||'').toLowerCase().includes(q))) return false; }
  return true;
}
function conShown(){ return S.conMode==='off' ? [] : conList().filter(conMatches); }
/* Seats are filled by PARTY (identity). Scaleup density rides on fill opacity so
   the map still shows where activity is, without a second hue competing with the
   party colour. Selected seat gets a heavier accent outline. */
function conStyle(c, sel){
  const line=document.documentElement.getAttribute('data-theme')==='dark'?'#7fe6d3':'#0a7a67';
  const max=Math.sqrt(Math.max(S._conMax||1,1));
  const dens=Math.sqrt(Math.max(c.companies||0,0))/max;
  const col=partyColor(c.party);
  // Floor the fill high enough that the party hue reads at UK-wide zoom; density
  // then modulates it. A 0.18 floor looked empty on the dark basemap.
  return { color: sel?line:col, weight: sel?3:(c.gov?1.4:0.8), opacity: sel?1:0.9,
           fillColor: col, fillOpacity: sel?0.85:(0.38+0.34*dens) };
}
function conPopup(c){
  const rank=c._rank||0, total=S._conCount||650;
  // floor, not round: #4 of 650 is 99.5% and must not read as "ahead of 100%"
  const pct=total>1 ? Math.floor((total-rank)/(total-1)*100) : 100;
  const spec=conSpecialisms(c);
  const specHtml = spec.length
    ? spec.map(s=>{
        const w=Math.min(100, (s.lq/Math.max(spec[0].lq,1))*100);
        return '<div class="cp-spec-row">'+
          '<span class="cp-spec-name" title="'+nf(s.n)+' of '+nf(c.companies)+' scaleups here">'+swatch(SECTOR_COLORS[s.sector])+esc(s.sector)+'</span>'+
          '<span class="cp-spec-bar"><i style="width:'+w.toFixed(0)+'%;background:'+(SECTOR_COLORS[s.sector]||'#6C8693')+'"></i></span>'+
          '<span class="cp-spec-lq">'+s.lq.toFixed(1)+'×</span></div>'; }).join('')
    : '<div class="cp-none">Sector mix closely matches the '+(scoped()?esc(SCOPE_LABEL):'UK')+' average.</div>';
  return '<div class="popup con-popup">'+
    '<div class="ph">'+esc(c.name)+'</div>'+
    '<div class="cp-mp">'+
      (c.vacant ? '<div class="cp-vacant">Seat vacant</div>'
        : mpAvatar(c,true)+'<div class="cp-mp-tx"><div class="cp-mp-name">'+esc(c.mp||'—')+'</div>'+
          '<div class="cp-mp-sub">'+esc(c.party||'—')+'</div></div>')+
    '</div>'+
    (c.gov?'<div class="cp-role">'+esc(c.role)+'</div>':'')+
    '<div class="cp-rank">'+
      '<div class="cp-rank-top"><b>#'+nf(rank)+'</b> of '+nf(total)+' seats by scaleups'+
        '<span class="cp-pct">ahead of '+pct+'% of seats</span></div>'+
      '<div class="cp-rank-bar"><i style="width:'+pct+'%"></i></div>'+
    '</div>'+
    '<div class="cp-stats">'+
      '<div><b>'+nf(c.companies)+'</b><span>scaleups</span></div>'+
      '<div><b>'+pMoney(c.turnover)+'</b><span>turnover</span></div>'+
      '<div><b>'+pMoney(c.investment)+'</b><span>equity</span></div>'+
    '</div>'+
    '<div class="ph2">Punches above its weight in</div>'+
    '<div class="cp-spec">'+specHtml+'</div>'+
    '<div class="cp-hint">Click to filter the map. Full figures on the right.</div></div>';
}
function renderConstituencies(){
  if(conLayer){ map.removeLayer(conLayer); conLayer=null; }
  const shown=conShown();
  renderConPanel(shown);
  if(!shown.length || !S.conData) return;
  const byCode={}; shown.forEach(c=>{ byCode[c.code]=c; });
  S._conMax=Math.max(...shown.map(c=>c.companies),1);
  conLayer=L.geoJSON(S.conData.geo,{
    filter:f=>!!byCode[f.properties.code],
    style:f=>conStyle(byCode[f.properties.code], S.selCon===f.properties.code),
    onEachFeature:(f,layer)=>{ const c=byCode[f.properties.code];
      layer.bindPopup(conPopup(c),{maxWidth:250});
      layer.on('mouseover',()=>layer.setStyle({weight:2.6,fillOpacity:0.85}));
      layer.on('mouseout',()=>{ if(S.selCon!==c.code) layer.setStyle(conStyle(c,false)); });
      layer.on('click',()=>{ selectConstituency(S.selCon===c.code?null:c.code); });
    }
  }).addTo(map);
  conLayer.bringToBack();
}
function selectConstituency(code){
  S.selCon=code;
  const c=code?conList().find(x=>x.code===code):null;
  S.selConIdx = c ? conList().indexOf(c) : -1;
  if(c && conLayer){
    // zoom to THIS seat, not the whole layer's bounds
    let target=null;
    conLayer.eachLayer(l=>{ if(l.feature && l.feature.properties.code===code) target=l; });
    if(target){ try{ map.fitBounds(target.getBounds().pad(0.35)); }catch(e){} }
  }
  onFilterChange({region:true});
}
/* Which seats are drawn depends only on mode/party/search — never on the company
   filters — so a filter change just restyles rather than rebuilding 650 polygons. */
function styleConSelection(){
  const shown=conShown();
  if(conLayer){
    const byCode={}; shown.forEach(c=>{ byCode[c.code]=c; });
    conLayer.eachLayer(l=>{ const code=l.feature&&l.feature.properties.code, c=byCode[code]; if(!c) return;
      l.setStyle(conStyle(c, S.selCon===code));
    });
  }
  renderConPanel(shown);
}
function renderConPanel(shown){
  const st=$('conSummary'), list=$('conResults');
  if(st){ st.innerHTML = S.conMode==='off' ? ''
    : '<div class="ps-row"><span>Seats shown</span><b>'+nf(shown.length)+' of '+nf(conList().length)+'</b></div>'+
      '<div class="ps-row"><span>Scaleups in them</span><b>'+nf(shown.reduce((a,c)=>a+c.companies,0))+'</b></div>'; }
  const leg=$('conLegend');
  if(leg){
    if(S.conMode==='off'){ leg.innerHTML=''; }
    else {
      const seen={}; shown.forEach(c=>{ const k=c.party||'Vacant'; seen[k]=(seen[k]||0)+1; });
      leg.innerHTML='<div class="cl-title">Fill = party · shade = scaleup density</div>'+
        Object.keys(seen).sort((a,b)=>seen[b]-seen[a]).slice(0,8).map(k=>
          '<span class="cl-item">'+swatch(partyColor(k==='Vacant'?'':k))+esc(k)+'</span>').join('');
    }
  }
  if(!list) return;
  if(S.conMode==='off'){ list.innerHTML=''; return; }
  const top=shown.slice().sort((a,b)=>b.companies-a.companies).slice(0,40);
  list.innerHTML = top.length ? top.map(c=>
    '<div class="con-row'+(S.selCon===c.code?' selected':'')+'" data-code="'+esc(c.code)+'">'+
      '<span class="c-name">'+esc(c.name)+
        '<span class="c-meta"><span class="sw" style="background:'+partyColor(c.party)+'"></span>'+
        esc(c.vacant?'Seat vacant':(c.mp||'—'))+(c.gov?' · <em>Gov</em>':'')+'</span></span>'+
      '<span class="c-val">'+nf(c.companies)+'</span></div>').join('')
    + (shown.length>40?'<div class="proc-empty">Showing the 40 largest of '+nf(shown.length)+'.</div>':'')
    : '<div class="proc-empty">No seats match these filters.</div>';
  list.querySelectorAll('.con-row').forEach(r=>r.addEventListener('click',()=>{
    const code=r.getAttribute('data-code'); selectConstituency(S.selCon===code?null:code); }));
}

/* =================================================================== PRIMES & PROCUREMENT */
const primeIcon=mkIcon('data/prime marker.png'), primeMultiIcon=mkIcon('data/prime multi marker.png'), procIcon=mkIcon('data/procurement marker.png');
let primeLayer=null, procLayer=null;
function pMoney(n){ if(n==null) return 'n/a'; if(n>=1e9) return '£'+(n/1e9).toFixed(1)+'B'; if(n>=1e6) return '£'+(n/1e6).toFixed(1)+'M'; if(n>=1e3) return '£'+(n/1e3).toFixed(0)+'K'; return '£'+Math.round(n); }
/* Is this company inside the current filters?
   The sector test must consider EVERY sector the company sits in. It used to read
   c.sector off the byNum entry, which is just whichever row happened to be written
   last — so a multi-sector company was judged on one arbitrary sector. With
   Advanced Manufacturing selected across the North West + North East that showed 1
   procurement marker instead of 13: the other 12 are genuinely Advanced
   Manufacturing but their byNum row pointed at Wholesale, Defence, Life Sciences
   and so on. Dots, hulls and investor pins all go through getFiltered(), which
   filters per ROW and so matches on any sector — this now agrees with them. */
function companyVisible(id){ const n=normNum(id); const c=S.byNum[n]; if(!c) return false;
  if(S.selSectors.size){ const secs=S.secsByNum[n]; if(!secs) return false;
    let hit=false; secs.forEach(sec=>{ if(S.selSectors.has(sec)) hit=true; });
    if(!hit) return false; }
  if(S.selRegions.size && (!c.region||!S.selRegions.has(c.region))) return false;
  /* Constituency and investor were missing from this test, so a procurement
     marker stayed on the map after the dot underneath it had been filtered
     away -- the layer appeared to ignore the investor rail entirely. Both read
     exactly the state the dots read: S.selConIdx is the row the constituency
     panel picked, and S._invSet is the investor set onFilterChange() has just
     recomputed (recomputed here as a fallback for the procurement-only
     handlers, which do not go through onFilterChange). */
  if(S.selCon!=null && S.selConIdx>=0 && c.conIdx!==S.selConIdx) return false;
  if(investorMode()){ const set=S._invSet||investorCompanySet(); if(!set.has(n)) return false; }
  if(S.femOnly && !c.women) return false;
  if(S.fundAny && !fundedAtAll(c)) return false;
  if(sizeActive() && !sizeOk(c)) return false;
  return true; }

/* ---- Primes: firms with multiple UK offices, plotted per office ---- */
function primeVisible(p){ if(!S.selSectors.size) return true; if(!p.sectors||!p.sectors.length) return false; return p.sectors.some(s=>S.selSectors.has(s)); }
function primeLocVisible(loc){ if(!S.selRegions.size) return true; return loc.itl1 && S.selRegions.has(loc.itl1); }
function primePopup(p,loc){
  return '<div class="popup"><div class="ph">'+esc(p.name)+'</div>'+
    '<div class="row"><span>Company ID</span><b>'+esc(p.id)+'</b></div>'+
    (loc.la?'<div class="row"><span>Town / area</span><b>'+esc(loc.la)+'</b></div>':'')+
    '<div class="row"><span>Employees (office)</span><b>'+(loc.employees!=null?compact(loc.employees):'n/a')+'</b></div>'+
    '<div class="row"><span>Turnover (office)</span><b>'+pMoney(loc.turnover)+'</b></div>'+
    '<div class="row"><span>Sector'+((p.sectors||[]).length>1?'s':'')+'</span><b>'+esc((p.sectors||[]).join(', ')||'n/a')+'</b></div>'+
    // In a region build the locations are pruned to the region and n_offices is
    // reset to match, so quoting a UK total here would be quoting a figure the
    // file no longer holds.
    '<div class="row"><span>'+(scoped()?'Offices in '+esc(SCOPE_LABEL):'Total UK offices')+
      '</span><b>'+nf(p.n_offices||0)+'</b></div></div>';
}
function refreshPrimes(){
  if(primeLayer){ map.removeLayer(primeLayer); primeLayer=null; }
  if(!S.primesOn) return;
  primeLayer=L.layerGroup();
  Object.keys(S.primes).forEach(cid=>{ const p=S.primes[cid]; if(!primeVisible(p)) return;
    const icon=(p.sectors&&p.sectors.length>1)?primeMultiIcon:primeIcon;
    (p.locations||[]).forEach(loc=>{ if(loc.lat==null||loc.lng==null||!primeLocVisible(loc)) return;
      L.marker([loc.lat,loc.lng],{icon:icon}).bindPopup(primePopup(p,loc),{maxWidth:280}).addTo(primeLayer); });
  });
  primeLayer.addTo(map);
}

/* ---- Procurement: scaleups with public-sector contracts, plotted at their location ---- */
/* Buyer categories are derived at build time from each company's top buyers.
   Every buyer in this dataset is a public body — there is no private-sector
   contract data in the source. */
const BUYER_COLORS={ 'Local council':'#0e9f86','NHS / health':'#2F6DB5','Central government':'#8E6FCF',
  'University / education':'#E8843C','Housing association':'#C64B8C','Police / fire':'#D64550',
  'Transport / utilities':'#17A2B8','Other public body':'#6C8693' };
function procMatches(p){
  if(S.procBuyerType && p.buyer_type!==S.procBuyerType) return false;
  if(S.procMinValue && (p.total_value||0) < S.procMinValue) return false;
  if(S.procSme && !p.is_sme) return false;
  if(S.procFramework && !p.on_framework) return false;
  return true;
}
function procPopup(p){
  const bt=p.buyer_type||'Other public body', col=BUYER_COLORS[bt]||'#6C8693';
  const other=p.gov_other_value||0;
  return '<div class="popup"><div class="ph">'+esc(p.name)+'</div>'+
    '<div class="row"><span>Company ID</span><b>'+esc(p.id)+'</b></div>'+
    '<div class="row"><span>Total contract value</span><b>'+pMoney(p.total_value)+'</b></div>'+
    '<div class="row"><span>Contracts</span><b>'+nf(p.n_contracts||0)+'</b></div>'+
    '<div class="row"><span>Main buyer</span><b><span class="sw" style="background:'+col+'"></span>'+esc(bt)+(p.buyer_type_mixed?' <i style="color:var(--faint);font-style:normal">+ others</i>':'')+'</b></div>'+
    '<div class="ph2">Where the money comes from</div>'+
    '<div class="row"><span>Central government</span><b>'+pMoney(p.gov_central_value||0)+'</b></div>'+
    '<div class="row"><span>Local government</span><b>'+pMoney(p.gov_local_value||0)+'</b></div>'+
    '<div class="row"><span>Other public bodies</span><b>'+pMoney(other)+'</b></div>'+
    '<div class="row"><span>On framework</span><b>'+(p.on_framework?'Yes':'No')+'</b></div>'+
    '<div class="row"><span>SME</span><b>'+(p.is_sme?'Yes':'No')+'</b></div>'+
    ((p.top_buyers&&p.top_buyers.length)?'<div class="ph2">Top buyers</div><ul>'+p.top_buyers.slice(0,5).map(b=>'<li>'+esc(b)+'</li>').join('')+'</ul>':'')+
    '</div>';
}
function refreshProcurement(){
  if(procLayer){ map.removeLayer(procLayer); procLayer=null; }
  if(!S.procOn){ renderProcList(); return; }
  procLayer=L.layerGroup();
  Object.keys(S.procurement).forEach(cid=>{ const p=S.procurement[cid];
    if(S.selectedProc && p.id!==S.selectedProc) return;
    if(!procMatches(p)) return;
    if(!companyVisible(p.id)) return;
    const c=S.byNum[normNum(p.id)]; if(!c) return;
    L.marker([c.lat,c.lng],{icon:procIcon}).bindPopup(procPopup(p),{maxWidth:300}).addTo(procLayer);
  });
  procLayer.addTo(map);
  renderProcList();
}
function renderProcList(){
  const panel=$('procurement-list'), body=$('procurement-body'), count=$('procurement-count');
  if(!panel||!body) return;
  if(!S.procOn){ panel.classList.remove('show'); return; }
  panel.classList.toggle('collapsed', !S.procListOpen);
  const cb=$('procurement-collapse');
  if(cb){ cb.textContent=S.procListOpen?'Hide':'Show'; cb.setAttribute('aria-expanded', S.procListOpen?'true':'false'); }
  const all=Object.keys(S.procurement).map(k=>S.procurement[k]);
  const matching=all.filter(procMatches);
  const hasLoc=p=>!!S.byNum[normNum(p.id)];
  // 138 procurement companies are absent from the mapped scaleup population, so
  // they have no coordinates and cannot be plotted. They are still listed (so the
  // count reconciles to the full dataset) but flagged and not selectable. ANY
  // company-level filter hides them: with no record in the scaleup data there is
  // nothing to test them against, and listing them would count them as passing a
  // filter they were never judged by. This used to read sector/region only, so an
  // investor or size filter left all 138 sitting in the list.
  const untestable = hasActiveFilter();
  const mapped=matching.filter(p=>hasLoc(p) && companyVisible(p.id));
  const unmapped=untestable?[]:matching.filter(p=>!hasLoc(p));
  const rows=mapped.concat(unmapped).sort((a,b)=>(b.total_value||0)-(a.total_value||0));
  if(count) count.textContent=nf(rows.length)+' compan'+(rows.length===1?'y':'ies')+(unmapped.length?' · '+nf(mapped.length)+' on map':'');
  body.innerHTML = rows.length ? rows.slice(0,300).map(p=>{
      const bt=p.buyer_type||'Other public body', col=BUYER_COLORS[bt]||'#6C8693', noloc=!hasLoc(p);
      return '<div class="proc-row'+(S.selectedProc===p.id?' selected':'')+(noloc?' no-loc':'')+'" data-id="'+esc(p.id)+'" title="'+esc(bt)+(noloc?', no mapped location':'')+'">'+
        '<span class="p-name">'+esc(p.name)+
          '<span class="p-meta"><span class="sw" style="background:'+col+'"></span>'+esc(bt)+' · '+nf(p.n_contracts||0)+' contract'+((p.n_contracts||0)===1?'':'s')+
          (p.is_sme?' · SME':'')+(noloc?' · <em>not on map</em>':'')+'</span>'+
        '</span><span class="p-val">'+pMoney(p.total_value)+'</span></div>'; }).join('')
    + (rows.length>300?'<div class="proc-empty">Showing the largest 300 of '+nf(rows.length)+'.</div>':'')
    : '<div class="proc-empty">No procurement companies match these filters.</div>';
  renderProcSummary(all, matching, mapped, unmapped);
  panel.classList.add('show');
  body.querySelectorAll('.proc-row:not(.no-loc)').forEach(row=>row.addEventListener('click',()=>{
    const id=row.getAttribute('data-id'); S.selectedProc=(S.selectedProc===id)?null:id; refreshProcurement();
  }));
}
function renderProcSummary(all, matching, mapped, unmapped){
  const el=$('procSummary'); if(!el) return;
  const listed=mapped.concat(unmapped);
  const val=listed.reduce((a,p)=>a+(p.total_value||0),0);
  const contracts=listed.reduce((a,p)=>a+(p.n_contracts||0),0);
  el.innerHTML='<div class="ps-row"><span>Matching filters</span><b>'+nf(listed.length)+' of '+nf(all.length)+'</b></div>'+
    '<div class="ps-row"><span>Plotted on map</span><b>'+nf(mapped.length)+'</b></div>'+
    '<div class="ps-row"><span>Contract value</span><b>'+pMoney(val)+'</b></div>'+
    '<div class="ps-row"><span>Contracts</span><b>'+nf(contracts)+'</b></div>'+
    (unmapped.length?'<div class="ps-note">'+nf(unmapped.length)+' compan'+(unmapped.length===1?'y is':'ies are')+
      ' hold public contracts but have no location on record, so they are counted in the figures above without appearing on the map.</div>':'');
}

/* =================================================================== ORCHESTRATION */
/* TEMPORARY: a bit of fun on the Women-Led filter. The clip is gitignored, so
   if it is not being served the player simply stays hidden rather than showing
   a broken box. Playback is started from the click itself, which is what lets
   it carry sound; if the browser blocks that anyway, it retries muted. */
function femVideo(on){
  const box=$('femVideo'), el=$('femVideoEl');
  if(!box||!el) return;
  if(!on){ box.hidden=true; try{ el.pause(); }catch(e){} return; }
  el.onerror=()=>{ box.hidden=true; };
  box.hidden=false;
  el.currentTime=0;
  const p=el.play();
  if(p&&p.catch) p.catch(()=>{ el.muted=true; el.play().catch(()=>{ box.hidden=true; }); });
}
/* TEMPORARY: ?demo=1 runs the Women-Led sequence on its own, so a screen
   recording can be started and left alone. Browser tooling cannot drive the real
   OS pointer, so this animates a stand-in cursor instead; the click it performs
   is a genuine one, which is also what lets the clip play with sound. */
function runDemo(){
  const btn=$('femBtn'); if(!btn) return;
  const cur=document.createElement('div');
  cur.className='demo-cursor';
  cur.innerHTML='<div class="ring"></div>'+
    '<svg viewBox="0 0 22 22" width="22" height="22"><path d="M3 2l14 7-6 1.6L8.6 17z" '+
    'fill="#fff" stroke="#0C2233" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  document.body.appendChild(cur);
  const move=(x,y,ms)=>new Promise(r=>{ cur.style.transition='opacity .25s ease, transform '+ms+'ms cubic-bezier(.4,0,.2,1)';
    cur.style.transform='translate('+x+'px,'+y+'px)'; setTimeout(r,ms); });
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  (async()=>{
    const start=document.querySelector('.mapwrap').getBoundingClientRect();
    cur.style.transform='translate('+(start.left+start.width*0.55)+'px,'+(start.top+start.height*0.45)+'px)';
    await wait(2200);                      // let the map settle after load
    cur.classList.add('on');
    await wait(500);
    const r=btn.getBoundingClientRect();
    await move(r.left+r.width*0.5, r.top+r.height*0.5, 1400);
    await wait(450);
    cur.classList.add('click');
    btn.click();                           // a real click, so audio is allowed
    await wait(500); cur.classList.remove('click');
    await wait(20000);                     // ~20s of the clip
    cur.classList.remove('on');
    const v=$('femBtn'); if(S.femOnly && v) v.click();
    setTimeout(()=>cur.remove(), 600);
  })();
}
function syncFemBtn(){ const b=$('femBtn'); if(b) b.setAttribute('aria-pressed', S.femOnly?'true':'false'); }
function hasActiveFilter(){ return S.selSectors.size>0 || S.selRegions.size>0 || investorActive() || S.femOnly || S.selCon!=null || S.fundAny || sizeActive(); }
function openDetail(){ S.detailOpen=true; $('detail').classList.add('open'); const t=$('detailToggle'); if(t) t.classList.add('active'); setTimeout(()=>{ try{ map.invalidateSize({pan:false}); }catch(e){} },300); }
function closeDetail(){ S.detailOpen=false; $('detail').classList.remove('open'); const t=$('detailToggle'); if(t) t.classList.remove('active'); setTimeout(()=>{ try{ map.invalidateSize({pan:false}); }catch(e){} },300); }
function onFilterChange(o){ o=o||{};
  S._invSet = investorMode() ? investorCompanySet() : null;
  renderMap(); renderDetail(); renderRegionList(); renderActiveBar(); syncOriginHint();
  if(o.region) renderRegionBoundary(); renderEco();
  if(S.conMode!=='off') styleConSelection();
  refreshPrimes(); refreshProcurement();
  // On-demand right panel: open automatically when a filter is active, unless the
  // user has deliberately closed it; collapse (and reset that intent) when nothing is active.
  if(hasActiveFilter()){ if(!S.detailUserClosed) openDetail(); }
  else { S.detailUserClosed=false; closeDetail(); }
}

/* =================================================================== UI BUILD */
function boot(){
  $('mapLoading').classList.add('hidden');

  // sector chips
  const chips=$('chips');
  S.sectors.forEach(sec=>{ const b=document.createElement('button');
    b.className='chip'; b.setAttribute('aria-pressed','false'); b.dataset.sector=sec;
    b.innerHTML=sectorIcon(sec)+esc(sec);
    b.addEventListener('click',()=>{ b.getAttribute('aria-pressed')==='true'?(S.selSectors.delete(sec),b.setAttribute('aria-pressed','false')):(S.selSectors.add(sec),b.setAttribute('aria-pressed','true')); onFilterChange(); });
    chips.appendChild(b); });
  $('selAll').addEventListener('click',()=>{ S.selSectors=new Set(S.sectors); document.querySelectorAll('.chip').forEach(c=>c.setAttribute('aria-pressed','true')); onFilterChange(); });
  $('selNone').addEventListener('click',()=>{ S.selSectors.clear(); document.querySelectorAll('.chip').forEach(c=>c.setAttribute('aria-pressed','false')); onFilterChange(); });
  // Regions get the same All/Clear pair; renderRegionList (called by onFilterChange)
  // repaints the pressed state, so the rows don't need touching here.
  $('regAll').addEventListener('click',()=>{ S.selRegions=new Set(ITL1_ORDER); onFilterChange({region:true}); });
  $('regNone').addEventListener('click',()=>{ S.selRegions.clear(); onFilterChange({region:true}); });
  const originBtn=$('invOriginBtn');
  if(originBtn) originBtn.addEventListener('click',()=>{ S.invOrigin=!S.invOrigin;
    originBtn.classList.toggle('active',S.invOrigin);
    originBtn.textContent=S.invOrigin?'Colour pins by backing type':'Colour pins by investor origin';
    // This used to switch "all investor-backed" on behind the scenes, so a
    // display control silently changed which companies were on the map. It no
    // longer does; the hint beneath it says what to turn on instead.
    onFilterChange(); });
  const femBtn=$('femBtn'), femKey=$('femKey');
  if(femKey) femKey.style.background=FEM_DOT;
  if(femBtn) femBtn.addEventListener('click',()=>{ S.femOnly=!S.femOnly; syncFemBtn(); femVideo(S.femOnly); onFilterChange(); });
  const fvClose=$('femVideoClose');
  if(fvClose) fvClose.addEventListener('click',()=>femVideo(false));

  // legend
  $('legendRows').innerHTML=S.sectors.map(sec=>'<div class="lrow"><i style="background:'+(SECTOR_COLORS[sec]||NOISE_COLOR)+'"></i>'+esc(sec)+'</div>').join('');
  $('legendToggle').addEventListener('click',()=>{ const l=$('legend'); const c=l.classList.toggle('collapsed'); $('legendToggle').textContent=c?'Show':'Hide'; });

  // display pill
  document.querySelectorAll('.display-pill button').forEach(btn=>btn.addEventListener('click',()=>{ document.querySelectorAll('.display-pill button').forEach(x=>x.removeAttribute('aria-selected')); btn.setAttribute('aria-selected','true'); S.displayMode=btn.dataset.mode; renderMap(); }));

  // ecosystem
  $('ecoSelect').addEventListener('change',renderEco);

  // MPs & constituencies — data is fetched on first use, not at page load
  const conModeSel=$('conMode'), conPartySel=$('conParty'), conSearch=$('conSearch');
  function afterConChange(){
    if(conPartySel && !conPartySel.dataset.filled && S.conData){
      const seen={}; conList().forEach(c=>{ if(c.party) seen[c.party]=(seen[c.party]||0)+1; });
      Object.keys(seen).sort((a,b)=>seen[b]-seen[a]).forEach(pn=>{
        const o=document.createElement('option'); o.value=pn; o.textContent=pn+' ('+seen[pn]+')'; conPartySel.appendChild(o); });
      conPartySel.dataset.filled='1';
    }
    renderConstituencies();
  }
  if(conModeSel) conModeSel.addEventListener('change',()=>{
    S.conMode=conModeSel.value;
    if(S.conMode==='off'){ S.selCon=null; S.selConIdx=-1; renderConstituencies(); onFilterChange({region:true}); return; }
    loadConstituencies().then(afterConChange).catch(()=>{});
  });
  if(conPartySel) conPartySel.addEventListener('change',()=>{ S.conParty=conPartySel.value; renderConstituencies(); });
  if(conSearch) conSearch.addEventListener('input',()=>{ S.conQuery=conSearch.value.trim(); renderConstituencies(); });

  // investor TYPE multiselect (mirrors the category control below)
  const typeCounts={}; S.invNames.forEach(n=>{ const t=(S.enriched[n].type||'').trim(); if(t) typeCounts[t]=(typeCounts[t]||0)+1; });
  const tMenu=$('invTypeMenu');
  tMenu.innerHTML=Object.keys(typeCounts).sort((a,b)=>typeCounts[b]-typeCounts[a])
    .map(t=>'<div class="inv-opt" data-k="'+esc(t)+'"><span class="tick"></span>'+esc(t)+'<span class="devtag">'+nf(typeCounts[t])+'</span></div>').join('');
  tMenu.querySelectorAll('.inv-opt').forEach(opt=>opt.addEventListener('click',()=>{ const k=opt.dataset.k;
    if(S.invTypes.has(k)) S.invTypes.delete(k); else { S.invTypes.add(k); S.selInvestors.clear(); renderInvTags(); }
    syncTypeMenu(); renderTypeField(); onFilterChange(); }));
  $('invTypeField').addEventListener('click',e=>{ if(e.target.classList.contains('x')) return; tMenu.classList.toggle('open'); });
  document.addEventListener('click',e=>{ if(!e.target.closest('#invTypeWrap')) tMenu.classList.remove('open'); });
  renderTypeField();

  // size sliders, the broad funding toggle, and the funding-flag buttons
  wireRange('rngTurn'); wireRange('rngEmp'); wireRange('rngGrow');
  const szReset=$('sizeReset');
  if(szReset) szReset.addEventListener('click',()=>{ resetSize(); onFilterChange(); });
  const fundBtn=$('fundAnyBtn');
  if(fundBtn) fundBtn.addEventListener('click',()=>{ S.fundAny=!S.fundAny; syncFundAnyBtn(); onFilterChange(); });
  renderFlagSeg();

  // one bar listing every active filter, each chip removable
  const abar=$('activeBar');
  if(abar){
    abar.addEventListener('click',e=>{
      const b=e.target.closest('button[data-k]'); if(b) clearFilter(b.dataset.k); });
    makeBarDraggable(abar);
  }
  labelFundingCounts(); syncOriginHint();
  initInfoTips();

  // show every investor-backed company, without picking a specific investor
  const invAllBtn=$('invAllBtn');
  if(invAllBtn) invAllBtn.addEventListener('click',()=>{
    S.invAll=!S.invAll;
    invAllBtn.classList.toggle('active',S.invAll);
    invAllBtn.textContent=S.invAll?'Hide all investor-backed':'Show all investor-backed';
    onFilterChange(); });

  // investor category multiselect
  // Only the investor-driven groups: the three funding flags have their own
  // buttons above, because they pick companies by a different question.
  const menu=$('invCatMenu');
  // Groups that are not built yet are left out entirely rather than listed as
  // "soon": the menu was already long enough to be hard to scan.
  menu.innerHTML=Object.keys(CATS).filter(k=>!CATS[k].flag && !CATS[k].dev).map(k=>
    '<div class="inv-opt" data-k="'+k+'"><span class="tick"></span>'+esc(CATS[k].label)+'</div>').join('');
  menu.querySelectorAll('.inv-opt:not(.dev)').forEach(opt=>opt.addEventListener('click',()=>{ const k=opt.dataset.k;
    if(S.invCats.has(k)){ S.invCats.delete(k); }
    else { S.invCats.add(k); S.selInvestors.clear(); renderInvTags();
           S.invAll=false; syncInvAllBtn(); }
    syncCatMenu(); renderCatField(); onFilterChange(); }));
  $('invCatField').addEventListener('click',e=>{ if(e.target.classList.contains('x')) return; menu.classList.toggle('open'); });
  document.addEventListener('click',e=>{ if(!e.target.closest('.inv-cat')) menu.classList.remove('open'); });

  // investor search
  const inp=$('invSearch'), sug=$('invSuggest');
  inp.addEventListener('input',()=>{ const q=inp.value.trim().toLowerCase(); if(!q){ sug.classList.remove('show'); return; }
    const m=S.invNames.filter(n=>n.toLowerCase().includes(q)&&!S.selInvestors.has(n)).slice(0,25);
    sug.innerHTML=m.map(n=>'<div data-inv="'+esc(n)+'">'+esc(n)+'<span class="c">'+((S.enriched[n].companies||[]).length)+'</span></div>').join('');
    sug.classList.toggle('show',m.length>0); });
  sug.addEventListener('click',e=>{ const d=e.target.closest('div[data-inv]'); if(!d) return;
    S.selInvestors.add(d.getAttribute('data-inv'));
    // A named investor outranks every other investor control, so none of them
    // may stay lit: the type was being shown as active while ignored.
    S.invCats.clear(); renderCatField(); syncCatMenu();
    S.invTypes.clear(); renderTypeField(); syncTypeMenu();
    S.invAll=false; syncInvAllBtn();
    inp.value=''; sug.classList.remove('show'); renderInvTags(); onFilterChange(); });
  document.addEventListener('click',e=>{ if(!e.target.closest('.inv-search-wrap')) sug.classList.remove('show'); });

  renderRegionList();

  // dashboard tabs + filters
  document.querySelectorAll('.dashtabs button[data-tab]').forEach(btn=>btn.addEventListener('click',()=>setTab(btn.dataset.tab)));
  const regs=ITL1_ORDER.slice();
  ['invRegionFilter'].forEach(id=>{ const sel=$(id); if(sel) regs.forEach(r=>{ const o=document.createElement('option'); o.value=r; o.textContent=regionShort(r); sel.appendChild(o); }); });
  buildSecRegionMenu(); renderSecRegionField();
  const srf=$('secRegionField'), srm=$('secRegionMenu');
  if(srf&&srm) srf.addEventListener('click',e=>{ if(e.target.classList.contains('x')) return; srm.classList.toggle('open'); });
  document.addEventListener('click',e=>{ if(srm && !e.target.closest('#secRegionWrap')) srm.classList.remove('open'); });
  ['invSectorFilter','regSectorFilter'].forEach(id=>{ const sel=$(id); if(sel) S.sectors.forEach(sv=>{ const o=document.createElement('option'); o.value=sv; o.textContent=sv; sel.appendChild(o); }); });
  const onDrop=(id,tab,axis)=>{ const el=$(id); if(el) el.addEventListener('change',e=>{ xf(tab)[axis]=e.target.value||null; renderTab(tab); }); };
  onDrop('regSectorFilter','regions','s');
  onDrop('invRegionFilter','investment','r'); onDrop('invSectorFilter','investment','s');
  ['cdScope','cdParty'].forEach(id=>{ const el=$(id); if(el) el.addEventListener('change',renderConstituenciesDash); });
  document.querySelectorAll('#ccMode button').forEach(b=>b.addEventListener('click',()=>{
    if(S.ccMode!==b.dataset.mode){ S.ccMode=b.dataset.mode; renderConCompare(); } }));
  const ccS=$('ccSearch');
  if(ccS){ ccS.addEventListener('input',ccSuggest);
    document.addEventListener('click',e=>{ if(!e.target.closest('#ccSearchWrap')) $('ccSuggest').classList.remove('show'); }); }
  document.querySelectorAll('#anCompareMode button').forEach(b=>b.addEventListener('click',()=>{ if(S.compareMode!==b.dataset.mode){ S.compareMode=b.dataset.mode; renderAnalysis(); } }));
  setTab('map');

  // theme
  $('themeToggle').addEventListener('click',()=>applyTheme(document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark'));

  // export
  $('exportBtn').addEventListener('click',()=>{ if(S.tab==='map') exportMapPNG(); else exportTabPDF(S.tab); });

  // export helpers
  function exportMapPNG(){ if(typeof leafletImage!=='function'){ alert('Export unavailable in this browser.'); return; }
    const btn=$('exportBtn'); btn.disabled=true;
    leafletImage(map,(err,canvas)=>{ btn.disabled=false; if(err||!canvas){ alert('Could not export. Some map tiles block image capture.'); return; }
      try{ canvas.getContext('2d').drawImage(dotLayer._canvas,0,0); }catch(e){}
      try{ const a=document.createElement('a'); a.download='uk-scaleup-cluster-map.png'; a.href=canvas.toDataURL('image/png'); a.click(); }catch(e){ alert('Could not export. Some map tiles block image capture.'); } }); }
  function exportTabPDF(tab){ const pane=$('tab-'+tab); if(!pane) return;
    if(typeof html2canvas!=='function' || !window.jspdf){ alert('PDF export libraries are still loading. Try again in a moment.'); return; }
    const btn=$('exportBtn'), old=btn.innerHTML; btn.disabled=true; btn.innerHTML='Exporting…';
    const bg=cssVar('--bg','#ffffff');
    html2canvas(pane,{backgroundColor:bg, scale:2, useCORS:true, windowWidth:pane.scrollWidth, windowHeight:pane.scrollHeight}).then(canvas=>{
      const { jsPDF }=window.jspdf; const pdf=new jsPDF({orientation:'p', unit:'pt', format:'a4'});
      const pw=pdf.internal.pageSize.getWidth(), ph=pdf.internal.pageSize.getHeight(), m=24;
      let iw=pw-m*2, ih=iw*canvas.height/canvas.width;
      if(ih>ph-m*2){ ih=ph-m*2; iw=ih*canvas.width/canvas.height; }
      pdf.setFontSize(14); pdf.text('UK Scaleup Map: '+tab.charAt(0).toUpperCase()+tab.slice(1), m, 18);
      pdf.addImage(canvas.toDataURL('image/png'),'PNG',(pw-iw)/2, m, iw, ih);
      pdf.save('uk-scaleup-'+tab+'.pdf'); btn.disabled=false; btn.innerHTML=old;
    }).catch(e=>{ console.error(e); alert('Could not export this tab.'); btn.disabled=false; btn.innerHTML=old; });
  }

  // detail reset
  $('detailReset').addEventListener('click',resetAllFilters);

  // primes / procurement toggles
  const primesBtn=$('primesBtn');
  if(primesBtn) primesBtn.addEventListener('click',()=>{ S.primesOn=!S.primesOn;
    primesBtn.classList.toggle('active',S.primesOn); primesBtn.textContent=S.primesOn?'Hide Primes':'Show Primes';
    const lg=$('primes-legend'); if(lg) lg.style.display=S.primesOn?'block':'none'; syncMarkerLegend(); refreshPrimes(); });
  const procBtn=$('procurementBtn');
  function setProc(on){ S.procOn=on; if(!on) S.selectedProc=null;
    // Re-enabling procurement always brings the list back, so a previous collapse
    // doesn't leave the panel looking empty.
    if(on) S.procListOpen=true;
    if(procBtn){ procBtn.classList.toggle('active',on); procBtn.textContent=on?'Hide Procurement':'Show Procurement'; }
    const lg=$('procurement-legend'); if(lg) lg.style.display=on?'block':'none'; syncMarkerLegend();
    const pf=$('procFilters'); if(pf) pf.hidden=!on;
    refreshProcurement(); }
  if(procBtn) procBtn.addEventListener('click',()=>setProc(!S.procOn));

  // procurement filters — buyer type options come from the data itself
  const btSel=$('procBuyerType');
  if(btSel){ const cats={}; Object.keys(S.procurement).forEach(k=>{ const t=S.procurement[k].buyer_type||'Other public body'; cats[t]=(cats[t]||0)+1; });
    Object.keys(cats).sort((a,b)=>cats[b]-cats[a]).forEach(t=>{ const o=document.createElement('option'); o.value=t; o.textContent=t+' ('+cats[t]+')'; btSel.appendChild(o); }); }
  const applyProcFilters=()=>{
    S.procBuyerType=btSel?btSel.value:'';
    const mv=$('procMinValue'); S.procMinValue=mv?+mv.value||0:0;
    const sme=$('procSme'); S.procSme=!!(sme&&sme.checked);
    const fw=$('procFramework'); S.procFramework=!!(fw&&fw.checked);
    S.selectedProc=null; refreshProcurement();
  };
  ['procBuyerType','procMinValue','procSme','procFramework'].forEach(id=>{ const el=$(id); if(el) el.addEventListener('change',applyProcFilters); });
  // Collapses the list only — the markers, legend and rail button are untouched.
  // Turning procurement off entirely is the rail button's job.
  const procCollapse=$('procurement-collapse');
  if(procCollapse) procCollapse.addEventListener('click',(e)=>{ e.stopPropagation();
    S.procListOpen=!S.procListOpen; renderProcList(); });

  // accordions (collapsible rail sections)
  document.querySelectorAll('.sec-toggle').forEach(btn=>btn.addEventListener('click',()=>{ const s=btn.closest('.rail-sec'); if(s) s.classList.toggle('collapsed'); }));

  // on-demand detail panel
  const dt=$('detailToggle');
  if(dt) dt.addEventListener('click',()=>{ if(S.detailOpen){ closeDetail(); S.detailUserClosed=hasActiveFilter(); } else { openDetail(); S.detailUserClosed=false; } });
  const dc=$('detailCollapse');
  if(dc) dc.addEventListener('click',()=>{ closeDetail(); S.detailUserClosed=hasActiveFilter(); });

  // help + methodology
  $('helpBtn').addEventListener('click',()=>$('helpOverlay').classList.add('show'));
  $('helpClose').addEventListener('click',()=>$('helpOverlay').classList.remove('show'));
  $('helpGotIt').addEventListener('click',()=>$('helpOverlay').classList.remove('show'));
  $('helpOverlay').addEventListener('click',e=>{ if(e.target===$('helpOverlay')) $('helpOverlay').classList.remove('show'); });
  $('methodBtn').addEventListener('click',()=>{ const c=$('methodContent'); c.hidden=!c.hidden; });

  onFilterChange();
}

function renderInvTags(){ $('invSelected').innerHTML=[...S.selInvestors].map(n=>'<span class="inv-tag">'+esc(n)+'<span class="x" data-inv="'+esc(n)+'">×</span></span>').join('');
  $('invSelected').querySelectorAll('.x').forEach(x=>x.addEventListener('click',()=>{ S.selInvestors.delete(x.getAttribute('data-inv')); renderInvTags(); onFilterChange(); })); }
function renderCatField(){ const f=$('invCatField'); const sel=[...S.invCats].filter(k=>CATS[k]&&!CATS[k].flag);
  if(!sel.length){ f.innerHTML='<span class="ph">Any investor group…</span>'; return; }
  f.innerHTML=sel.map(k=>'<span class="token">'+esc(CATS[k].label)+'<span class="x" data-k="'+k+'">×</span></span>').join('');
  f.querySelectorAll('.x').forEach(x=>x.addEventListener('click',ev=>{ ev.stopPropagation(); S.invCats.delete(x.dataset.k); syncCatMenu(); renderCatField(); onFilterChange(); })); }
function renderTypeField(){ const f=$('invTypeField'); if(!f) return; const sel=[...S.invTypes];
  if(!sel.length){ f.innerHTML='<span class="ph">All investor types…</span>'; return; }
  f.innerHTML=sel.map(t=>'<span class="token">'+esc(t)+'<span class="x" data-k="'+esc(t)+'">×</span></span>').join('');
  f.querySelectorAll('.x').forEach(x=>x.addEventListener('click',ev=>{ ev.stopPropagation();
    S.invTypes.delete(x.dataset.k); syncTypeMenu(); renderTypeField(); onFilterChange(); })); }
function syncTypeMenu(){ document.querySelectorAll('#invTypeMenu .inv-opt').forEach(opt=>{
  const on=S.invTypes.has(opt.dataset.k); opt.classList.toggle('sel',on);
  const t=opt.querySelector('.tick'); if(t) t.textContent=on?'✓':''; }); }
function syncCatMenu(){ document.querySelectorAll('#invCatMenu .inv-opt').forEach(opt=>{ const on=S.invCats.has(opt.dataset.k); opt.classList.toggle('sel',on); const t=opt.querySelector('.tick'); if(t) t.textContent=on?'✓':''; }); }

/* =========================================================================
   DASHBOARD (Chart.js powered)
   ========================================================================= */
if(typeof Chart!=='undefined'){ Chart.defaults.font.family="Inter, system-ui, sans-serif"; Chart.defaults.font.size=11; }
const CHARTS={};
const CAT_PALETTE=['#2F6DB5','#0e9f86','#E8843C','#8E6FCF','#C64B8C','#4C8C4A','#17A2B8','#D64550','#B0894B','#7BAF3A','#6C8693','#2FB380','#9aa7b3','#c98a2b'];
function cssVar(n,f){ const v=getComputedStyle(document.documentElement).getPropertyValue(n).trim(); return v||f; }
function destroyChart(id){ if(CHARTS[id]){ CHARTS[id].destroy(); delete CHARTS[id]; } }
function drawChart(id,cfg){ const el=$(id); if(!el||typeof Chart==='undefined') return; destroyChart(id); CHARTS[id]=new Chart(el,cfg); }
function hBar(id,labels,data,colors,fmt,onPick){ const text=cssVar('--muted','#5f7688'), grid=cssVar('--line','#dbe3e9'), tip=cssVar('--ink','#0c2233');
  drawChart(id,{ type:'bar', data:{labels,datasets:[{data,backgroundColor:colors,borderRadius:5,maxBarThickness:20}]},
    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, animation:{duration:500},
      onClick:(e,els)=>{ if(onPick&&els&&els.length) onPick(els[0].index); },
      onHover:(e,els)=>{ const t=e&&e.native&&e.native.target; if(t) t.style.cursor=(onPick&&els.length)?'pointer':'default'; },
      plugins:{ legend:{display:false}, tooltip:{ backgroundColor:tip, padding:10, cornerRadius:8, callbacks:{ label:c=>' '+(fmt?fmt(c.parsed.x):nf(c.parsed.x)) } } },
      scales:{ x:{ ticks:{color:text, callback:v=>fmt?fmt(v):nf(v)}, grid:{color:grid} }, y:{ ticks:{color:text}, grid:{display:false} } } } }); }
function doughnut(id,labels,data,colors,fmt,onPick){ const text=cssVar('--muted','#5f7688'), tip=cssVar('--ink','#0c2233'), surf=cssVar('--surface','#fff');
  drawChart(id,{ type:'doughnut', data:{labels,datasets:[{data,backgroundColor:colors,borderWidth:2,borderColor:surf}]},
    options:{ responsive:true, maintainAspectRatio:false, cutout:'62%', animation:{duration:500},
      onClick:(e,els)=>{ if(onPick&&els&&els.length) onPick(els[0].index); },
      onHover:(e,els)=>{ const t=e&&e.native&&e.native.target; if(t) t.style.cursor=(onPick&&els.length)?'pointer':'default'; },
      plugins:{ legend:{position:'right', labels:{color:text, boxWidth:10, boxHeight:10, padding:8}},
        tooltip:{ backgroundColor:tip, padding:10, cornerRadius:8, callbacks:{ label:c=>' '+c.label+': '+(fmt?fmt(c.parsed):nf(c.parsed)) } } } } }); }
function miniDoughnut(id,labels,data,colors,fmt){ const text=cssVar('--muted','#5f7688'), tip=cssVar('--ink','#0c2233'), surf=cssVar('--surface','#fff');
  drawChart(id,{ type:'doughnut', data:{labels,datasets:[{data,backgroundColor:colors,borderWidth:2,borderColor:surf}]},
    options:{ responsive:true, maintainAspectRatio:false, cutout:'58%', animation:{duration:400},
      plugins:{ legend:{position:'bottom', labels:{color:text, boxWidth:9, boxHeight:9, padding:7, font:{size:10.5}}},
        tooltip:{ backgroundColor:tip, padding:9, cornerRadius:7, callbacks:{ label:c=>' '+c.label+': '+(fmt?fmt(c.parsed):nf(c.parsed)) } } } } }); }

/* Counts each company at most once per group. Grouping by sector is naturally
   unique, but grouping by region is not: a company in three sectors appears as
   three rows in the same region and would otherwise be counted three times. */
function aggBy(list,keyFn){ const m={}, seen={};
  list.forEach(c=>{ const k=keyFn(c); if(k==null) return;
    const o=m[k]||(m[k]={n:0,emp:0,turn:0,inv:0,fund:0,iuk:0,women:0});
    const guard=seen[k]||(seen[k]=new Set());
    if(c.num){ if(guard.has(c.num)) return; guard.add(c.num); }
    o.n++; o.emp+=c.employees; o.turn+=c.turnover; o.inv+=c.investment; o.fund+=c.funding; o.iuk+=c.iuk; if(c.women)o.women++; });
  return m; }
const aggBySector=list=>aggBy(list,c=>c.sector);
const aggByRegion=list=>aggBy(list,c=>c.region);
function mapVal(obj,fn){ const o={}; Object.keys(obj).forEach(k=>o[k]=fn(obj[k])); return o; }
function topEntries(obj,n){ return Object.keys(obj).map(k=>[k,obj[k]]).sort((a,b)=>b[1]-a[1]).slice(0,n); }
function dashList(regionVal,sectorVal){ return S.all.filter(c=>{ if(regionVal&&c.region!==regionVal) return false; if(sectorVal&&c.sector!==sectorVal) return false; return true; }); }
/* ---- the little i beside a heading ----------------------------------------
   One floating panel, reused by every i, shown while the pointer is on the
   button or on the panel itself. It sits to the RIGHT of the button, so in the
   rail it opens over the map rather than pushing the controls down; near the
   right edge of the window it flips to the left instead. The source text stays
   in the page, hidden and wired by aria-controls, so a screen reader still
   reaches it and the panel can be rebuilt from it every time. */
function initInfoTips(){
  const btns=[...document.querySelectorAll('.info-btn')];
  if(!btns.length) return;
  let pop=$('infoPop');
  if(!pop){ pop=document.createElement('div'); pop.id='infoPop';
    pop.className='info-pop'; pop.setAttribute('role','tooltip'); pop.hidden=true;
    document.body.appendChild(pop); }
  let open=null, timer=null;
  const cancel=()=>{ if(timer){ clearTimeout(timer); timer=null; } };

  function place(btn){
    const r=btn.getBoundingClientRect(), gap=10, pad=12;
    pop.style.maxWidth=Math.min(300, window.innerWidth-2*pad)+'px';
    pop.style.left='0px'; pop.style.top='0px';          // measure unclamped
    const w=pop.offsetWidth, h=pop.offsetHeight;
    let x=r.right+gap;
    if(x+w>window.innerWidth-pad) x=Math.max(pad, r.left-gap-w);
    let y=r.top+r.height/2-h/2;
    y=Math.max(pad, Math.min(y, window.innerHeight-pad-h));
    pop.style.left=Math.round(x)+'px'; pop.style.top=Math.round(y)+'px';
  }
  function show(btn){
    cancel();
    const src=$(btn.getAttribute('aria-controls')); if(!src) return;
    if(open && open!==btn){ open.classList.remove('on'); open.setAttribute('aria-expanded','false'); }
    pop.innerHTML=src.innerHTML; pop.hidden=false;
    btn.classList.add('on'); btn.setAttribute('aria-expanded','true');
    open=btn; place(btn);
  }
  function hide(now){
    cancel();
    timer=setTimeout(()=>{ pop.hidden=true;
      if(open){ open.classList.remove('on'); open.setAttribute('aria-expanded','false'); }
      open=null; }, now?0:140);
  }
  btns.forEach(b=>{
    b.addEventListener('mouseenter',()=>show(b));
    b.addEventListener('focus',()=>show(b));
    b.addEventListener('mouseleave',()=>hide());
    b.addEventListener('blur',()=>hide(true));
    // a tap has no hover, so keep the click working on touch
    b.addEventListener('click',e=>{ e.stopPropagation();
      if(open===b && !pop.hidden) hide(true); else show(b); });
  });
  pop.addEventListener('mouseenter',cancel);
  pop.addEventListener('mouseleave',()=>hide());
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') hide(true); });
  /* The panel is positioned against the window, so it has to follow the button
     when anything scrolls. Closing on scroll instead would dismiss it whenever
     the rail still had a little momentum left from the scroll that brought the
     button into view. */
  const follow=()=>{ if(!open) return;
    const r=open.getBoundingClientRect();
    if(r.bottom<0 || r.top>window.innerHeight) hide(true); else place(open); };
  window.addEventListener('scroll',follow,true);
  window.addEventListener('resize',follow);
}
function kpiCard(v,l,s){ return '<div class="kpi"><div class="kpi-v">'+v+'</div><div class="kpi-l">'+esc(l)+'</div>'+(s?'<div class="kpi-s">'+esc(s)+'</div>':'')+'</div>'; }
const ICONS={
  building:'<rect x="5" y="3" width="14" height="18" rx="1.2"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>',
  pin:'<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.4"/>',
  coins:'<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
  spark:'<path d="M12 3v3.5M12 17.5V21M3 12h3.5M17.5 12H21M6 6l2.4 2.4M15.6 15.6 18 18M18 6l-2.4 2.4M8.4 15.6 6 18"/>',
  female:'<circle cx="12" cy="8" r="4.6"/><path d="M12 12.6V21M9 18h6"/>',
  grant:'<path d="M4 5h16v11H4zM4 20h16"/><circle cx="12" cy="10.5" r="2.6"/>',
  users:'<circle cx="9" cy="8" r="3.2"/><path d="M2.8 19.5a6.2 6.2 0 0 1 12.4 0M15.5 5.2a3.3 3.3 0 0 1 0 6.5M18.5 19.5a6.2 6.2 0 0 0-2.8-5.2"/>'
};
function insightCard(icon,label,value,sub,color){ return '<div class="ins-card" style="--c:'+(color||'var(--accent)')+'">'+
  '<div class="ins-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(ICONS[icon]||ICONS.spark)+'</svg></div>'+
  '<div class="ins-tx"><div class="ins-label">'+esc(label)+'</div><div class="ins-value" title="'+esc(String(value))+'">'+esc(String(value))+'</div>'+(sub?'<div class="ins-sub">'+esc(sub)+'</div>':'')+'</div></div>'; }
function bestOf(entries, sel){ let best=null,bv=-Infinity; entries.forEach(e=>{ const v=sel(e.o); if(v>bv){bv=v;best=e;} }); return best; }
function swatch(c){ return '<span class="sw" style="background:'+(c||'#888')+'"></span>'; }
function dtable(head,rows){ return '<table class="dtable"><thead><tr>'+head.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+
  rows.map(r=>'<tr>'+r.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('')+'</tbody></table>'; }
const SORTS={};
function renderSortable(id, columns, data, def){ const el=$(id); if(!el) return;
  const st=SORTS[id]||(SORTS[id]=Object.assign({col:0,dir:'desc'},def||{}));
  const c=columns[st.col]||columns[0], dir=st.dir==='asc'?1:-1;
  const rows=data.slice().sort((a,b)=>{ let x=c.sort(a), y=c.sort(b); if(typeof x==='string'||typeof y==='string'){ return String(x).localeCompare(String(y))*dir; } return ((x||0)-(y||0))*dir; });
  const thead='<tr>'+columns.map((col,i)=>{ const a=i===st.col, ar=a?(st.dir==='asc'?'▲':'▼'):''; return '<th class="'+(col.align==='left'?'l':'r')+(a?' active':'')+'" data-i="'+i+'" title="Sort by '+esc(col.label)+'">'+esc(col.label)+'<span class="sar">'+ar+'</span></th>'; }).join('')+'</tr>';
  const body=rows.map(r=>'<tr>'+columns.map(col=>'<td class="'+(col.align==='left'?'l':'r')+'">'+col.html(r)+'</td>').join('')+'</tr>').join('');
  el.innerHTML='<table class="dtable sortable"><thead>'+thead+'</thead><tbody>'+body+'</tbody></table>';
  el.querySelectorAll('th').forEach(th=>th.addEventListener('click',()=>{ const i=+th.dataset.i;
    if(st.col===i){ st.dir=st.dir==='asc'?'desc':'asc'; } else { st.col=i; st.dir=columns[i].align==='left'?'asc':'desc'; }
    renderSortable(id,columns,data); }));
}

/* ---- tab switching ---- */
function setTab(t){ S.tab=t;
  document.querySelectorAll('.dashtabs button[data-tab]').forEach(b=>{ if(b.dataset.tab===t) b.setAttribute('aria-selected','true'); else b.removeAttribute('aria-selected'); });
  document.querySelectorAll('.tabpane').forEach(p=>{ p.hidden = (p.id!=='tab-'+t); });
  ['detailToggle','helpBtn'].forEach(id=>{ const el=$(id); if(el) el.style.display=(t==='map')?'':'none'; });
  const eb=$('exportBtn'), ebl=eb&&eb.querySelector('span'); if(ebl) ebl.textContent=(t==='map')?'Export':'Export PDF';
  if(eb) eb.title=(t==='map')?'Download the current map as an image':'Download this dashboard tab as a PDF';
  if(t==='map') setTimeout(()=>{ try{ map.invalidateSize({pan:false}); if(!S._mapFitted){ map.fitBounds(UK_BOUNDS); S._mapFitted=true; } }catch(e){} },70);
  renderTab(t);
}
function renderTab(t){ if(t==='overview') renderOverview(); else if(t==='sectors') renderSectorsDash();
  else if(t==='regions') renderRegionsDash(); else if(t==='constituencies') renderConstituenciesDash();
  else if(t==='investment') renderInvestmentDash();
  else if(t==='analysis') renderAnalysis();
  else if(t==='public') renderPublicDash(); }

/* ---- cross-filter focus ---- */
function xf(t){ return S.focus[t]||(S.focus[t]={s:null,r:null}); }
/* A dashboard tab's region focus used to be one region or none. The Sectors tab
   now takes several at once, so the focus field holds an ARRAY there while the
   other tabs still hold a plain string. Everything that reads it goes through
   here rather than touching f.r, so neither shape has to know about the other. */
function focusRegions(f){
  if(!f || !f.r) return [];
  return Array.isArray(f.r) ? f.r.slice() : [f.r];
}
function setFocusRegions(f, list){ f.r = list && list.length ? list.slice() : null; }
/* ---- the Sectors tab's multi-region control ----
   Built from the same field/menu pieces as the investor-group picker in the
   rail, so it behaves the way the one multi-select already in the tool does. */
function buildSecRegionMenu(){
  const menu=$('secRegionMenu'); if(!menu) return;
  menu.innerHTML=ITL1_ORDER.filter(r=>S.all.some(c=>c.region===r)).map(r=>
    '<div class="inv-opt" data-k="'+esc(r)+'"><span class="tick"></span>'+esc(regionShort(r))+'</div>').join('');
  menu.querySelectorAll('.inv-opt').forEach(opt=>opt.addEventListener('click',()=>{
    const f=xf('sectors'), cur=focusRegions(f), r=opt.dataset.k;
    setFocusRegions(f, cur.includes(r) ? cur.filter(x=>x!==r) : cur.concat([r]));
    syncSecRegionMenu(); renderSecRegionField(); focusTab('sectors');
  }));
  syncSecRegionMenu();
}
function syncSecRegionMenu(){
  const sel=focusRegions(xf('sectors'));
  document.querySelectorAll('#secRegionMenu .inv-opt').forEach(opt=>{
    const on=sel.includes(opt.dataset.k); opt.classList.toggle('sel',on);
    const t=opt.querySelector('.tick'); if(t) t.textContent=on?'✓':'';
  });
}
function renderSecRegionField(){
  const el=$('secRegionField'); if(!el) return;
  const sel=focusRegions(xf('sectors'));
  if(!sel.length){ el.innerHTML='<span class="ph">All regions…</span>'; return; }
  el.innerHTML=sel.map(r=>'<span class="token">'+esc(regionShort(r))+
    '<span class="x" data-k="'+esc(r)+'">×</span></span>').join('');
  el.querySelectorAll('.x').forEach(x=>x.addEventListener('click',ev=>{ ev.stopPropagation();
    const f=xf('sectors');
    setFocusRegions(f, focusRegions(f).filter(r=>r!==x.dataset.k));
    syncSecRegionMenu(); renderSecRegionField(); focusTab('sectors'); }));
}

function fade(c){ try{ return chroma(c).alpha(0.22).css(); }catch(e){ return c; } }
function hlColors(keys,colorFn,focusVal){ return keys.map(k=> (!focusVal||k===focusVal)?colorFn(k):fade(colorFn(k))); }
function fLists(f){
  const R=focusRegions(f), inR = R.length ? (c=>R.indexOf(c.region)>=0) : (()=>true);
  return {
    s: S.all.filter(inR),
    r: S.all.filter(c=> !f.s || c.sector===f.s),
    k: S.all.filter(c=> inR(c) && (!f.s||c.sector===f.s)) }; }
function syncDrop(tab){ const f=xf(tab), m={ regions:{s:'regSectorFilter'}, investment:{r:'invRegionFilter',s:'invSectorFilter'} }[tab]||{};
  if(tab==='sectors'){ syncSecRegionMenu(); renderSecRegionField(); }
  if(m.r){ const e=$(m.r); if(e) e.value=f.r||''; } if(m.s){ const e=$(m.s); if(e) e.value=f.s||''; } }
function focusTab(tab){ syncDrop(tab); renderTab(tab); }
function applyFocusToMap(f){ S.selSectors=new Set(f.s?[f.s]:[]); S.selRegions=new Set(focusRegions(f));
  document.querySelectorAll('#chips .chip').forEach(ch=>ch.setAttribute('aria-pressed',(f.s&&ch.dataset.sector===f.s)?'true':'false'));
  onFilterChange({region:true}); setTab('map'); }
function renderChips(tab){ const f=xf(tab), el=$(tab+'Active'); if(!el) return; let html='';
  if(f.s) html+='<span class="dchip">'+esc(f.s)+'<span class="x" data-c="s">×</span></span>';
  const fr=focusRegions(f);
  fr.forEach(r=>{ html+='<span class="dchip">'+esc(regionShort(r))+
    '<span class="x" data-c="r" data-r="'+esc(r)+'">×</span></span>'; });
  html+= (f.s||fr.length) ? '<button class="dchip-map" data-map="1">View on map ↗</button>' : '<span class="dchip-hint">Tip: click a bar or segment to filter this tab</span>';
  el.innerHTML=html;
  el.querySelectorAll('.x').forEach(x=>x.addEventListener('click',()=>{
    // A region chip clears only its own region; everything else clears the field.
    if(x.dataset.c==='r' && x.dataset.r) setFocusRegions(f, focusRegions(f).filter(r=>r!==x.dataset.r));
    else f[x.dataset.c]=null;
    focusTab(tab); }));
  const mb=el.querySelector('[data-map]'); if(mb) mb.addEventListener('click',()=>applyFocusToMap(f));
}

/* ---- Overview ---- */
function renderOverview(){ const f=xf('overview'), L=fLists(f), s=aggregate(L.k);
  $('ovKpis').innerHTML = kpiCard(nf(s.n),'Companies') + kpiCard(compact(s.emp),'Employees') + kpiCard(money(s.turn),'Turnover') +
    kpiCard(money(s.inv),'Equity raised') + kpiCard(money(s.iuk),'Innovate UK grant') + kpiCard(s.femPct.toFixed(1)+'%','Women-led');
  const bySec=aggBySector(L.s); const secK=S.sectors.filter(k=>bySec[k]);
  doughnut('ovSectorDoughnut', secK, secK.map(k=>bySec[k].n), hlColors(secK,k=>SECTOR_COLORS[k]||'#888',f.s), nf, i=>{ f.s=(f.s===secK[i]?null:secK[i]); focusTab('overview'); });
  const regRows=topEntries(mapVal(aggByRegion(L.r),o=>o.n),12), regKeys=regRows.map(r=>r[0]);
  hBar('ovRegionBar', regKeys.map(regionShort), regRows.map(r=>r[1]), hlColors(regKeys,()=>'#0e9f86',f.r), nf, i=>{ f.r=(f.r===regKeys[i]?null:regKeys[i]); focusTab('overview'); });
  const invCount={}; uniqueCompanies(L.k).forEach(c=>c.investors.forEach(iv=>invCount[iv]=(invCount[iv]||0)+1)); const invTop=topEntries(invCount,8);
  hBar('ovInvBar', invTop.map(r=>r[0]), invTop.map(r=>r[1]), '#2F6DB5', nf);
  const femRows=secK.map(k=>[k, bySec[k].n?bySec[k].women/bySec[k].n*100:0]).sort((a,b)=>b[1]-a[1]), femKeys=femRows.map(r=>r[0]);
  hBar('ovFemBar', femKeys, femRows.map(r=>r[1]), hlColors(femKeys,k=>SECTOR_COLORS[k]||'#888',f.s), v=>v.toFixed(0)+'%', i=>{ f.s=(f.s===femKeys[i]?null:femKeys[i]); focusTab('overview'); });
  const kbSec=aggBySector(L.k), kbReg=aggByRegion(L.k);
  const secEnt=Object.keys(kbSec).map(k=>({k,o:kbSec[k]})), regEnt=Object.keys(kbReg).map(k=>({k,o:kbReg[k]}));
  const tSecN=bestOf(secEnt,o=>o.n), tSecInv=bestOf(secEnt,o=>o.inv), tRegN=bestOf(regEnt,o=>o.n), tInv=topEntries(invCount,1)[0];
  $('ovInsights').innerHTML =
    insightCard('building','Leading sector', tSecN?tSecN.k:'—', tSecN?nf(tSecN.o.n)+' companies · '+(s.n?(tSecN.o.n/s.n*100).toFixed(0):0)+'% of all':'', tSecN?SECTOR_COLORS[tSecN.k]:null) +
    /* A region build has one region, so naming its leading region says
       nothing. Same reason the by-region charts and the Regions tab are gone. */
    (scoped() ? '' :
      insightCard('pin','Top region', tRegN?regionShort(tRegN.k):'—', tRegN?nf(tRegN.o.n)+' companies':'', '#0e9f86')) +
    insightCard('coins','Best-funded sector', tSecInv?tSecInv.k:'—', tSecInv?money(tSecInv.o.inv)+' equity raised':'', tSecInv?SECTOR_COLORS[tSecInv.k]:null) +
    insightCard('spark','Most active investor', tInv?tInv[0]:'—', tInv?nf(tInv[1])+' companies backed':'', '#2F6DB5');
  renderChips('overview');
}

/* ---- Sectors ---- */
function renderSectorsDash(){ const f=xf('sectors'), L=fLists(f), s=aggregate(L.k);
  $('secKpis').innerHTML = kpiCard(nf(s.n),'Companies') + kpiCard(compact(s.emp),'Employees') + kpiCard(money(s.turn),'Turnover') + kpiCard(s.femPct.toFixed(1)+'%','Women-led');
  const bySec=aggBySector(L.s); const keys=S.sectors.filter(k=>bySec[k]);
  const chart=(cid,sel,fmt)=>{ const rows=keys.map(k=>[k,sel(bySec[k])]).sort((a,b)=>b[1]-a[1]), kk=rows.map(r=>r[0]);
    hBar(cid, kk, rows.map(r=>r[1]), hlColors(kk,k=>SECTOR_COLORS[k]||'#888',f.s), fmt, i=>{ f.s=(f.s===kk[i]?null:kk[i]); focusTab('sectors'); }); };
  chart('secCompanies',x=>x.n,nf); chart('secTurnover',x=>x.turn,money); chart('secEmployees',x=>x.emp,compact); chart('secInvestment',x=>x.inv,money);
  const kb=aggBySector(L.k);
  renderSortable('secTable',[
    {label:'Sector',align:'left',html:r=>swatch(SECTOR_COLORS[r.k])+esc(r.k),sort:r=>r.k},
    {label:'Companies',html:r=>nf(r.o.n),sort:r=>r.o.n},
    {label:'Employees',html:r=>compact(r.o.emp),sort:r=>r.o.emp},
    {label:'Turnover',html:r=>money(r.o.turn),sort:r=>r.o.turn},
    {label:'Equity funding',html:r=>money(r.o.inv),sort:r=>r.o.inv},
    // Grants in this dataset are Innovate UK awards: the source's own Grants_GBP
    // column and IUK_GBP agree on 949 of the 951 companies that carry either, at
    // £2.11bn against £2.10bn. So this is the grant figure, not a slice of one.
    {label:'Grant funding',html:r=>money(r.o.iuk),sort:r=>r.o.iuk},
    {label:'Female',html:r=>(r.o.n?r.o.women/r.o.n*100:0).toFixed(0)+'%',sort:r=>r.o.n?r.o.women/r.o.n:0}
  ], Object.keys(kb).map(k=>({k,o:kb[k]})), {col:1,dir:'desc'});
  const secEnt=Object.keys(kb).map(k=>({k,o:kb[k]}));
  const bN=bestOf(secEnt,o=>o.n), bT=bestOf(secEnt,o=>o.turn),
        bI=bestOf(secEnt.filter(e=>e.o.n>50),o=>o.n?o.inv/o.n:0), bF=bestOf(secEnt.filter(e=>e.o.n>50),o=>o.n?o.women/o.n:0);
  $('secInsights').innerHTML =
    insightCard('building','Largest sector', bN?bN.k:'—', bN?nf(bN.o.n)+' companies':'', bN?SECTOR_COLORS[bN.k]:null) +
    insightCard('coins','Top turnover', bT?bT.k:'—', bT?money(bT.o.turn)+' aggregate':'', bT?SECTOR_COLORS[bT.k]:null) +
    insightCard('spark','Most capital-intensive', bI?bI.k:'—', bI?money(bI.o.n?bI.o.inv/bI.o.n:0)+' raised / company':'', bI?SECTOR_COLORS[bI.k]:null) +
    insightCard('female','Most women-led', bF?bF.k:'—', bF?(bF.o.women/bF.o.n*100).toFixed(0)+'% women-led':'', bF?SECTOR_COLORS[bF.k]:null);
  renderChips('sectors');
}

/* ---- Regions ---- */
function renderRegionsDash(){ const f=xf('regions'), L=fLists(f), s=aggregate(L.k);
  const kb=aggByRegion(L.k), topReg=topEntries(mapVal(kb,o=>o.n),1)[0];
  $('regKpis').innerHTML = kpiCard(nf(s.n),'Companies') + kpiCard(compact(s.emp),'Employees') + kpiCard(money(s.turn),'Turnover') +
    kpiCard(topReg?regionShort(topReg[0]):'—','Largest region', topReg?nf(topReg[1])+' companies':'');
  const byReg=aggByRegion(L.r);
  const chart=(cid,sel,col,fmt)=>{ const rows=ITL1_ORDER.filter(k=>byReg[k]).map(k=>[k,sel(byReg[k])]).sort((a,b)=>b[1]-a[1]), kk=rows.map(r=>r[0]);
    hBar(cid, kk.map(regionShort), rows.map(r=>r[1]), hlColors(kk,()=>col,f.r), fmt, i=>{ f.r=(f.r===kk[i]?null:kk[i]); focusTab('regions'); }); };
  chart('regCompanies',x=>x.n,'#0e9f86',nf); chart('regTurnover',x=>x.turn,'#2F6DB5',money); chart('regInvestment',x=>x.inv,'#8E6FCF',money); chart('regFemale',x=>x.n?x.women/x.n*100:0,'#C64B8C',v=>v.toFixed(0)+'%');
  renderSortable('regTable',[
    {label:'Region',align:'left',html:r=>esc(regionShort(r.k)),sort:r=>regionShort(r.k)},
    {label:'Companies',html:r=>nf(r.o.n),sort:r=>r.o.n},
    {label:'Employees',html:r=>compact(r.o.emp),sort:r=>r.o.emp},
    {label:'Turnover',html:r=>money(r.o.turn),sort:r=>r.o.turn},
    {label:'Investment',html:r=>money(r.o.inv),sort:r=>r.o.inv},
    {label:'Female',html:r=>(r.o.n?r.o.women/r.o.n*100:0).toFixed(0)+'%',sort:r=>r.o.n?r.o.women/r.o.n:0}
  ], ITL1_ORDER.filter(k=>kb[k]).map(k=>({k,o:kb[k]})), {col:1,dir:'desc'});
  const regEnt=Object.keys(kb).map(k=>({k,o:kb[k]}));
  const rN=bestOf(regEnt,o=>o.n), rT=bestOf(regEnt,o=>o.turn), rI=bestOf(regEnt,o=>o.inv), rF=bestOf(regEnt.filter(e=>e.o.n>50),o=>o.n?o.women/o.n:0);
  $('regInsights').innerHTML =
    insightCard('building','Largest region', rN?regionShort(rN.k):'—', rN?nf(rN.o.n)+' companies':'', '#0e9f86') +
    insightCard('coins','Highest turnover', rT?regionShort(rT.k):'—', rT?money(rT.o.turn)+' aggregate':'', '#2F6DB5') +
    insightCard('spark','Most investment', rI?regionShort(rI.k):'—', rI?money(rI.o.inv)+' equity raised':'', '#8E6FCF') +
    insightCard('female','Most women-led', rF?regionShort(rF.k):'—', rF?(rF.o.women/rF.o.n*100).toFixed(0)+'% women-led':'', '#C64B8C');
  renderChips('regions');
}

/* ---- Investment ---- */
function renderInvestmentDash(){ const f=xf('investment'), L=fLists(f), s=aggregate(L.k),
        backed=uniqueCompanies(L.k).filter(c=>c.investors.length).length;
  $('invKpis').innerHTML = kpiCard(money(s.inv),'Equity investment') + kpiCard(money(s.fund),'All funding types') + kpiCard(money(s.iuk),'Innovate UK grant') + kpiCard(nf(backed),'Investor-backed companies') + kpiCard(money(backed?s.inv/backed:0),'Avg equity per backed');
  const secRows=topEntries(mapVal(aggBySector(L.s),o=>o.inv),8), sk=secRows.map(r=>r[0]);
  hBar('invBySector', sk, secRows.map(r=>r[1]), hlColors(sk,k=>SECTOR_COLORS[k]||'#888',f.s), money, i=>{ f.s=(f.s===sk[i]?null:sk[i]); focusTab('investment'); });
  const regRows=topEntries(mapVal(aggByRegion(L.r),o=>o.inv),10), rk=regRows.map(r=>r[0]);
  hBar('invByRegion', rk.map(regionShort), regRows.map(r=>r[1]), hlColors(rk,()=>'#0e9f86',f.r), money, i=>{ f.r=(f.r===rk[i]?null:rk[i]); focusTab('investment'); });
  const allSecRows=topEntries(mapVal(aggBySector(L.s),o=>o.fund),8), ask=allSecRows.map(r=>r[0]);
  hBar('invAllBySector', ask, allSecRows.map(r=>r[1]), hlColors(ask,k=>SECTOR_COLORS[k]||'#888',f.s), money, i=>{ f.s=(f.s===ask[i]?null:ask[i]); focusTab('investment'); });
  const allRegRows=topEntries(mapVal(aggByRegion(L.r),o=>o.fund),10), ark=allRegRows.map(r=>r[0]);
  hBar('invAllByRegion', ark.map(regionShort), allRegRows.map(r=>r[1]), hlColors(ark,()=>'#2F6DB5',f.r), money, i=>{ f.r=(f.r===ark[i]?null:ark[i]); focusTab('investment'); });
  const invCount={}; uniqueCompanies(L.k).forEach(c=>c.investors.forEach(iv=>invCount[iv]=(invCount[iv]||0)+1)); const top=topEntries(invCount,10);
  hBar('invTop', top.map(r=>r[0]), top.map(r=>r[1]), '#2F6DB5', nf);
  const kbSec=aggBySector(L.k), kbReg=aggByRegion(L.k);
  const secEnt=Object.keys(kbSec).map(k=>({k,o:kbSec[k]})), regEnt=Object.keys(kbReg).map(k=>({k,o:kbReg[k]}));
  const bSecInv=bestOf(secEnt,o=>o.inv), bRegInv=bestOf(regEnt,o=>o.inv),
        bSecAll=bestOf(secEnt,o=>o.fund), bRegAll=bestOf(regEnt,o=>o.fund),
        bIuk=bestOf(secEnt,o=>o.iuk), tInv=top[0];
  // Equity and all-funding are shown side by side: the leader can differ, because
  // debt and grants are concentrated in different sectors from equity.
  const sameSec = bSecInv && bSecAll && bSecInv.k===bSecAll.k;
  const sameReg = bRegInv && bRegAll && bRegInv.k===bRegAll.k;
  $('invInsights').innerHTML =
    insightCard('coins','Best-funded sector · equity', bSecInv?bSecInv.k:'—', bSecInv?money(bSecInv.o.inv)+' equity raised':'', bSecInv?SECTOR_COLORS[bSecInv.k]:null) +
    insightCard('coins','Best-funded sector · all funding', bSecAll?bSecAll.k:'—', bSecAll?money(bSecAll.o.fund)+(sameSec?' · same leader':' · differs from equity'):'', bSecAll?SECTOR_COLORS[bSecAll.k]:null) +
    (scoped() ? '' :
      insightCard('pin','Best-funded region · equity', bRegInv?regionShort(bRegInv.k):'—', bRegInv?money(bRegInv.o.inv)+' equity raised':'', '#0e9f86') +
      insightCard('pin','Best-funded region · all funding', bRegAll?regionShort(bRegAll.k):'—', bRegAll?money(bRegAll.o.fund)+(sameReg?' · same leader':' · differs from equity'):'', '#2F6DB5')) +
    insightCard('grant','Top Innovate UK sector', bIuk?bIuk.k:'—', bIuk?money(bIuk.o.iuk)+' grants':'', bIuk?SECTOR_COLORS[bIuk.k]:null) +
    insightCard('spark','Most active investor', tInv?tInv[0]:'—', tInv?nf(tInv[1])+' companies backed':'', '#8E6FCF');
  renderChips('investment');
  /* Both halves of this tab draw a chart of top investors, and with nothing
     filtered they are the same chart, which reads as a bug. The badge says
     what this half covers, and when nothing is picked the first chart says
     outright that it matches the one below. */
  const whole=uniqueCompanies(S.all).length, here=uniqueCompanies(L.k).length;
  const narrowed=here<whole;
  const badge=$('invScopeBadge');
  if(badge){ badge.textContent = narrowed
      ? nf(here)+' of '+nf(whole)+' companies'
      : 'All '+nf(whole)+' companies';
    badge.classList.toggle('filtered', narrowed);
    badge.classList.toggle('all', !narrowed); }
  const tn=$('invTopNote');
  if(tn) tn.textContent = narrowed
    ? ' \u00b7 within your current selection'
    : ' \u00b7 nothing is filtered, so this matches the chart below';
  // The investor section sits on this tab but is independent of its filters, so
  // build it once rather than on every cross-filter click (reset on theme change).
  if(!S._invpDone){ renderInvestorsDash(); S._invpDone=true; }
}

/* ---- Constituencies & MPs ---- */
function renderConstituenciesDash(){
  const st=$('cdStatus');
  if(!S.conData){
    if(st) st.textContent='Loading constituency data…';
    loadConstituencies().then(()=>{ if(st) st.textContent=''; renderConstituenciesDash(); })
      .catch(()=>{ if(st) st.textContent='Could not load constituency data.'; });
    return;
  }
  if(st) st.textContent='';
  const all=conList();
  // fill the party dropdown once
  const pSel=$('cdParty');
  if(pSel && !pSel.dataset.filled){
    const seen={}; all.forEach(c=>{ if(c.party) seen[c.party]=(seen[c.party]||0)+1; });
    Object.keys(seen).sort((a,b)=>seen[b]-seen[a]).forEach(pn=>{
      const o=document.createElement('option'); o.value=pn; o.textContent=pn+' ('+seen[pn]+')'; pSel.appendChild(o); });
    pSel.dataset.filled='1';
  }
  const scope=($('cdScope')||{}).value||'all', party=($('cdParty')||{}).value||'';
  const rows=all.filter(c=>(scope!=='gov'||c.gov) && (!party||c.party===party));
  const totAll=all.reduce((a,c)=>a+c.companies,0);
  const tot=rows.reduce((a,c)=>a+c.companies,0);
  const gov=all.filter(c=>c.gov), govN=gov.reduce((a,c)=>a+c.companies,0);

  $('cdKpis').innerHTML =
    kpiCard(nf(rows.length),'Seats in view', nf(all.length)+' in total') +
    kpiCard(nf(tot),'Scaleups in them', totAll?(tot/totAll*100).toFixed(1)+'% of '+universeName():'') +
    kpiCard(nf(gov.length),'Government-held seats', nf(govN)+' scaleups ('+(totAll?(govN/totAll*100).toFixed(1):0)+'%)') +
    kpiCard(rows.length?nf(Math.round(tot/rows.length)):'0','Average per seat');

  const top=rows.slice().sort((a,b)=>b.companies-a.companies);
  const topGovSeat=gov.slice().sort((a,b)=>b.companies-a.companies)[0];
  const byInv=rows.slice().sort((a,b)=>b.investment-a.investment)[0];
  const partyTot={}; all.forEach(c=>{ const k=c.party||'Vacant'; partyTot[k]=(partyTot[k]||0)+c.companies; });
  const topParty=topEntries(partyTot,1)[0];
  $('cdInsights').innerHTML =
    insightCard('pin','Largest seat', top[0]?top[0].name:'—', top[0]?nf(top[0].companies)+' scaleups · '+(top[0].mp||'vacant'):'', '#0e9f86') +
    insightCard('building','Top government seat', topGovSeat?topGovSeat.name:'—', topGovSeat?nf(topGovSeat.companies)+' · '+topGovSeat.mp:'', partyColor(topGovSeat&&topGovSeat.party)) +
    insightCard('coins','Most equity raised', byInv?byInv.name:'—', byInv?money(byInv.investment):'', '#8E6FCF') +
    insightCard('users','Most scaleups by party', topParty?topParty[0]:'—', topParty?nf(topParty[1])+' scaleups':'', partyColor(topParty&&topParty[0]));

  const t15=top.slice(0,15);
  hBar('cdTopSeats', t15.map(c=>c.name), t15.map(c=>c.companies), t15.map(c=>partyColor(c.party)), nf);
  const pr=topEntries(partyTot,10);
  hBar('cdByParty', pr.map(r=>r[0]), pr.map(r=>r[1]), pr.map(r=>partyColor(r[0]==='Vacant'?'':r[0])), nf);
  doughnut('cdGovSplit', ['Government-held seats','All other seats'], [govN, totAll-govN], ['#0e9f86','#6C8693'], nf);
  const tg=gov.slice().sort((a,b)=>b.companies-a.companies).slice(0,12);
  hBar('cdTopGov', tg.map(c=>c.name), tg.map(c=>c.companies), tg.map(c=>partyColor(c.party)), nf);

  renderSortable('cdTable',[
    {label:'Constituency',align:'left',html:c=>esc(c.name),sort:c=>c.name||''},
    {label:'MP',align:'left',html:c=>c.vacant?'<i>Seat vacant</i>':esc(c.mp||'—'),sort:c=>c.mp||''},
    {label:'Party',align:'left',html:c=>c.party?swatch(partyColor(c.party))+esc(c.party):'—',sort:c=>c.party||''},
    {label:'Government role',align:'left',html:c=>c.gov?esc(c.role):'—',sort:c=>c.gov?c.role:''},
    {label:'Scaleups',html:c=>nf(c.companies),sort:c=>c.companies},
    {label:'Employees',html:c=>compact(c.employees),sort:c=>c.employees},
    {label:'Turnover',html:c=>money(c.turnover),sort:c=>c.turnover},
    {label:'Equity raised',html:c=>money(c.investment),sort:c=>c.investment}
  ], rows, {col:4,dir:'desc'});
  renderConCompare();
}

/* ---- Compare constituencies or parties ---- */
const CON_METRICS=[
  ['Scaleups',          o=>o.companies, nf],
  ['Employees',         o=>o.employees, compact],
  ['Turnover',          o=>o.turnover,  money],
  ['Equity raised',     o=>o.investment,money],
  ['Innovate UK grant', o=>o.iuk,       money],
  ['Women-led',    o=>o.companies?o.women/o.companies*100:0, v=>v.toFixed(1)+'%']
];
function partyAggregates(){
  const by={};
  conList().forEach(c=>{ const k=c.party||'Vacant';
    const a=by[k]||(by[k]={key:k,name:k,party:k,companies:0,employees:0,turnover:0,investment:0,iuk:0,women:0,seats:0});
    a.companies+=c.companies; a.employees+=c.employees; a.turnover+=c.turnover;
    a.investment+=c.investment; a.iuk+=c.iuk; a.women+=c.women; a.seats++; });
  return by;
}
function ccUniverse(){
  if(S.ccMode==='parties'){ const by=partyAggregates();
    return { items:Object.values(by), keyOf:o=>o.key, labelOf:o=>o.name,
             colorOf:o=>partyColor(o.key==='Vacant'?'':o.key), set:S.ccParties, defN:4 }; }
  return { items:conList().map(c=>Object.assign({key:c.code},c)), keyOf:o=>o.key,
           labelOf:o=>o.name, colorOf:o=>partyColor(o.party), set:S.ccSeats, defN:3 };
}
function renderConCompare(){
  if(!S.conData) return;
  const U=ccUniverse(), isParty=S.ccMode==='parties';
  document.querySelectorAll('#ccMode button').forEach(b=>b.classList.toggle('on', b.dataset.mode===S.ccMode));
  $('ccTitle').textContent = isParty?'Compare parties':'Compare constituencies';
  $('ccSub').textContent = isParty?'Totals across every seat a party holds.':'Pick up to four seats to put side by side.';
  $('ccSearchWrap').hidden = isParty;
  $('ccRadarHead').innerHTML = (isParty?'Party profile':'Constituency profile')+
    ' <span class="chart-note">each metric indexed to the leader = 100</span>';
  if(!U.set.size){
    // "Vacant" out-ranks the smaller parties on scaleups, which makes for an odd
    // default — seed with real parties/seats, though Vacant stays selectable.
    U.items.slice().filter(o=>U.keyOf(o)!=='Vacant').sort((a,b)=>b.companies-a.companies)
      .slice(0,U.defN).forEach(o=>U.set.add(U.keyOf(o)));
  }

  // picker: parties are chips; seats are removable chips fed by the search box
  const sel=[...U.set].map(k=>U.items.find(o=>U.keyOf(o)===k)).filter(Boolean);
  const pick=$('ccPicker');
  if(isParty){
    pick.innerHTML=U.items.slice().sort((a,b)=>b.companies-a.companies).map(o=>{
      const k=U.keyOf(o), on=U.set.has(k);
      return '<button class="cmp-chip'+(on?' on':'')+'" data-k="'+esc(k)+'"'+(on?' style="--cc:'+U.colorOf(o)+'"':'')+'>'+esc(U.labelOf(o))+'</button>'; }).join('');
  } else {
    pick.innerHTML=sel.map(o=>'<button class="cmp-chip on" data-k="'+esc(U.keyOf(o))+'" style="--cc:'+U.colorOf(o)+'" title="Remove">'+esc(U.labelOf(o))+' ×</button>').join('')
      || '<span class="dchip-hint">Search above to add a constituency.</span>';
  }
  pick.querySelectorAll('.cmp-chip').forEach(b=>b.addEventListener('click',()=>{
    const k=b.dataset.k;
    if(U.set.has(k)){ if(U.set.size>1) U.set.delete(k); }
    else { if(U.set.size>=4){ U.set.delete(U.set.values().next().value); } U.set.add(k); }
    renderConCompare(); }));

  // radar + table
  const chosen=[...U.set].map(k=>U.items.find(o=>U.keyOf(o)===k)).filter(Boolean);
  const maxes=CON_METRICS.map(m=>Math.max(...U.items.map(o=>m[1](o)),1));
  const text=cssVar('--muted','#5f7688'), grid=cssVar('--line','#dbe3e9'), tip=cssVar('--ink','#0c2233');
  drawChart('ccRadar',{ type:'radar',
    data:{ labels:CON_METRICS.map(m=>m[0]),
      datasets:chosen.map(o=>{ const col=U.colorOf(o);
        return { label:U.labelOf(o), data:CON_METRICS.map((m,i)=>+(m[1](o)/maxes[i]*100).toFixed(1)),
          borderColor:col, backgroundColor:chroma(col).alpha(0.16).css(), pointBackgroundColor:col,
          borderWidth:2, pointRadius:3 }; }) },
    options:{ responsive:true, maintainAspectRatio:false, animation:{duration:500},
      plugins:{ legend:{position:'top', labels:{color:text, boxWidth:11, boxHeight:11, padding:10}},
        tooltip:{ backgroundColor:tip, padding:10, cornerRadius:8 } },
      scales:{ r:{ suggestedMin:0, suggestedMax:100, angleLines:{color:grid}, grid:{color:grid},
        pointLabels:{color:text, font:{size:11}}, ticks:{display:false, stepSize:25} } } } });

  const extra = isParty ? [['Seats held', o=>o.seats, nf]] : [['MP', o=>o.mp||'—', v=>esc(String(v))],['Party', o=>o.party||'—', v=>esc(String(v))]];
  const rows = extra.concat(CON_METRICS);
  $('ccTable').innerHTML='<table class="dtable"><thead><tr><th class="l">Metric</th>'+
    chosen.map(o=>'<th class="r">'+swatch(U.colorOf(o))+esc(U.labelOf(o))+'</th>').join('')+'</tr></thead><tbody>'+
    rows.map(m=>'<tr><td class="l">'+esc(m[0])+'</td>'+
      chosen.map(o=>'<td class="r">'+m[2](m[1](o))+'</td>').join('')+'</tr>').join('')+
    '</tbody></table>';
}
function ccSuggest(){
  const box=$('ccSuggest'), q=($('ccSearch').value||'').trim().toLowerCase();
  if(!q || S.ccMode==='parties'){ box.classList.remove('show'); box.innerHTML=''; return; }
  const hits=conList().filter(c=>!S.ccSeats.has(c.code) &&
      ((c.name||'').toLowerCase().includes(q)||(c.mp||'').toLowerCase().includes(q))).slice(0,12);
  box.innerHTML=hits.map(c=>'<div data-code="'+esc(c.code)+'"><span>'+esc(c.name)+'</span><span class="s-meta">'+esc(c.mp||'vacant')+' · '+nf(c.companies)+'</span></div>').join('');
  box.classList.toggle('show',hits.length>0);
  box.querySelectorAll('div[data-code]').forEach(d=>d.addEventListener('click',()=>{
    if(S.ccSeats.size>=4) S.ccSeats.delete(S.ccSeats.values().next().value);
    S.ccSeats.add(d.getAttribute('data-code'));
    $('ccSearch').value=''; box.classList.remove('show'); renderConCompare(); }));
}

/* ---- Analysis: creative cross-cutting charts + compare ---- */
const CMP_METRICS=[
  ['Companies', o=>o.n, nf],
  ['Turnover', o=>o.turn, money],
  ['Employees', o=>o.emp, compact],
  ['Investment', o=>o.inv, money],
  ['Women-led', o=>o.n?o.women/o.n*100:0, v=>v.toFixed(1)+'%'],
  ['Innovate UK', o=>o.iuk, money]
];
function renderAnalysis(){
  const text=cssVar('--muted','#5f7688'), grid=cssVar('--line','#dbe3e9'), tip=cssVar('--ink','#0c2233'), surf=cssVar('--surface','#fff');
  const bySec=aggBySector(S.all), byReg=aggByRegion(S.all);
  const secK=S.sectors.filter(k=>bySec[k]);
  const regK=ITL1_ORDER.filter(k=>byReg[k]);

  // shared sector colour key
  $('anSectorLegend').innerHTML = secK.map(k=>'<span class="lk">'+swatch(SECTOR_COLORS[k])+esc(k)+'</span>').join('');

  // 1) Investment landscape bubble — one point per sector
  const maxInv=Math.max(...secK.map(k=>bySec[k].inv),1);
  const pts=secK.map(k=>({ x:bySec[k].n, y: bySec[k].n?bySec[k].inv/bySec[k].n:0, r: 7+30*Math.sqrt(bySec[k].inv/maxInv), _k:k }));
  drawChart('anBubble',{ type:'bubble', data:{ datasets:[{ data:pts,
      backgroundColor:secK.map(k=>chroma(SECTOR_COLORS[k]).alpha(0.72).css()), borderColor:secK.map(k=>SECTOR_COLORS[k]), borderWidth:1.5 }] },
    options:{ responsive:true, maintainAspectRatio:false, animation:{duration:500},
      plugins:{ legend:{display:false}, tooltip:{ backgroundColor:tip, padding:10, cornerRadius:8, displayColors:false,
        callbacks:{ title:c=>c[0].raw._k, label:c=>{ const o=bySec[c.raw._k]; return [nf(o.n)+' companies', 'avg '+money(o.n?o.inv/o.n:0)+' / company', money(o.inv)+' total equity']; } } } },
      scales:{ x:{ title:{display:true,text:'Number of companies',color:text}, ticks:{color:text,callback:v=>nf(v)}, grid:{color:grid} },
               y:{ title:{display:true,text:'Avg equity per company',color:text}, ticks:{color:text,callback:v=>money(v)}, grid:{color:grid} } } } });

  // 3) Investment concentration — cumulative share (single axis)
  const rows=secK.map(k=>[k,bySec[k].inv]).sort((a,b)=>b[1]-a[1]); const totalInv=rows.reduce((a,r)=>a+r[1],0)||1;
  let cum=0; const cumPts=rows.map(r=>{ cum+=r[1]; return +(cum/totalInv*100).toFixed(1); });
  drawChart('anPareto',{ type:'line', data:{ labels:rows.map(r=>r[0]), datasets:[{ data:cumPts,
      borderColor:'#2F6DB5', backgroundColor:chroma('#2F6DB5').alpha(0.12).css(), fill:true, tension:0.25,
      pointRadius:4, pointHoverRadius:6, pointBackgroundColor:'#2F6DB5', borderWidth:2 }] },
    options:{ responsive:true, maintainAspectRatio:false, animation:{duration:500},
      plugins:{ legend:{display:false}, tooltip:{ backgroundColor:tip, padding:10, cornerRadius:8, displayColors:false,
        callbacks:{ title:c=>'Top '+(c[0].dataIndex+1)+' sectors', label:c=>c.parsed.y+'% of all equity raised' } } },
      scales:{ y:{ min:0, max:100, ticks:{color:text, callback:v=>v+'%'}, grid:{color:grid} },
               x:{ ticks:{color:text, maxRotation:55, minRotation:55, font:{size:10}}, grid:{display:false} } } } });

  // 4) Compare — radar + side-by-side table (regions OR sectors)
  const sectorsMode = S.compareMode==='sectors';
  const dim = sectorsMode
    ? { agg:bySec, keys:secK, label:k=>k, color:(k,i)=>SECTOR_COLORS[k]||CAT_PALETTE[i%CAT_PALETTE.length], set:S.compareSectors, defN:4 }
    : { agg:byReg, keys:regK, label:k=>regionShort(k), color:(k,i)=>CAT_PALETTE[i%CAT_PALETTE.length], set:S.compareRegions, defN:3 };
  document.querySelectorAll('#anCompareMode button').forEach(b=>b.classList.toggle('on', b.dataset.mode===S.compareMode));
  $('anCompareTitle').textContent = sectorsMode?'Compare sectors':'Compare regions';
  $('anRadarHead').innerHTML = (sectorsMode?'Sector profile':'Region profile')+' <span class="chart-note">each metric indexed to the leading '+(sectorsMode?'sector':'region')+' = 100</span>';
  if(!dim.set.size){ dim.keys.slice().sort((a,b)=>dim.agg[b].n-dim.agg[a].n).slice(0,dim.defN).forEach(k=>dim.set.add(k)); }
  renderComparePicker(dim);
  renderCompare(dim, {text,grid});
}
function renderComparePicker(dim){ const el=$('anComparePicker'); if(!el) return;
  const sel=[...dim.set];
  el.innerHTML = dim.keys.map(k=>{ const idx=sel.indexOf(k), on=idx>=0, col=on?dim.color(k,idx):'';
    return '<button class="cmp-chip'+(on?' on':'')+'" data-k="'+esc(k)+'"'+(on?' style="--cc:'+col+'"':'')+'>'+esc(dim.label(k))+'</button>'; }).join('');
  el.querySelectorAll('.cmp-chip').forEach(b=>b.addEventListener('click',()=>{ const k=b.dataset.k;
    if(dim.set.has(k)){ if(dim.set.size>1) dim.set.delete(k); }
    else { if(dim.set.size>=4){ const first=dim.set.values().next().value; dim.set.delete(first); } dim.set.add(k); }
    renderAnalysis(); }));
}
function renderCompare(dim, th){
  const sel=[...dim.set].filter(k=>dim.agg[k]);
  const maxes=CMP_METRICS.map(m=>Math.max(...dim.keys.map(k=>m[1](dim.agg[k])),1));
  const datasets=sel.map((k,i)=>{ const col=dim.color(k,i), o=dim.agg[k];
    return { label:dim.label(k), data:CMP_METRICS.map((m,mi)=>+(m[1](o)/maxes[mi]*100).toFixed(1)),
      borderColor:col, backgroundColor:chroma(col).alpha(0.16).css(), pointBackgroundColor:col, borderWidth:2, pointRadius:3 }; });
  const tip=cssVar('--ink','#0c2233');
  drawChart('anRadar',{ type:'radar', data:{ labels:CMP_METRICS.map(m=>m[0]), datasets },
    options:{ responsive:true, maintainAspectRatio:false, animation:{duration:500},
      plugins:{ legend:{position:'top', labels:{color:th.text, boxWidth:11, boxHeight:11, padding:10}},
        tooltip:{ backgroundColor:tip, padding:10, cornerRadius:8 } },
      scales:{ r:{ suggestedMin:0, suggestedMax:100, angleLines:{color:th.grid}, grid:{color:th.grid},
        pointLabels:{color:th.text, font:{size:11}}, ticks:{display:false, stepSize:25} } } } });
  const head=['Metric'].concat(sel.map(dim.label));
  const body=CMP_METRICS.map(m=> '<tr><td class="l">'+esc(m[0])+'</td>'+ sel.map(k=>'<td class="r">'+m[2](m[1](dim.agg[k]))+'</td>').join('') +'</tr>');
  $('anCompareTable').innerHTML='<table class="dtable"><thead><tr>'+head.map((h,i)=>'<th class="'+(i?'r':'l')+'">'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+body.join('')+'</tbody></table>';
}

/* ---- Investors ---- */
function renderInvestorsDash(){ const names=S.invNames;
  /* Counted against the MAPPED population, not the raw lists, which carry
     company numbers that never reached the map -- the card used to quote the
     raw figure while the rail filter beside it returned the mapped one, so the
     two contradicted each other on the same screen. */
  const mapped=uniqueCompanies(S.all);
  const bbb=mapped.filter(c=>S.flags.bbb.has(c.num)).length,
        iuk=mapped.filter(c=>S.flags.iuk.has(c.num)).length;
  /* An investor with no country on record is not an international one. Taking
     "International" as everything that is not flagged United Kingdom counted
     every blank as foreign, which in the North East edition read 81 against the
     16 actually recorded abroad. The gap is now its own stated figure. */
  const invCountry=n=>((S.enriched[n]||{}).country||'').trim();
  const uk=names.filter(n=>invCountry(n)==='United Kingdom').length;
  const intl=names.filter(n=>invCountry(n) && invCountry(n)!=='United Kingdom').length;
  const noCountry=names.length-uk-intl;   // kept out of the country chart below
  $('invpKpis').innerHTML = kpiCard(nf(names.length),'Investors') + kpiCard(nf(uk),'UK-based') + kpiCard(nf(intl),'International') + kpiCard(nf(bbb),'British Business Bank-backed', nf(iuk)+' Innovate UK grant recipients');
  const ib=$('invpScopeBadge'); if(ib) ib.textContent='All '+nf(names.length)+' investors';
  const byType={}; names.forEach(n=>{ const t=(S.enriched[n].type||'Other').trim()||'Other'; byType[t]=(byType[t]||0)+1; });
  const tTop=topEntries(byType,8); doughnut('invpByType', tTop.map(r=>r[0]), tTop.map(r=>r[1]), CAT_PALETTE, nf);
  // Investors with no country on record are left out rather than piled into an
  // "Unknown" bar that outgrew every real country and made the chart about the
  // gap instead of the geography. The card above states how many they are.
  const byCountry={}; names.forEach(n=>{ const c=invCountry(n); if(c) byCountry[c]=(byCountry[c]||0)+1; });
  const cTop=topEntries(byCountry,10); hBar('invpByCountry', cTop.map(r=>r[0]), cTop.map(r=>r[1]), '#0e9f86', nf);
  // An investor's company list carries numbers that never reached the map, so
  // its raw length disagrees with every other figure in the tool. Counted
  // against the mapped population, as the cards above now are.
  const onMap=new Set(mapped.map(c=>c.num));
  const backed=n=>((S.enriched[n]||{}).companies||[]).reduce((a,c)=>a+(onMap.has(normNum(c))?1:0),0);
  const nTop=names.map(n=>[n,backed(n)]).sort((a,b)=>b[1]-a[1]).slice(0,10);
  hBar('invpTop', nTop.map(r=>r[0]), nTop.map(r=>r[1]), '#2F6DB5', nf);
  hBar('invpFunding', ['British Business Bank','Innovate UK'], [bbb,iuk], ['#D64550','#8E6FCF'], nf);
  const tRows=names.map(n=>({n,v:S.enriched[n],c:backed(n)})).sort((a,b)=>b.c-a.c).slice(0,40);
  renderSortable('invpTable',[
    {label:'Investor',align:'left',html:r=>esc(r.n),sort:r=>r.n},
    {label:'Type',align:'left',html:r=>esc(r.v.type||'—'),sort:r=>r.v.type||''},
    {label:'Country',align:'left',html:r=>esc(r.v.country||'—'),sort:r=>r.v.country||''},
    {label:'Companies backed',html:r=>nf(r.c),sort:r=>r.c}
  ], tRows, {col:3,dir:'desc'});
}

/* ---- Public sector ---- */
function renderPublicDash(){ const proc=Object.values(S.procurement||{});
  const totVal=proc.reduce((a,p)=>a+(+p.total_value||0),0), sme=proc.filter(p=>p.is_sme).length, fw=proc.filter(p=>p.on_framework).length;
  const mappable=proc.filter(p=>S.byNum[normNum(p.id)]).length;
  $('pubKpis').innerHTML =
    kpiCard(nf(proc.length),'Procurement companies', nf(mappable)+' of these appear on the map') +
    kpiCard(money(totVal),'Total contract value') +
    kpiCard((proc.length?sme/proc.length*100:0).toFixed(0)+'%','SME share', (proc.length?fw/proc.length*100:0).toFixed(0)+'% on a framework');
  const procSec={}; proc.forEach(p=>(p.sectors||['Other']).forEach(s=>{ procSec[s]=(procSec[s]||0)+(+p.total_value||0); }));
  const psRows=topEntries(procSec,8); hBar('pubProcSector', psRows.map(r=>r[0]), psRows.map(r=>r[1]), '#0e9f86', money);
  const buyers={}; proc.forEach(p=>(p.top_buyers||[]).forEach(b=>{ buyers[b]=(buyers[b]||0)+1; }));
  const bRows=topEntries(buyers,10); hBar('pubBuyers', bRows.map(r=>r[0]), bRows.map(r=>r[1]), '#2F6DB5', nf);
  // Central + local alone leaves ~30% of contract value unattributed (NHS trusts,
  // universities, housing associations, ALBs), so show the remainder explicitly.
  // This note used to be the literal string "all £6.8B of contract value".
  // That is the national figure, so the North East edition -- which carries
  // £110M across 24 suppliers -- captioned its own chart with a number 60x
  // too big. It is written from the data now.
  const gsn=$('pubGovSplitNote');
  if(gsn) gsn.textContent='all '+money(totVal)+' of contract value';
  const central=proc.reduce((a,p)=>a+(+p.gov_central_value||0),0),
        local=proc.reduce((a,p)=>a+(+p.gov_local_value||0),0),
        otherPub=proc.reduce((a,p)=>a+(+p.gov_other_value||0),0);
  doughnut('pubGovSplit', ['Central government','Local government','Other public bodies'],
    [central,local,otherPub], ['#8E6FCF','#E8843C','#6C8693'], money);
  const btVal={}; proc.forEach(p=>{ const t=p.buyer_type||'Other public body'; btVal[t]=(btVal[t]||0)+(+p.total_value||0); });
  const btRows=topEntries(btVal,8);
  hBar('pubBuyerType', btRows.map(r=>r[0]), btRows.map(r=>r[1]), btRows.map(r=>BUYER_COLORS[r[0]]||'#6C8693'), money);
  const tRows=proc.slice().sort((a,b)=>(b.total_value||0)-(a.total_value||0)).slice(0,40);
  renderSortable('pubTable',[
    {label:'Company',align:'left',html:p=>esc(p.name),sort:p=>p.name||''},
    {label:'Main buyer',align:'left',html:p=>{ const t=p.buyer_type||'Other public body';
      return swatch(BUYER_COLORS[t]||'#6C8693')+esc(t)+(p.buyer_type_mixed?' <span style="color:var(--faint)">+</span>':''); },sort:p=>p.buyer_type||''},
    {label:'Top buyer',align:'left',html:p=>esc((p.top_buyers||[])[0]||'—'),sort:p=>(p.top_buyers||[])[0]||''},
    {label:'Contract value',html:p=>money(p.total_value),sort:p=>+p.total_value||0},
    {label:'Contracts',html:p=>nf(p.n_contracts||0),sort:p=>+p.n_contracts||0},
    {label:'Framework',align:'left',html:p=>p.on_framework?'Yes':'No',sort:p=>p.on_framework?1:0},
    {label:'SME',align:'left',html:p=>p.is_sme?'Yes':'No',sort:p=>p.is_sme?1:0}
  ], tRows, {col:3,dir:'desc'});
  const byT=topEntries(btVal,1)[0], bigBuyer=topEntries(buyers,1)[0];
  const biggest=proc.slice().sort((a,b)=>(b.total_value||0)-(a.total_value||0))[0];
  $('pubInsights').innerHTML =
    insightCard('coins','Largest single supplier', biggest?biggest.name:'—', biggest?money(biggest.total_value)+' across '+nf(biggest.n_contracts||0)+' contracts':'', '#0e9f86') +
    insightCard('building','Biggest buyer group', byT?byT[0]:'—', byT?money(byT[1])+' of contract value':'', byT?BUYER_COLORS[byT[0]]:null) +
    insightCard('users','Most active buyer', bigBuyer?bigBuyer[0]:'—', bigBuyer?nf(bigBuyer[1])+' suppliers on this list':'', '#2F6DB5') +
    insightCard('grant','Unattributed to central/local', money(otherPub), (totVal?(otherPub/totVal*100).toFixed(0):0)+'% · NHS, universities, housing', '#6C8693');
}

function applyTheme(mode){ document.documentElement.setAttribute('data-theme',mode); try{ localStorage.setItem('cm_theme',mode); }catch(e){}
  if(NO_TILES){ drawLandLayer(); }
  else if(mode==='dark'){ if(map.hasLayer(lightTiles)) map.removeLayer(lightTiles); if(!map.hasLayer(darkTiles)) darkTiles.addTo(map); }
  else { if(map.hasLayer(darkTiles)) map.removeLayer(darkTiles); if(!map.hasLayer(lightTiles)) lightTiles.addTo(map); }
  if(regionLayer&&S.selRegions.size) renderRegionBoundary();
  // The scope tint is mixed from --accent-ink, which the theme redefines.
  if(scopeLayer) drawScopeRegion();
  S._invpDone=false;
  if(S.all && S.all.length){ if(S.tab && S.tab!=='map' && typeof renderTab==='function') renderTab(S.tab);
    else if(S.tab==='map' && S.detailOpen && typeof renderDetail==='function') renderDetail(); } }
(function initTheme(){ let t=null; try{ t=localStorage.getItem('cm_theme'); }catch(e){}
  if(t!=='dark'&&t!=='light'){ t=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'; }
  applyTheme(t); })();
