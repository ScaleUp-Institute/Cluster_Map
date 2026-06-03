// Define the UK bounds for larger screens (landscape)
var ukBoundsLandscape = L.latLngBounds(
  L.latLng(49.5, -10.5),
  L.latLng(61.0, 2.1)
);

// Define base map layers
var lightMap = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  subdomains: 'abcd',
  noWrap: true
});

var darkMap = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  subdomains: 'abcd',
  noWrap: true
});

var streetMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
  noWrap: true
});

var baseMaps = {
  'Light Map': lightMap,
  'Dark Map': darkMap,
  'Street Map': streetMap
};

var universityLayer    = L.layerGroup();
var infrastructureLayer = L.layerGroup();
var supportProgramLayer = L.layerGroup();

var overlays = {};

var map = L.map('map', {
  maxBoundsViscosity: 1.0,
  minZoom: 4,
  maxZoom: 18,
  layers: [lightMap]
});

setMapViewBasedOnScreenSize();

map.removeControl(map.zoomControl);
L.control.zoom({ position: 'topleft' }).addTo(map);
L.control.layers(baseMaps, overlays, { position: 'topleft' }).addTo(map);

function setMapViewBasedOnScreenSize() {
  var isPortrait = window.innerHeight > window.innerWidth;
  if (isPortrait) {
    map.setView([54.5, -4.0], 6);
    map.setMaxBounds([[49.5, -13.0],[61.0, 5.0]]);
  } else {
    map.fitBounds(ukBoundsLandscape);
    map.setMaxBounds(ukBoundsLandscape);
  }
}

map.on('click', function (e) {
  var infoBox = document.getElementById('info-box');
  if (infoBox) infoBox.classList.add('hidden');
});

var displayMode = 'both';
map.createPane('polygonsPane');
map.getPane('polygonsPane').style.zIndex = 400;
map.createPane('finalAreasBoundaryPane');
map.getPane('finalAreasBoundaryPane').style.zIndex = 350;
map.getPane('markerPane').style.zIndex = 600;
map.getPane('popupPane').style.zIndex = 700;

// Global variables
var csvData;
var localAuthoritiesLayer;
var finalAreasLayer;
var finalAreasBoundaryLayer;
var finalAreasGeoJSONData;
var scaleupData;
var scaleupLayers = {};
var searchControl;
var legend;
var layerControl;
var sectorControl;
var clusterControl;
var clusterRegions = {};
var clusterLayers = {};
var currentSectors = [];
window.selectionOrder = [];
var currentClusters = [];
var polygonVisibility = false;
var clusterColors = {};
var sectorColors = {};
var sectorPolygonLayers = {};
var clusterSummaryData = {};
var sectorStats = {};
var polygonToggleControl = null;
var allPolygons = [];
var currentHighlightedPolygon = null;
var highlightedPolygons = [];
var magnifyingGlass;
var universityData = [];
var infrastructureData = [];
var supportProgramData = [];
var companyData = [];
var masterClusterData = [];
var companyDetailsByNumber = {};

// List of company numbers to exclude
var excludedCompanyNumbers = [
  '12405751','8924217','575914','7187537','9922859','8761455','1765758','3847202','10116333','10813936','10473308','8994234','OC321845',
  '11523515','7075183','9010597','11041325','9805175','12336828','11924643','9688709','SC619434','10220212','3864068','10499190','7383076',
  '8706503','11771128','4467860','11218066','4384008','8318444','123550','7622119','9618109','10611481','6894120','8100687','3280557',
  '4036416','6841897','11769589','7875732','8943369','9892057','1800000','10546847','4156317','9467768','8778322','5528381','10902884',
  '4978912','OC415130','10185006','9158610','12209449','9319771','2142875','6936153','3919664','8344447','3235601','8961638','4097099',
  '12420613','4498663','8444296','10917030','7094561','11121433','11207381','5243851','8848940','11476842','9932290','11375584','10915172',
  '12586871','3847379','7040707','9714903','7866563','3102360','10045407','9459339'
];

var layerNames = {
  'local-authorities': 'Local Authorities',
  'final-areas': 'Final Areas',
  'scaleup-density': 'Scaleup density per 100k (2022)',
  'avg-growth': 'Avg growth in scaleup density (2013-2022)'
};

var areaColors = {
  'Buckinghamshire': '#d0f0c0',
  'Cambridgeshire and Peterborough': '#a2d9b1',
  'Cheshire and Warrington': '#75c2a3',
  'Cornwall and Isles of Scilly': '#4aab94',
  'Cumbria': '#1d9486',
  'Devon': '#007d77',
  'Dorset': '#006e6a',
  'East Midlands CCA': '#005f5e',
  'East Sussex': '#004f51',
  'Essex': '#003f45',
  'Gloucestershire': '#cce5ff',
  'Greater Lincolnshire': '#99ccff',
  'Greater Manchester CA': '#66b2ff',
  'Hampshire area': '#3399ff',
  'Hertfordshire': '#0080ff',
  'Hull and East Yorkshire': '#0066cc',
  'Kent': '#0059b3',
  'Lancashire': '#004d99',
  'Leicester and Leicestershire': '#004080',
  'Liverpool City Region CA': '#003366',
  'London': '#00264d',
  'New Anglia': '#001a33',
  'North East CA': '#00111f',
  'Oxfordshire': '#000d17',
  'Solent': '#d0f0c0',
  'The Marches': '#a2d9b1',
  'Somerset': '#75c2a3',
  'South East Midlands': '#4aab94',
  'South Yorkshire CA': '#1d9486',
  'Stoke-on-Trent and Staffordshire': '#007d77',
  'Surrey': '#006e6a',
  'Swindon and Wiltshire': '#005f5e',
  'Tees Valley CA': '#004f51',
  'Thames Valley Berkshire': '#003f45',
  'Warwickshire': '#cce5ff',
  'West Midlands CA': '#99ccff',
  'West of England CA': '#66b2ff',
  'Coast to Capital': '#3399ff',
  'West Yorkshire CA': '#0080ff',
  'Worcestershire': '#0066cc',
  'York and North Yorkshire CA': '#0059b3',
  'Northern Ireland': '#004d99',
  'Scotland': '#004080',
  'Wales': '#003366'
};

var scaleupColorScales = {
  'Scaleup density per 100k (2022)': chroma.scale(['#eff3ff', '#084594']).classes(5),
  'Avg growth in scaleup density (2013-2022)': chroma.scale(['#fee5d9', '#a50f15']).classes(5)
};

var sectors = {
  'Advanced Manufacturing': 'Adv_man_clusters10.csv',
  'Agritech': 'Agritech_clusters7.csv',
  'Creative Industries': 'Creative_Industries_clusters15.csv',
  'Fintech': 'Fintech_clusters12.csv',
  'Net Zero': 'NetZero_clusters20.csv',
  'Professional Services': 'Prof_Services_clusters25.csv',
  'Technology': 'Techs_clusters35.csv',
  'Telecoms Technology': 'TelecomsTechs_clusters15.csv',
  'Life Sciences': 'LifeSciences_clusters20.csv'
};

var summaryStatsFiles = {
  'Advanced Manufacturing': 'summarystats_Adv_man.csv',
  'Agritech': 'summarystats_Agritech.csv',
  'Creative Industries': 'summarystats_Creative_Industries.csv',
  'Fintech': 'summarystats_Fintech.csv',
  'Net Zero': 'summarystats_NetZero.csv',
  'Life Sciences': 'summarystats_Life_Sciences.csv',
  'Professional Services': 'summarystats_Prof_Services.csv',
  'Technology': 'summarystats_Tech.csv',
  'Telecoms Technology': 'summarystats_Telecoms.csv'
};

var financialDataFiles = {
  'Advanced Manufacturing': 'financials_Adv_man.csv',
  'Agritech': 'financials_Agritech.csv',
  'Creative Industries': 'financials_Creative_Industries.csv',
  'Fintech': 'financials_Fintech.csv',
  'Life Sciences': 'financials_Life_Sciences.csv',
  'Net Zero': 'financials_Net_Zero.csv',
  'Professional Services': 'financials_Prof_Services.csv',
  'Technology': 'financials_Tech.csv',
  'Telecoms Technology': 'financials_Telecoms.csv'
};

var sectorColors = {
  'Advanced Manufacturing': 'rgba(255, 0, 0, 0.5)',
  'Agritech': '#008080',
  'Creative Industries': '#FF69B4',
  'Fintech': '#800000',
  'Life Sciences': '#800080',
  'Net Zero': '#1646a0',
  'Clean Tech': '#FFB6C1',
  'Professional Services': '#008000',
  'Telecoms Technology': '#A9A9A9',
  'Technology': '#FFA500'
};

var sectorDisplayNames = {
  'Telecoms Technology': 'Telecoms',
};

// ── Helper functions ──────────────────────────────────────────

function normalizeSectorName(str) {
  return (str || '').trim().replace(/_/g, ' ');
}

function parseNumber(value) {
  if (typeof value === 'string') {
    value = value.replace(/[^0-9.-]+/g, '');
  }
  var parsedValue = parseFloat(value);
  return isNaN(parsedValue) ? 0 : parsedValue;
}

function isFemaleFoundedFlag(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'boolean') return value === true;
  if (typeof value === 'number') return value === 1;
  const s = String(value).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'y';
}

function formatTurnover(value) {
  if (typeof value !== 'number' || isNaN(value)) return 'N/A';
  if (value >= 1e9) return '£' + (value / 1e9).toFixed(1) + 'B';
  if (value >= 1e6) return '£' + (value / 1e6).toFixed(1) + 'M';
  if (value >= 1e3) return '£' + (value / 1e3).toFixed(1) + 'K';
  return '£' + value.toFixed(0);
}

function getColor(area) {
  return areaColors[area] || '#FFFFFF';
}

function getClusterColor(clusterId) {
  var clusterNumber = clusterId.split('_')[1];
  if (clusterNumber === '0') return '#D3D3D3';
  return clusterColors[clusterId];
}

function getScaleupDensityColor(value) {
  if (value < 40)                    return '#00008B';
  if (value >= 40 && value < 45)     return '#4169E1';
  if (value >= 45 && value < 50)     return '#87CEFA';
  if (value >= 50 && value <= 60)    return '#7FFFD4';
  if (value > 60)                    return '#006400';
  return '#FFFFFF';
}

function getAvgGrowthColor(value) {
  if (value < 0)                  return '#00008B';
  if (value >= 0 && value < 1)    return '#87CEFA';
  if (value >= 1 && value <= 2)   return '#20B2AA';
  if (value > 2)                  return '#006400';
  return '#FFFFFF';
}

function getScaleupColor(value, columnName) {
  if (columnName === 'Scaleup density per 100k (2022)') {
    return getScaleupDensityColor(value);
  } else if (columnName === 'Avg growth in scaleup density (2013-2022)') {
    return getAvgGrowthColor(value);
  } else {
    var scale = scaleupColorScales[columnName];
    if (!scale) { console.error('No color scale found for column:', columnName); return '#FFFFFF'; }
    var min = getMinValue(columnName);
    var max = getMaxValue(columnName);
    if (isNaN(min) || isNaN(max) || min === max) return '#FFFFFF';
    scale.domain([min, max]);
    return (typeof value === 'number' && !isNaN(value)) ? scale(value).hex() : '#FFFFFF';
  }
}

function getMinValue(columnName) {
  var values = scaleupData.map(row => row[columnName]).filter(v => typeof v === 'number' && !isNaN(v));
  return values.length === 0 ? 0 : Math.min(...values);
}

function getMaxValue(columnName) {
  var values = scaleupData.map(row => row[columnName]).filter(v => typeof v === 'number' && !isNaN(v));
  return values.length === 0 ? 1 : Math.max(...values);
}

function getContrastColor(hexColor) {
  hexColor = hexColor.replace('#', '');
  if (hexColor.length === 3) {
    hexColor = hexColor.split('').map(h => h + h).join('');
  }
  var r = parseInt(hexColor.substr(0, 2), 16);
  var g = parseInt(hexColor.substr(2, 2), 16);
  var b = parseInt(hexColor.substr(4, 2), 16);
  var luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

function getSelectedSectors() {
  return Array.from(
    document.querySelectorAll('.sector-chip.selected')
  ).map(chip => chip.dataset.value);
}

function getAllClusterIds() {
  return companyData.reduce(function (acc, company) {
    const cid = company.clusterId;
    if (!cid) return acc;
    const clusterNum = String(company.cluster ?? '').trim();
    if (clusterNum === '0') return acc;
    if (!acc.includes(cid)) acc.push(cid);
    return acc;
  }, []);
}

function convexHull(points) {
  if (points.length < 3) return points;
  points = points.slice().sort(function (a, b) {
    return a[0] - b[0] || a[1] - b[1];
  });
  var lower = [];
  for (var i = 0; i < points.length; i++) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], points[i]) <= 0) lower.pop();
    lower.push(points[i]);
  }
  var upper = [];
  for (var i = points.length - 1; i >= 0; i--) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], points[i]) <= 0) upper.pop();
    upper.push(points[i]);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

function cross(o, a, b) {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

// ── Data loading chain ────────────────────────────────────────

Papa.parse('data/lad_data.csv', {
  download: true,
  header: true,
  dynamicTyping: true,
  skipEmptyLines: true,
  complete: function (results) {
    csvData = results.data;
    loadLocalAuthoritiesLayer();
  },
  error: function (error) {
    console.error('Error parsing LAD CSV:', error);
  }
});

function loadLocalAuthoritiesLayer() {
  fetch('data/uk-regions.geojson')
    .then(response => response.json())
    .then(geojsonData => { mergeData(geojsonData); })
    .catch(error => console.error('Error loading GeoJSON:', error));
}

function mergeData(geojsonData) {
  var csvDataLookup = {};
  csvData.forEach(function (row) {
    var ladCode = row.LAD23CD ? row.LAD23CD.trim().toUpperCase() : null;
    if (ladCode) {
      if (row['Final area']) row['Final area'] = row['Final area'].trim();
      csvDataLookup[ladCode] = row;
    } else {
      console.warn('Missing LAD23CD in CSV row:', row);
    }
  });

  var unknownLADCount = 0;
  geojsonData.features.forEach(function (feature) {
    var ladCode = feature.properties.LAD23CD ? feature.properties.LAD23CD.trim().toUpperCase() : null;
    if (ladCode && csvDataLookup[ladCode]) {
      feature.properties = {
        ...feature.properties,
        ...csvDataLookup[ladCode],
        lad: csvDataLookup[ladCode].lad || feature.properties.LAD23NM || ladCode
      };
    } else {
      console.warn(`No matching CSV data for LAD code: ${ladCode}`);
      feature.properties.lad = feature.properties.LAD23NM || 'Unknown';
      unknownLADCount++;
    }
  });

  console.log(`Total features with unknown LAD: ${unknownLADCount}`);

  localAuthoritiesLayer = L.geoJSON(geojsonData, {
    pane: 'polygonsPane',
    style: localAuthoritiesStyle,
    onEachFeature: onEachLocalAuthorityFeature
  });

  loadFinalAreasLayer();
}

function loadFinalAreasLayer() {
  fetch('data/final_areas.geojson')
    .then(r => r.json())
    .then(gj => {
      finalAreasGeoJSONData = gj;
      buildFaLookup();
      loadScaleupData();
    })
    .catch(err => console.error('Error loading Final Areas GeoJSON:', err));
}

let faNameToFeature = {};
let finalAreaNames  = [];

function buildFaLookup() {
  faNameToFeature = {};
  finalAreaNames  = [];
  finalAreasGeoJSONData.features.forEach(f => {
    const name = (f.properties['Final area'] || '').trim();
    if (name) {
      faNameToFeature[name.toUpperCase()] = f;
      finalAreaNames.push(name);
    }
  });
  finalAreaNames.sort();
}

function zoomToFinalArea(nameRaw) {
  const name = nameRaw.trim().toUpperCase();
  const feat = faNameToFeature[name];
  if (!feat) { alert('Final Area not found'); return; }
  const layer = L.geoJSON(feat);
  map.fitBounds(layer.getBounds().pad(0.2));
  const flash = L.geoJSON(feat, {
    pane: 'polygonsPane',
    style: { color: '#007BFF', weight: 3, fillOpacity: 0 },
    interactive: false
  }).addTo(map);
  setTimeout(() => map.removeLayer(flash), 2000);
}

function loadScaleupData() {
  Papa.parse('data/scaleup_data.csv', {
    download: true,
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    complete: function (results) {
      scaleupData = results.data;
      processScaleupData();
    },
    error: function (error) {
      console.error('Error parsing scaleup data CSV:', error);
      processScaleupData();
    }
  });
}

function processScaleupData() {
  try {
    var scaleupDataLookup = {};
    scaleupData.forEach(function (row) {
      var areaName = row['LOCAL AREA'] ? row['LOCAL AREA'].trim() : null;
      if (areaName) {
        ['No of Scaleups (2022)', 'Scaleup density per 100k (2022)', 'Avg growth in scaleup density (2013-2022)'].forEach(function (columnName) {
          var value = row[columnName];
          if (typeof value === 'string') {
            value = value.replace(/[^0-9.-]+/g, '');
            value = parseFloat(value);
            if (isNaN(value)) { value = null; }
            row[columnName] = value;
          } else if (typeof value !== 'number') {
            row[columnName] = null;
          }
        });
        scaleupDataLookup[areaName] = row;
      }
    });

    finalAreasGeoJSONData.features.forEach(function (feature) {
      var areaName = feature.properties['Final area'];
      if (areaName && scaleupDataLookup[areaName]) {
        feature.properties = { ...feature.properties, ...scaleupDataLookup[areaName] };
      }
    });

    finalAreasLayer = L.geoJSON(finalAreasGeoJSONData, {
      pane: 'polygonsPane',
      style: finalAreasStyle,
      onEachFeature: onEachFinalAreaFeature
    });

    if (!finalAreasBoundaryLayer) {
      finalAreasBoundaryLayer = L.geoJSON(finalAreasGeoJSONData, {
        pane: 'finalAreasBoundaryPane',
        keyboard: false,
        style: {
          className: 'final-area-boundary',
          color: '#000',
          weight: 1.2,
          fillOpacity: 0
        },
        interactive: true,
        onEachFeature: function (feature, layer) {
          layer.bindTooltip(
            feature.properties['Final area'] || 'Unnamed',
            { sticky: true, direction: 'bottom', offset: L.point(0, 25), className: 'final-area-tooltip', opacity: 0.95 }
          );
          layer.on({
            mouseover: e => { e.target.setStyle({ color: '#007BFF', weight: 3 }); e.target.bringToFront(); },
            mouseout:  e => { finalAreasBoundaryLayer.resetStyle(e.target); }
          });
        }
      });
    }

    createScaleupLayers();
  } catch (error) {
    console.error('Error processing scaleup data:', error);
  } finally {
    finalizeMapSetup();
  }
}

map.on('popupopen', () => {
  if (finalAreasBoundaryLayer) finalAreasBoundaryLayer.eachLayer(l => l.closeTooltip());
});

function loadClusterRegions(callback) {
  Papa.parse('data/cluster_regions.csv', {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: function (results) {
      var data = results.data;
      if (!data.length) { console.warn('cluster_regions.csv is empty'); callback(); return; }

      var firstRow = data[0];
      var sectorColumns = Object.keys(firstRow).filter(col => col && col !== 'CLUSTER No');

      data.forEach(function (row) {
        var clusterNo = row['CLUSTER No'];
        if (!clusterNo) return;
        sectorColumns.forEach(function (sectorName) {
          var region = row[sectorName];
          if (!region) return;
          if (!clusterRegions[sectorName]) clusterRegions[sectorName] = {};
          clusterRegions[sectorName][clusterNo] = region;
        });
      });
      callback();
    },
    error: function (error) {
      console.error('Error parsing cluster regions CSV:', error);
      callback();
    }
  });
}

// ── initSectorsFromMaster ─────────────────────────────────────
// Must be defined before loadMasterClusters() is called.

function initSectorsFromMaster() {
  if (!masterClusterData || !masterClusterData.length) {
    console.warn('masterClusterData is empty – cannot init sectors');
    return;
  }

  const uniqueSectors = Array.from(
    new Set(
      masterClusterData
        .map(row => (row.Sector || '').trim().replace(/_/g, ' '))
        .filter(Boolean)
    )
  ).sort();

  sectors = {};
  uniqueSectors.forEach(name => { sectors[name] = true; });

  sectorColors = {};
  const palette = chroma.scale('Set2').colors(uniqueSectors.length || 1);
  uniqueSectors.forEach((name, idx) => {
    sectorColors[name] = palette[idx % palette.length];
  });

  console.log('Sectors initialised from master file:', uniqueSectors);
  console.log('Sector colours:', sectorColors);

  populateSectorCheckboxes(uniqueSectors);
}

// ── loadMasterClusters ────────────────────────────────────────

function loadMasterClusters() {
  Papa.parse('data/cluster_points_final.csv', {
    download: true,
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    complete: function (results) {
      masterClusterData = results.data.filter(function (row) {
        return row.Companynumber && row.Sector != null;
      });

      masterClusterData.forEach(function (row) {
        row.Latitude      = row.Latitude  != null ? parseFloat(row.Latitude)  : NaN;
        row.Longitude     = row.Longitude != null ? parseFloat(row.Longitude) : NaN;
        row.cluster       = row.cluster   != null ? row.cluster.toString()    : '0';
        row.Sector        = (row.Sector   || '').trim();
        row.Companynumber = row.Companynumber.toString().trim();
        row.Companyname   = row.Companyname || 'Unknown';
      });

      console.log('Loaded master clusters:', masterClusterData.length);
      initSectorsFromMaster();
    },
    error: function (err) {
      console.error('Error parsing master clusters CSV:', err);
    }
  });
}

loadMasterClusters();

// ── Other data loads ──────────────────────────────────────────

Papa.parse('data/university_data.csv', {
  header: true,
  download: true,
  dynamicTyping: true,
  complete: function (results) {
    universityData = results.data;
    console.log('University data loaded:', universityData);
  }
});

Papa.parse('data/Infrastructure_data.csv', {
  download: true,
  header: true,
  dynamicTyping: true,
  skipEmptyLines: true,
  complete: function (results) { infrastructureData = results.data; },
  error: function (error) { console.error('Error parsing infrastructure CSV:', error); }
});

Papa.parse('data/support_program.csv', {
  download: true,
  header: true,
  dynamicTyping: true,
  skipEmptyLines: true,
  complete: function (results) { supportProgramData = results.data; },
  error: function (err) { console.error('Error parsing Support Program CSV:', err); }
});

Papa.parse('data/company_stats_with_financials.csv', {
  download: true,
  header: true,
  dynamicTyping: true,
  skipEmptyLines: true,
  complete: function (results) {
    companyDetailsByNumber = {};
    results.data.forEach(function (row) {
      var num = row.CompanyNumber ? row.CompanyNumber.toString().trim() : null;
      if (!num) return;
      companyDetailsByNumber[num] = row;
    });
    console.log('Company details loaded:', Object.keys(companyDetailsByNumber).length, 'records');
  },
  error: function (err) { console.error('Error parsing company details CSV:', err); }
});

// ── Map setup ─────────────────────────────────────────────────

function finalizeMapSetup() {
  console.log('finalizeMapSetup called');
  updateSearchControl('');
  updateLegend('');
  addLegend();
}

document.querySelectorAll('#layer-selection input[type=checkbox]').forEach(function (checkbox) {
  checkbox.addEventListener('change', function () {
    const panel    = document.getElementById('sector-stats-panel');
    const controls = document.querySelector('.leaflet-control-container');

    var sectorCheckboxes = document.querySelectorAll('.sector-checkbox');
    if (this.checked) {
      sectorCheckboxes.forEach(function (sectorCheckbox) {
        if (sectorCheckbox.checked) sectorCheckbox.checked = false;
      });
      currentSectors = [];
      removeClusterLayers();
      document.getElementById('overall-stats-button').style.display = 'none';

      panel.classList.toggle('show');
      controls.classList.toggle('controls-shift-right');

      switch (this.id) {
        case 'local-authorities': map.addLayer(localAuthoritiesLayer); break;
        case 'final-areas':       map.addLayer(finalAreasLayer);       break;
        case 'scaleup-density':   map.addLayer(scaleupLayers['Scaleup density per 100k (2022)']); break;
        case 'avg-growth':        map.addLayer(scaleupLayers['Avg growth in scaleup density (2013-2022)']); break;
        default: console.warn('Unknown layer:', this.id);
      }

      document.querySelectorAll('#layer-selection input[type=checkbox]').forEach(function (cb) {
        if (cb !== checkbox && cb.checked) {
          cb.checked = false;
          switch (cb.id) {
            case 'local-authorities': if (map.hasLayer(localAuthoritiesLayer)) map.removeLayer(localAuthoritiesLayer); break;
            case 'final-areas':       if (map.hasLayer(finalAreasBoundaryLayer)) map.removeLayer(finalAreasBoundaryLayer); break;
            case 'scaleup-density':   if (map.hasLayer(scaleupLayers['Scaleup density per 100k (2022)'])) map.removeLayer(scaleupLayers['Scaleup density per 100k (2022)']); break;
            case 'avg-growth':        if (map.hasLayer(scaleupLayers['Avg growth in scaleup density (2013-2022)'])) map.removeLayer(scaleupLayers['Avg growth in scaleup density (2013-2022)']); break;
            default: console.warn('Unknown layer:', cb.id);
          }
        }
      });

      var layerName = layerNames[this.id];
      updateLegend(layerName);
      updateSearchControl(layerName);
    } else {
      switch (this.id) {
        case 'local-authorities': if (map.hasLayer(localAuthoritiesLayer)) map.removeLayer(localAuthoritiesLayer); break;
        case 'final-areas':       if (map.hasLayer(finalAreasLayer))       map.removeLayer(finalAreasLayer);       break;
        case 'scaleup-density':   if (map.hasLayer(scaleupLayers['Scaleup density per 100k (2022)'])) map.removeLayer(scaleupLayers['Scaleup density per 100k (2022)']); break;
        case 'avg-growth':        if (map.hasLayer(scaleupLayers['Avg growth in scaleup density (2013-2022)'])) map.removeLayer(scaleupLayers['Avg growth in scaleup density (2013-2022)']); break;
        default: console.warn('Unknown layer:', this.id);
      }
      updateLegend('');
      updateSearchControl('');
    }

    if (currentSectors.length === 0) {
      if (map.hasLayer(universityLayer))     map.removeLayer(universityLayer);
      if (map.hasLayer(infrastructureLayer)) map.removeLayer(infrastructureLayer);
      var overlaySelect = document.getElementById('overlay-select');
      if (overlaySelect) overlaySelect.value = 'none';
      hideSectorStats();
    }

    map.closePopup();
  });
});

// ── Style functions ───────────────────────────────────────────

function localAuthoritiesStyle(feature) {
  return { fillColor: getColor(feature.properties['Final area']), weight: 0.5, color: '#333', fillOpacity: 0.8, interactive: true };
}

function finalAreasStyle(feature) {
  return { fillColor: getColor(feature.properties['Final area']), weight: 1, color: '#000', fillOpacity: 0.7, interactive: true };
}

function highlightPolygon(polygon) {
  polygon.setStyle({ weight: 3, color: '#999894', fillOpacity: 0.5 });
  if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) polygon.bringToFront();
}

function resetPolygonStyle(polygon) {
  polygon.setStyle({
    weight:      polygon.originalStyle.weight,
    color:       polygon.originalStyle.color,
    fillOpacity: polygon.originalStyle.fillOpacity
  });
}

function highlightFeature(e) {
  var layer = e.target;
  layer.setStyle({ weight: 3, color: '#666', fillOpacity: 0.9 });
  if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) layer.bringToFront();
}

function resetHighlight(e) {
  var layer = e.target;
  if (layer.layerSource) {
    var src = layer.layerSource;
    if (src === 'Local Authorities' && localAuthoritiesLayer)    localAuthoritiesLayer.resetStyle(layer);
    else if (src === 'Final Areas' && finalAreasLayer)           finalAreasLayer.resetStyle(layer);
    else if (scaleupLayers[src])                                 scaleupLayers[src].resetStyle(layer);
  }
}

function zoomToFeature(e) {
  map.fitBounds(e.target.getBounds());
}

function onEachLocalAuthorityFeature(feature, layer) {
  var props = feature.properties;
  layer.layerSource = 'Local Authorities';
  layer.bindPopup(`<div class="popup-content"><h3>${props.lad || props.LAD23NM}</h3><p><strong>Final Area:</strong> ${props['Final area'] || 'N/A'}</p></div>`);
  layer.on({ mouseover: highlightFeature, mouseout: resetHighlight, click: zoomToFeature });
}

function onEachFinalAreaFeature(feature, layer) {
  var props = feature.properties;
  layer.layerSource = 'Final Areas';
  layer.bindPopup(`<div class="popup-content"><h3>${props['Final area']}</h3></div>`);
  layer.on({ mouseover: highlightFeature, mouseout: resetHighlight, click: zoomToFeature });
}

function createScaleupLayers() {
  ['Scaleup density per 100k (2022)', 'Avg growth in scaleup density (2013-2022)'].forEach(function (columnName) {
    var geojsonFeatures = JSON.parse(JSON.stringify(finalAreasGeoJSONData));
    scaleupLayers[columnName] = L.geoJSON(geojsonFeatures, {
      pane: 'polygonsPane',
      style: scaleupStyleFactory(columnName),
      onEachFeature: onEachScaleupFeatureFactory(columnName)
    });
  });
}

function scaleupStyleFactory(columnName) {
  return function (feature) {
    var value = feature.properties[columnName];
    return { fillColor: getScaleupColor(value, columnName), weight: 1, color: '#000', fillOpacity: 0.7, interactive: true };
  };
}

function onEachScaleupFeatureFactory(columnName) {
  return function (feature, layer) {
    var props = feature.properties;
    var value = props[columnName] !== undefined ? props[columnName] : 'No data';
    var noOfScaleups = props['No of Scaleups (2022)'] !== undefined ? props['No of Scaleups (2022)'] : 'No data';
    layer.layerSource = columnName;
    layer.bindPopup(`<div class="popup-content"><h3>${props['Final area']}</h3><p><strong>${columnName}:</strong> ${value}</p><p><strong>No of Scaleups (2022):</strong> ${noOfScaleups}</p></div>`);
    layer.on({ mouseover: highlightFeature, mouseout: resetHighlight, click: zoomToFeature });
  };
}

// ── Legend ────────────────────────────────────────────────────

function addLegend() {
  if (legend) map.removeControl(legend);

  legend = L.control({ position: 'bottomleft' });
  legend.onAdd = function () {
    var div = L.DomUtil.create('div', 'info legend');
    div.innerHTML = `
      <div class="legend-header">
        <span><strong>Legend</strong></span>
        <button id="legend-toggle">Hide</button>
      </div>
      <div id="legend-content"></div>
    `;
    this._div = div;
    this.update('');
    return this._div;
  };

  legend.update = function (layerName) {
    var contentDiv = this._div.querySelector('#legend-content');
    var legendContainer = this._div;

    if (layerName === 'Scaleup density per 100k (2022)') {
      legendContainer.style.display = 'block';
      contentDiv.innerHTML = `<strong>${layerName}</strong><br>`;
      contentDiv.innerHTML += [
        '<i style="background:#006400"></i> Greater than 60',
        '<i style="background:#7FFFD4"></i> 50 - 60',
        '<i style="background:#87CEFA"></i> 45 - 50',
        '<i style="background:#4169E1"></i> 40 - 45',
        '<i style="background:#00008B"></i> Fewer than 40'
      ].join('<br>');
    } else if (layerName === 'Avg growth in scaleup density (2013-2022)') {
      legendContainer.style.display = 'block';
      contentDiv.innerHTML = `<strong>${layerName}</strong><br>`;
      contentDiv.innerHTML += [
        '<i style="background:#006400"></i> Greater than 2',
        '<i style="background:#20B2AA"></i> 1 - 2',
        '<i style="background:#87CEFA"></i> 0 - 1',
        '<i style="background:#00008B"></i> Fewer than 0'
      ].join('<br>');
    } else if (layerName === 'Sectors' && currentSectors.length > 0) {
      legendContainer.style.display = 'block';
      contentDiv.innerHTML = '<strong>Sectors</strong><br>';
      currentSectors.forEach(function (sector) {
        var color = sectorColors[sector] || '#FFFFFF';
        var displayName = sectorDisplayNames[sector] || sector;
        contentDiv.innerHTML += '<i style="background:' + color + '"></i> ' + displayName + '<br>';
      });
    } else {
      legendContainer.style.display = 'none';
      contentDiv.innerHTML = '';
    }
  };

  legend.addTo(map);

  map.whenReady(function () {
    var toggleButton  = document.getElementById('legend-toggle');
    var legendContent = document.getElementById('legend-content');
    if (toggleButton) {
      toggleButton.onclick = function () {
        if (legendContent.style.display === 'none') {
          legendContent.style.display = 'block';
          toggleButton.textContent = 'Hide';
        } else {
          legendContent.style.display = 'none';
          toggleButton.textContent = 'Show';
        }
      };
    }
  });
}

function updateLegend(activeLayerName) {
  if (legend) legend.update(activeLayerName);
}

function updateLegendForClusters() {}

// ── Sector & cluster UI ───────────────────────────────────────

function populateSectorCheckboxes(sectorsList) {
  const container = document.getElementById('sector-chips');
  if (!container) {
    console.error('#sector-chips container not found');
    return;
  }

  container.innerHTML = '';

  sectorsList.forEach(sector => {
    const chip = document.createElement('div');
    chip.className     = 'sector-chip';
    chip.textContent   = sectorDisplayNames[sector] || sector;
    chip.dataset.value = sector;

    chip.onclick = () => {
      chip.classList.toggle('selected');

      if (chip.classList.contains('selected')) {
        if (!window.selectionOrder.includes(sector)) window.selectionOrder.push(sector);
      } else {
        window.selectionOrder = window.selectionOrder.filter(s => s !== sector);
      }

      handleSectorSelectionChange();
      updateDisplayModeToggleVisibility();
    };

    container.appendChild(chip);
  });
}

function handleSectorSelectionChange() {
  currentSectors = getSelectedSectors();

  if (currentSectors.length > 0) {
    loadSectorsData(currentSectors);
    document.getElementById('overall-stats-button').style.display = 'block';
  } else {
    currentClusters = [];
    removeClusterLayers();
    document.getElementById('overall-stats-button').style.display = 'none';
    updateLegend('');
  }

  updateOverlays();
}

function loadSectorsData(sectorsList) {
  const statsPanel    = document.getElementById('sector-stats-panel');
  const ctrlContainer = document.querySelector('.leaflet-control-container');

  if (!sectorsList || !sectorsList.length) {
    companyData        = [];
    clusterSummaryData = {};
    removeClusterLayers();
    updateLegend('');
    document.getElementById('overall-stats-button').style.display = 'none';
    if (statsPanel)    statsPanel.classList.remove('show');
    if (ctrlContainer) ctrlContainer.classList.remove('controls-shift-right');
    return;
  }

  if (!Array.isArray(masterClusterData) || !masterClusterData.length) {
    console.warn('masterClusterData is empty or not loaded');
    return;
  }

  companyData        = [];
  clusterSummaryData = {};

  function sectorMatches(rowSector, selectedSector) {
    if (!rowSector) return false;
    const raw         = rowSector.trim();
    const dispFromRaw = raw.replace(/_/g, ' ').trim();
    return raw === selectedSector || dispFromRaw === selectedSector;
  }

  sectorsList.forEach(function (selectedSector) {
    masterClusterData.forEach(function (row) {
      if (!sectorMatches(row.Sector, selectedSector)) return;

      const compNum = row.Companynumber ? row.Companynumber.toString().trim() : null;
      if (!compNum) return;
      if (excludedCompanyNumbers.includes(compNum)) return;

      // Validate coords here so companyData only contains plottable rows
      const lat = parseFloat(row.Latitude);
      const lng = parseFloat(row.Longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      const clusterStr  = row.cluster != null ? row.cluster.toString() : '0';
      const sectorLabel = selectedSector;

      const company = {
        Companynumber : compNum,
        Latitude      : lat,
        Longitude     : lng,
        cluster       : clusterStr,
        sector        : sectorLabel,
        clusterId     : `${sectorLabel}_${clusterStr}`
      };

      const det        = companyDetailsByNumber[compNum] || {};
      const hasDetails = Object.keys(det).length > 0;

      company.Companyname        = det.CompanyName        || row.Companyname || 'Unknown';
      company.RegisteredPostcode = det.RegisteredPostcode || null;
      company.Homepage_domain    = det.Homepage_domain    || null;
      company.hasFinancials      = hasDetails;

      company.total_employees        = hasDetails ? parseNumber(det.BestEstimateEmployees) : 0;
      company.total_turnover         = hasDetails ? parseNumber(det.BestEstimateTurnover)  : 0;
      company.WomenFounded           = hasDetails ? parseInt(det.WomenLed) || 0            : 0;
      company.TotalInnovateUKFunding = hasDetails ? parseNumber(det.IUK_GBP)               : 0;
      company.total_Investment       = hasDetails ? parseNumber(det.Investment_GBP)        : 0;

      companyData.push(company);
    });
  });

  generateClusterColors();
  populateClusterCheckboxes();

  currentClusters = getAllClusterIds().filter(cid =>
    currentSectors.includes(cid.split('_')[0])
  );

  addCompanyClusters();
  updateLegend(currentSectors.length > 0 ? 'Sectors' : '');

  if (statsPanel && statsPanel.classList.contains('show')) {
    computeSectorStatistics();
    const ordered = window.selectionOrder.length ? window.selectionOrder : currentSectors;
    showSectorStatistics(ordered);
  }
}

function populateClusterCheckboxes() {
  var clusterContainer = document.getElementById('cluster-checkboxes');
  clusterContainer.innerHTML = '';

  var clusters = getAllClusterIds().filter(clusterId => {
    var sector = clusterId.split('_')[0];
    return currentSectors.includes(sector);
  });

  clusters.forEach(function (clusterId) {
    var cluster = companyData.find(c => c.clusterId === clusterId);
    if (cluster) {
      var checkbox = document.createElement('input');
      checkbox.type  = 'checkbox';
      checkbox.id    = 'cluster-' + clusterId;
      checkbox.value = clusterId;
      checkbox.classList.add('cluster-checkbox');
      checkbox.checked = true;

      var label = document.createElement('label');
      label.htmlFor    = checkbox.id;
      label.textContent = `${cluster.Cluster_name || clusterId} (Cluster ${cluster.cluster})`;
      label.prepend(checkbox);
      clusterContainer.appendChild(label);
    }
  });

  document.querySelectorAll('.cluster-checkbox').forEach(function (checkbox) {
    checkbox.addEventListener('change', function () {
      currentClusters = Array.from(document.querySelectorAll('.cluster-checkbox:checked')).map(cb => cb.value);
      updateClusterLayers();
    });
  });
}

document.getElementById('select-all-clusters').addEventListener('click', function () {
  var clusterCheckboxes = document.querySelectorAll('.cluster-checkbox');
  clusterCheckboxes.forEach(cb => { cb.checked = true; });
  currentClusters = Array.from(clusterCheckboxes).map(cb => cb.value);
  updateClusterLayers();
});

document.getElementById('deselect-all-clusters').addEventListener('click', function () {
  document.querySelectorAll('.cluster-checkbox').forEach(cb => { cb.checked = false; });
  currentClusters = [];
  updateClusterLayers();
});

// ── Cluster layers ────────────────────────────────────────────

function generateClusterColors() {
  clusterColors = {};
  var clustersInSelectedSectors = companyData.filter(company => currentSectors.includes(company.sector));
  var uniqueClusters = {};

  clustersInSelectedSectors.forEach(function (company) {
    var clusterId     = company.clusterId;
    var clusterNumber = company.cluster;
    if (clusterNumber === '0') {
      clusterColors[clusterId] = '#D3D3D3';
    } else if (!uniqueClusters[clusterId]) {
      uniqueClusters[clusterId] = true;
    }
  });

  var clusterIds  = Object.keys(uniqueClusters);
  var colorScale  = chroma.scale('Set1').colors(clusterIds.length > 0 ? clusterIds.length : 1);
  clusterIds.forEach(function (clusterId, index) {
    clusterColors[clusterId] = colorScale[index % colorScale.length];
  });
}

function addCompanyClusters() {
  updateClusterLayers();
}

function removeClusterLayers() {
  for (var clusterId in clusterLayers) map.removeLayer(clusterLayers[clusterId]);
  clusterLayers = {};
  clusterColors = {};
  currentClusters = [];
  if (clusterControl) map.removeControl(clusterControl);
  for (var sector in sectorPolygonLayers) map.removeLayer(sectorPolygonLayers[sector]);
  sectorPolygonLayers = {};
  if (polygonToggleControl) {
    map.removeControl(polygonToggleControl);
    polygonToggleControl = null;
    displayMode = 'both';
  }
}

function removeOtherLayers() {
  if (localAuthoritiesLayer && map.hasLayer(localAuthoritiesLayer)) map.removeLayer(localAuthoritiesLayer);
  if (finalAreasLayer && map.hasLayer(finalAreasLayer))             map.removeLayer(finalAreasLayer);
  for (var key in scaleupLayers) {
    if (map.hasLayer(scaleupLayers[key])) map.removeLayer(scaleupLayers[key]);
  }
  if (searchControl) map.removeControl(searchControl);
}

function updateClusterLayers() {
  console.log('updateClusterLayers called');
  console.log('Current displayMode:', displayMode);

  function easeOut(progress) {
    return 1 - Math.pow(1 - progress, 3);
  }

  function animateMarkersBatch(markers, finalRadius, finalFillOpacity, duration) {
    let startTime;
    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsed  = timestamp - startTime;
      let progress   = Math.min(elapsed / duration, 1);
      progress       = easeOut(progress);
      markers.forEach(marker => {
        marker.setStyle({ radius: finalRadius * progress, fillOpacity: finalFillOpacity * progress });
      });
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function animatePolygonsBatch(polygons, finalFillOpacity, duration) {
    let startTime;
    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      let progress  = Math.min(elapsed / duration, 1);
      progress      = easeOut(progress);
      polygons.forEach(polygon => { polygon.setStyle({ fillOpacity: finalFillOpacity * progress }); });
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // Clear existing layers
  allPolygons = [];
  for (const existingId in clusterLayers) map.removeLayer(clusterLayers[existingId]);
  clusterLayers = {};

  if (currentClusters.length === 0) { updateLegend(''); return; }

  // Group companies — coords already validated in loadSectorsData
  const clusters = {};
  companyData.forEach(company => {
    const clusterId = company.clusterId;
    if (!clusterId) return;
    if (!currentClusters.includes(clusterId)) return;
    if (!clusters[clusterId]) clusters[clusterId] = [];
    clusters[clusterId].push(company);
  });

  const newMarkers  = [];
  const newPolygons = [];

  for (const clusterId in clusters) {
    const clusterGroup = L.layerGroup();
    const points       = [];

    let companyCount       = 0;
    let totalIUKFunding    = 0;
    let femaleFoundedCount = 0;
    let totalEmployees     = 0;
    let totalTurnover      = 0;

    const firstCompany  = clusters[clusterId][0];
    const clusterNumber = String(firstCompany.cluster != null ? firstCompany.cluster : '0');

    if (clusterNumber === '0') continue;

    const sectorName  = firstCompany.sector;
    const clusterName = 'Cluster ' + clusterNumber;
    const region      =
      (clusterRegions[sectorName] && clusterRegions[sectorName][clusterNumber]) ||
      'Unknown';

    clusters[clusterId].forEach(company => {
      const lat = company.Latitude;
      const lng = company.Longitude;
      if (isNaN(lat) || isNaN(lng)) return; // safety net

      companyCount++; // incremented after coord guard — matches visible markers
      points.push([lat, lng]);

      const iukFunding = company.TotalInnovateUKFunding;
      if (typeof iukFunding === 'number' && !isNaN(iukFunding)) totalIUKFunding += iukFunding;

      const femaleFlagSource = company.WomenFounded != null ? company.WomenFounded : company.WomenLed;
      if (isFemaleFoundedFlag(femaleFlagSource)) femaleFoundedCount++;

      const emp = parseNumber(company.total_employees);
      const tov = parseNumber(company.total_turnover);
      if (!isNaN(emp)) totalEmployees += emp;
      if (!isNaN(tov)) totalTurnover  += tov;

      if (displayMode === 'points' || displayMode === 'both') {
        const marker = L.circleMarker([lat, lng], {
          pane:        'markerPane',
          radius:      0,
          fillColor:   getClusterColor(clusterId),
          color:       '#000',
          weight:      0.2,
          fillOpacity: 0
        });

        marker.bindPopup(`
          <div class="popup-content">
            <p><strong>Company Name:</strong> ${company.Companyname}</p>
            <p><strong>Company Number:</strong> ${company.Companynumber}</p>
            <p><strong>Cluster:</strong> ${region} (Cluster ${clusterNumber})</p>
            <p><strong>Sector:</strong> ${company.sector}</p>
            ${company.hasFinancials ? '' : '<p><em>No financial data available</em></p>'}
          </div>
        `);

        marker.on({
          mouseover: e => { e.target.setStyle({ radius: 5, weight: 1, color: '#fff', fillOpacity: 1 }); },
          mouseout:  e => { e.target.setStyle({ radius: 3, weight: 0.2, color: '#000', fillOpacity: 0.8 }); },
          click:     e => { e.target.openPopup(); }
        });

        clusterGroup.addLayer(marker);
        newMarkers.push(marker);
      }
    });

    const polygonColor = sectorColors[sectorName] || '#FFFFFF';

    if ((displayMode === 'polygons' || displayMode === 'both') && points.length >= 3) {
      const polygon = L.polygon(convexHull(points), {
        pane:        'polygonsPane',
        color:       polygonColor,
        fillColor:   polygonColor,
        fillOpacity: 0,
        weight:      1,
        interactive: false
      });

      polygon.originalStyle = { color: polygonColor, weight: 1, fillOpacity: 0.35 };

      const femalePct = companyCount > 0 ? (femaleFoundedCount / companyCount) * 100 : null;
      const femaleFoundedPercentageDisplay = femalePct !== null ? femalePct.toFixed(1) + '%' : 'N/A';
      const totalEmployeesDisplay          = totalEmployees > 0 ? Math.round(totalEmployees) : 'N/A';
      const totalTurnoverDisplay           = totalTurnover  > 0 ? formatTurnover(totalTurnover)  : 'N/A';
      const totalIUKFundingDisplay         = totalIUKFunding > 0 ? formatTurnover(totalIUKFunding) : 'N/A';

      polygon.bindPopup(`
        <div class="popup-content">
          <p><strong>${clusterName}</strong></p>
          <p><strong>Region:</strong> ${region}</p>
          <p><strong>Sector:</strong> ${sectorName}</p>
          <p><strong>Company Count:</strong> ${companyCount}</p>
          <p><strong>Total Employees:</strong> ${totalEmployeesDisplay}</p>
          <p><strong>Total Turnover:</strong> ${totalTurnoverDisplay}</p>
          <p><strong>% Female-Founded Companies:</strong> ${femaleFoundedPercentageDisplay}</p>
          <p><strong>Total IUK Grant Funding:</strong> ${totalIUKFundingDisplay}</p>
        </div>
      `);

      clusterGroup.addLayer(polygon);

      allPolygons.push({
        layer: polygon,
        properties: {
          clusterNumber,
          sectorName,
          clusterName,
          clusterId,
          region,
          companyCount,
          totalEmployees:                totalEmployeesDisplay,
          totalTurnover:                 totalTurnoverDisplay,
          femaleFoundedPercentageDisplay,
          totalIUKFundingDisplay
        }
      });

      newPolygons.push(polygon);
    }

    clusterLayers[clusterId] = clusterGroup;
    clusterGroup.addTo(map);
  }

  if (newMarkers.length  > 0) animateMarkersBatch(newMarkers,   3, 0.8,  800);
  if (newPolygons.length > 0) animatePolygonsBatch(newPolygons, 0.35,    800);

  updateLegend(currentSectors.length > 0 ? 'Sectors' : '');
}

// ── Stats panel ───────────────────────────────────────────────

document.getElementById('overall-stats-button').addEventListener('click', function () {
  const statsPanel   = document.getElementById('sector-stats-panel');
  const leftControls = document.querySelectorAll('.leaflet-left');

  if (statsPanel.classList.contains('show')) {
    hideSectorStats();
    return;
  }

  computeSectorStatistics();
  showSectorStatistics(currentSectors);
  leftControls.forEach(el => el.classList.add('controls-shift-right'));
});

function computeSectorStatistics() {
  sectorStats = {};

  if (!Array.isArray(companyData) || companyData.length === 0) {
    console.warn('computeSectorStatistics: no companyData available');
    return;
  }

  companyData.forEach(function (company) {
    const sector = company.sector || company.Sector;
    if (!sector) return;

    if (!sectorStats[sector]) {
      sectorStats[sector] = {
        companyCount:            0,
        companiesWithFinancials: 0,
        totalEmployees:          0,
        totalTurnover:           0,
        totalIUKFunding:         0,
        totalInvestment:         0,
        femaleFoundedCount:      0,
        femaleFoundedPercentage: 0
      };
    }

    const stats = sectorStats[sector];
    stats.companyCount += 1;
    if (company.hasFinancials) stats.companiesWithFinancials += 1;

    stats.totalEmployees  += parseNumber(company.total_employees);
    stats.totalTurnover   += parseNumber(company.total_turnover);
    stats.totalIUKFunding += parseNumber(company.TotalInnovateUKFunding);
    stats.totalInvestment += parseNumber(company.total_Investment);

    if (isFemaleFoundedFlag(company.WomenFounded)) stats.femaleFoundedCount += 1;
  });

  Object.keys(sectorStats).forEach(function (sector) {
    const stats = sectorStats[sector];
    stats.femaleFoundedPercentage = stats.companyCount > 0
      ? (stats.femaleFoundedCount / stats.companyCount) * 100
      : 0;
  });
}

function showSectorStatistics(selectedSectors) {
  const statsPanel = document.getElementById('sector-stats-panel');
  if (!statsPanel) { console.error('No stats panel found in the DOM'); return; }

  statsPanel.innerHTML = `
    <div class="stats-header">
      <h2>Sector Stats</h2>
      <button class="close-panel-btn" onclick="hideSectorStats()">&times;</button>
    </div>
  `;

  if (!selectedSectors || !selectedSectors.length) {
    statsPanel.innerHTML += `<div class="stats-card"><p>No sectors selected.</p></div>`;
    statsPanel.classList.add('show');
    statsPanel.classList.remove('hidden');
    return;
  }

  selectedSectors.forEach(sector => {
    const stats = sectorStats[sector];
    if (!stats) {
      statsPanel.innerHTML += `<div class="stats-card"><h3>${sector}</h3><p>No statistics available.</p></div>`;
      return;
    }

    const noFinancials = stats.companyCount - stats.companiesWithFinancials;
    const noFinancialsNote = noFinancials > 0
      ? `<p style="font-size:12px;color:#888;">(${noFinancials} with no financial data)</p>`
      : '';

    statsPanel.innerHTML += `
      <div class="stats-card">
        <h3>${sector}</h3>
        <p><strong>Companies:</strong> ${stats.companyCount}</p>
        ${noFinancialsNote}
        <p><strong>Total Employees:</strong> ${stats.totalEmployees > 0 ? Math.round(stats.totalEmployees) : 'N/A'}</p>
        <p><strong>Total Turnover:</strong> ${stats.totalTurnover > 0 ? formatTurnover(stats.totalTurnover) : 'N/A'}</p>
        <p><strong>% Female-Founded:</strong> ${stats.femaleFoundedPercentage.toFixed(1)}%</p>
        <p><strong>IUK Funding:</strong> ${stats.totalIUKFunding > 0 ? formatTurnover(stats.totalIUKFunding) : 'N/A'}</p>
        <p><strong>Investment:</strong> ${stats.totalInvestment > 0 ? formatTurnover(stats.totalInvestment) : 'N/A'}</p>
      </div>
    `;
  });

  statsPanel.classList.remove('hidden');
  statsPanel.classList.add('show');
}

function hideSectorStats() {
  const statsPanel   = document.getElementById('sector-stats-panel');
  const leftControls = document.querySelectorAll('.leaflet-left');
  statsPanel.classList.remove('show');
  leftControls.forEach(el => el.classList.remove('controls-shift-right'));
}

// ── Map click / hover handlers ────────────────────────────────

map.on('mousemove', handleMapMouseMove);
map.on('click',    handleMapClick);

function isPointInPolygon(latlng, polygon) {
  var layerPoint = map.latLngToLayerPoint(latlng);
  var inside     = false;
  var parts      = polygon._parts;
  if (!parts) return false;

  for (var i = 0; i < parts.length; i++) {
    var part = parts[i];
    var len  = part.length;
    for (var j = 0, k = len - 1; j < len; k = j++) {
      var xi = part[j].x, yi = part[j].y;
      var xj = part[k].x, yj = part[k].y;
      var intersect = ((yi > layerPoint.y) !== (yj > layerPoint.y)) &&
                      (layerPoint.x < (xj - xi) * (layerPoint.y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
  }
  return inside;
}

function handleMapMouseMove(e) {
  var latlng = e.latlng;

  highlightedPolygons.forEach(function (polygon) { resetPolygonStyle(polygon); });
  highlightedPolygons = [];

  allPolygons.forEach(function (polygonData) {
    var polygon = polygonData.layer;
    if (isPointInPolygon(latlng, polygon)) {
      highlightPolygon(polygon);
      highlightedPolygons.push(polygon);
    }
  });
}

function handleMapClick(e) {
  var latlng          = e.latlng;
  var polygonsAtPoint = [];

  allPolygons.forEach(function (polygonData) {
    var polygon = polygonData.layer;
    if (isPointInPolygon(latlng, polygon)) {
      var alreadyAdded = polygonsAtPoint.some(pd => pd.layer._leaflet_id === polygon._leaflet_id);
      if (!alreadyAdded) polygonsAtPoint.push(polygonData);
    }
  });

  if (polygonsAtPoint.length === 0) {
    map.closePopup();
  } else if (polygonsAtPoint.length === 1) {
    showPolygonInfoPopup(polygonsAtPoint[0], latlng);
  } else {
    showPolygonSelectionPopup(polygonsAtPoint, latlng);
  }
}

function showPolygonInfoPopup(polygonData, latlng) {
  var props             = polygonData.properties;
  var sectorDisplayName = sectorDisplayNames[props.sectorName] || props.sectorName;

  L.popup().setLatLng(latlng).setContent(`
    <div class="popup-content">
      <h3>${props.region} (Cluster ${props.clusterNumber})</h3>
      <p><strong>Sector:</strong> ${sectorDisplayName}</p>
      <p><strong>Company Count:</strong> ${props.companyCount}</p>
      <p><strong>Total Employees:</strong> ${props.totalEmployees}</p>
      <p><strong>Total Turnover:</strong> ${props.totalTurnover}</p>
      <p><strong>% Female-Founded Companies:</strong> ${props.femaleFoundedPercentageDisplay}</p>
      <p><strong>Total IUK Grant Funding:</strong> ${props.totalIUKFundingDisplay}</p>
    </div>
  `).openOn(map);
}

function showPolygonInfo(polygonData) {
  var props             = polygonData.properties;
  var sectorDisplayName = sectorDisplayNames[props.sectorName] || props.sectorName;
  var content = `
    <button id="info-box-close" class="info-box-close">&times;</button>
    <h3>${props.region} (Cluster ${props.clusterNumber})</h3>
    <p><strong>Sector:</strong> ${sectorDisplayName}</p>
    <p><strong>Company Count:</strong> ${props.companyCount}</p>
    <p><strong>Total Employees:</strong> ${props.totalEmployees}</p>
    <p><strong>Total Turnover:</strong> ${props.totalTurnover}</p>
    <p><strong>% Female-Founded Companies:</strong> ${props.femaleFoundedPercentageDisplay}</p>
    <p><strong>Total IUK Grant Funding:</strong> ${props.totalIUKFundingDisplay}</p>
  `;
  var infoBox = document.getElementById('info-box');
  if (infoBox) {
    infoBox.innerHTML = content;
    infoBox.classList.remove('hidden');
    L.DomEvent.disableClickPropagation(infoBox);
    var closeButton = document.getElementById('info-box-close');
    if (closeButton) {
      closeButton.addEventListener('click', function (e) {
        infoBox.classList.add('hidden');
        e.stopPropagation();
      });
    }
  }
}

function showPolygonSelectionPopup(polygonsData, latlng) {
  var content = document.createElement('div');
  content.className = 'popup-content';

  var tabsContainer        = document.createElement('div');
  tabsContainer.className  = 'tabs-container';
  var tabLinks             = document.createElement('ul');
  tabLinks.className       = 'tab-links';
  var tabContentContainer  = document.createElement('div');
  tabContentContainer.className = 'tab-content';

  var currentlyHighlightedPolygon = null;

  polygonsData.forEach(function (polygonData, index) {
    var props             = polygonData.properties;
    var sectorDisplayName = sectorDisplayNames[props.sectorName] || props.sectorName;
    var sectorColor       = sectorColors[props.sectorName] || '#FFFFFF';

    var tabLinkItem = document.createElement('li');
    var tabLink     = document.createElement('a');
    tabLink.href    = '#';
    tabLink.setAttribute('data-index', index);
    tabLink.textContent = `Cluster ${props.clusterNumber} (${sectorDisplayName})`;
    tabLink.style.backgroundColor = sectorColor;
    tabLink.style.color = getContrastColor(sectorColor);

    if (index === 0) {
      tabLinkItem.classList.add('active');
      var darkerColor = chroma(sectorColor).darken(1).hex();
      tabLink.style.backgroundColor = darkerColor;
      tabLink.style.color = getContrastColor(darkerColor);
    }

    tabLinkItem.appendChild(tabLink);
    tabLinks.appendChild(tabLinkItem);

    var tabContent = document.createElement('div');
    tabContent.className = 'tab';
    tabContent.setAttribute('data-index', index);
    if (index === 0) tabContent.classList.add('active');

    tabContent.innerHTML = `
      <p><strong>Sector:</strong> ${sectorDisplayName}</p>
      <p><strong>Company Count:</strong> ${props.companyCount}</p>
      <p><strong>Total Employees:</strong> ${props.totalEmployees}</p>
      <p><strong>Total Turnover:</strong> ${props.totalTurnover}</p>
      <p><strong>% Female-Founded Companies:</strong> ${props.femaleFoundedPercentageDisplay}</p>
      <p><strong>Total IUK Grant Funding:</strong> ${props.totalIUKFundingDisplay}</p>
    `;

    tabContentContainer.appendChild(tabContent);

    tabLink.addEventListener('click', function (e) {
      e.preventDefault();
      switchTab(e.currentTarget.getAttribute('data-index'));
    });
  });

  tabsContainer.appendChild(tabLinks);
  tabsContainer.appendChild(tabContentContainer);
  content.appendChild(tabsContainer);

  L.popup().setLatLng(latlng).setContent(content).openOn(map);

  function switchTab(index) {
    tabLinks.querySelectorAll('li').forEach(function (linkItem) {
      linkItem.classList.remove('active');
      var link        = linkItem.querySelector('a');
      var sc          = sectorColors[polygonsData[link.getAttribute('data-index')].properties.sectorName] || '#FFFFFF';
      link.style.backgroundColor = sc;
      link.style.color = getContrastColor(sc);
    });
    tabContentContainer.querySelectorAll('.tab').forEach(tc => tc.classList.remove('active'));

    var selectedLinkItem = tabLinks.querySelector(`a[data-index="${index}"]`).parentElement;
    selectedLinkItem.classList.add('active');
    var selectedLink  = selectedLinkItem.querySelector('a');
    var sc            = sectorColors[polygonsData[index].properties.sectorName] || '#FFFFFF';
    var darkerColor   = chroma(sc).darken(1).hex();
    selectedLink.style.backgroundColor = darkerColor;
    selectedLink.style.color = getContrastColor(darkerColor);

    tabContentContainer.querySelector(`.tab[data-index="${index}"]`).classList.add('active');
    highlightSelectedPolygon(polygonsData[index].layer);
  }

  function highlightSelectedPolygon(polygon) {
    if (currentlyHighlightedPolygon && currentlyHighlightedPolygon !== polygon) {
      resetPolygonStyle(currentlyHighlightedPolygon);
    }
    highlightPolygon(polygon);
    currentlyHighlightedPolygon = polygon;
  }

  highlightSelectedPolygon(polygonsData[0].layer);

  map.on('popupclose', function () {
    if (currentlyHighlightedPolygon) {
      resetPolygonStyle(currentlyHighlightedPolygon);
      currentlyHighlightedPolygon = null;
    }
  });
}

// ── Search control ────────────────────────────────────────────

var searchControl;

function updateSearchControl(activeLayerName) {
  if (searchControl) { map.removeControl(searchControl); searchControl = null; }

  var searchLayer, propertyName;

  if (activeLayerName === 'Local Authorities' && localAuthoritiesLayer) {
    searchLayer  = localAuthoritiesLayer;
    propertyName = 'lad';
  } else if (activeLayerName === 'Final Areas' && finalAreasLayer) {
    searchLayer  = finalAreasLayer;
    propertyName = 'Final area';
  } else if (activeLayerName === 'Scaleup density per 100k (2022)' && scaleupLayers['Scaleup density per 100k (2022)']) {
    searchLayer  = scaleupLayers['Scaleup density per 100k (2022)'];
    propertyName = 'Final area';
  } else if (activeLayerName === 'Avg growth in scaleup density (2013-2022)' && scaleupLayers['Avg growth in scaleup density (2013-2022)']) {
    searchLayer  = scaleupLayers['Avg growth in scaleup density (2013-2022)'];
    propertyName = 'Final area';
  } else {
    return;
  }

  searchControl = new L.Control.Search({
    layer: searchLayer,
    propertyName: propertyName,
    marker: false,
    initial: false,
    zoom: 12,
    title: 'Search',
    moveToLocation: function (latlng) {
      map.fitBounds(latlng.layer.getBounds());
      highlightFeature({ target: latlng.layer });
    }
  });
  searchControl.on('search:locationfound', function (e) { e.layer.openPopup(); });
  searchControl.addTo(map);
}

// ── Boundary toggle ───────────────────────────────────────────

const BoundaryToggle = L.Control.extend({
  onAdd: function () {
    const btn = L.DomUtil.create('button', 'boundary-toggle');
    btn.title = 'Show Final-Area boundaries';
    btn.innerHTML = 'Borders';
    btn.style.cssText = 'background:#fff;border:1px solid #888;border-radius:4px;padding:2px 6px;font:14px/1 sans-serif;cursor:pointer;';
    let active = false;

    btn.onclick = e => {
      e.stopPropagation();
      active = !active;

      if (active) {
        if (finalAreasBoundaryLayer) finalAreasBoundaryLayer.addTo(map);
        map.eachLayer(l => { if (l instanceof L.TileLayer) l.setOpacity(0.4); });
        if (!faSearchControl) faSearchControl = new FinalAreaSearchControl({ position: 'topleft' }).addTo(map);
        btn.style.background = '#007BFF';
        btn.style.color      = '#fff';
      } else {
        if (finalAreasBoundaryLayer) map.removeLayer(finalAreasBoundaryLayer);
        map.eachLayer(l => { if (l instanceof L.TileLayer) l.setOpacity(1); });
        if (faSearchControl) { map.removeControl(faSearchControl); faSearchControl = null; }
        btn.style.background = '#fff';
        btn.style.color      = '#000';
      }
    };

    return btn;
  }
});
new BoundaryToggle({ position: 'topleft' }).addTo(map);

// ── Overlays ──────────────────────────────────────────────────

var overlaySelect = document.getElementById('overlay-select');
overlaySelect.addEventListener('change', updateOverlays);

function updateOverlays() {
  var value = overlaySelect.value;

  if (map.hasLayer(universityLayer))     map.removeLayer(universityLayer);
  if (map.hasLayer(infrastructureLayer)) map.removeLayer(infrastructureLayer);
  if (map.hasLayer(supportProgramLayer)) map.removeLayer(supportProgramLayer);

  if (value === 'universities'   || value === 'both') { addUniversitiesToMap();    if (universityLayer.getLayers().length)     universityLayer.addTo(map); }
  if (value === 'infrastructure' || value === 'both') { addInfrastructureToMap(); if (infrastructureLayer.getLayers().length) infrastructureLayer.addTo(map); }
  if (value === 'support-program'|| value === 'both') { addSupportProgramsToMap();if (supportProgramLayer.getLayers().length) supportProgramLayer.addTo(map); }

  const legend = document.getElementById('support-legend');
  if (!legend) return;
  const showLegend = value === 'universities' || value === 'infrastructure' || value === 'support-program' || value === 'both';
  legend.style.display = showLegend ? 'flex' : 'none';
  if (showLegend) populateSupportLegend();
}

function addUniversiti
function getClusterNameById(clusterId) {
  var company = companyData.find(function (comp) { return comp.clusterId === clusterId; });
  if (company) return company.Cluster_name + ' (Cluster ' + company.cluster + ')';
  return clusterId;
}
