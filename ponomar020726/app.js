"use strict";

const OTHER_CATEGORY = "__other__";
const PANEL_WIDTH_KEY = "qwp.layersWidth";
const EXCHANGE_COLLAPSED_KEY = "qwp.exchangeCollapsed";
const LABEL_MIN_ZOOM = 14;
const state = { config:null, map:null, datasets:new Map(), centroidDatasets:new Map(), selected:null, filters:new Map(), categoryFilters:new Map(), layerVisible:new Map(), layerRenderOptions:new Map(), originalLayerStyles:new Map(), authorMode:false, labelsVisible:true, measureMode:null, measurePoints:[], measureCursor:null, toastTimer:null, popup:null, failedSources:new Set(), exchange:null, exchangePreset:null, exchangeQuery:"", searchMatches:[] };

document.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    state.config = await fetchJson("config.json");
    document.title = state.config.app.title;
    document.getElementById("appTitle").textContent = state.config.app.title;
    initializeLayerDefaults();
    snapshotOriginalLayerStyles();
    await applyPersistedStyleOverrides();
    applyUrlStyleOverrides();

    await Promise.all(state.config.layers.map(async (layer) => {
      if (layer.format === "geojson") state.datasets.set(layer.id, await fetchJson(layer.data));
    }));
    initializeExchangeState();

    if (window.pmtiles) {
      const protocol = new pmtiles.Protocol();
      maplibregl.addProtocol("pmtiles", protocol.tile);
    }

    applyStoredPanelWidth();
    createMap();
    bindUi();
    renderLayerList();
    renderSearchFields();
    renderExchangePanel();
    applyStoredPanelStates();
    lucide.createIcons();
  } catch (error) {
    console.error(error);
    document.getElementById("mapMessage").textContent = `Не удалось открыть карту: ${error.message}`;
    document.getElementById("mapMessage").classList.add("visible");
  }
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

function createMap() {
  const config = state.config;
  state.map = new maplibregl.Map({
    container:"map",
    style:{
      version:8,
      sources:basemapSources(config),
      layers:basemapLayers(config)
    },
    center:config.map.center,
    zoom:config.map.zoom,
    minZoom:config.map.minZoom,
    maxZoom:config.map.maxZoom,
    attributionControl:false
  });

  const mapRegionObserver = new ResizeObserver(() => state.map.resize());
  mapRegionObserver.observe(document.querySelector(".map-region"));

  state.map.on("load", () => {
    addMeasureLayers();
    config.layers.slice().reverse().forEach(addConfiguredLayer);
    config.layers.filter((layer) => layer.style?.lineOnTop).forEach((layer) => state.map.moveLayer(`${layer.id}-line`));
    updateMapStatus();
  });

  state.map.on("mousemove", (event) => {
    document.getElementById("coordinates").innerHTML = `<i data-lucide="crosshair"></i> Координаты: ${event.lngLat.lat.toFixed(6)}, ${event.lngLat.lng.toFixed(6)}`;
    lucide.createIcons({nodes:[document.getElementById("coordinates")]});
  });
  state.map.on("zoom", () => { updateMapStatus(); refreshCentroidLayers(); refreshPointLabelLayers(); updateLabelVisibilityUi(); });
  state.map.on("click", handleMapClick);
  state.map.on("dblclick", handleMeasureDoubleClick);
  state.map.on("error", handleMapError);
}

function normalizeBasemaps(config) {
  if (Array.isArray(config.basemaps) && config.basemaps.length) return config.basemaps;
  const base = config.basemap || {};
  return [{id:"basemap",label:"Подложка",type:"raster",tiles:base.tiles || [],tileSize:base.tileSize || 256,attribution:base.attribution || "",visible:true}];
}

function basemapSources(config) {
  const sources = {};
  normalizeBasemaps(config).forEach((basemap) => {
    if (basemap.type === "vector") {
      sources[basemap.id] = basemap.url
        ? {type:"vector",url:basemap.url,attribution:basemap.attribution || ""}
        : {type:"vector",tiles:basemap.tiles || [],minzoom:basemap.minZoom ?? basemap.minzoom ?? 0,maxzoom:basemap.maxZoom ?? basemap.maxzoom ?? 22,attribution:basemap.attribution || ""};
    } else {
      sources[basemap.id] = {type:"raster",tiles:basemap.tiles || [],tileSize:basemap.tileSize || 256,attribution:basemap.attribution || ""};
    }
  });
  return sources;
}

function basemapLayers(config) {
  return normalizeBasemaps(config).slice().sort((a, b) => basemapSortWeight(a) - basemapSortWeight(b)).flatMap((basemap) => {
    const visibility = basemap.visible === false ? "none" : "visible";
    if (basemap.type !== "vector") return [{id:basemap.id,type:"raster",source:basemap.id,layout:{visibility}}];
    return (basemap.layers || []).map((layer, index) => ({
      id:basemapLayerId(basemap, index),
      type:layer.type || "line",
      source:basemap.id,
      "source-layer":layer.sourceLayer || layer.sourceLayerName || layer["source-layer"],
      layout:{visibility},
      paint:layer.paint || {}
    }));
  });
}

function basemapSortWeight(basemap) {
  if (basemap.overlay) return 2;
  return basemap.type === "vector" ? 1 : 0;
}

function basemapLayerId(basemap, index) {
  return basemap.id + "-" + (index + 1);
}

function basemapRenderedLayerIds(basemap) {
  if (basemap.type !== "vector") return [basemap.id];
  return (basemap.layers || []).map((_, index) => basemapLayerId(basemap, index));
}

function pointLabelField(layer) {
  return layer.pointLabel?.field || "";
}

function pointLabelExpression(layer) {
  const field = pointLabelField(layer);
  return field ? ["to-string", ["coalesce", ["get", field], ""]] : "";
}

function addConfiguredLayer(layer) {
  const source = layer.format === "pmtiles"
    ? {type:"vector",url:`pmtiles://${layer.data}`}
    : {type:"geojson",data:state.datasets.get(layer.id),promoteId:"id"};
  state.map.addSource(layer.id, source);
  if (layer.exchange) {
    addExchangeLayer(layer);
    applyExchangeVisibility(layer);
    return;
  }
  const sourceLayer = layer.sourceLayer ? {"source-layer":layer.sourceLayer} : {};
  const visibility = layer.visible ? "visible" : "none";
  const fillColor = styleColorExpression(layer, "fillBy", layer.style.fillColor);
  const lineColor = styleColorExpression(layer, "lineBy", layer.style.lineColor);
  if (layer.kind === "Point") {
    state.map.addLayer({
      id:`${layer.id}-point`, type:"circle", source:layer.id, ...sourceLayer,
      layout:{visibility},
      paint:{
        "circle-color":["case",["boolean",["feature-state","selected"],false],"#ffea00",layer.style?.pointColor || layer.style?.fillColor || "#d85f5f"],
        "circle-radius":["case",["boolean",["feature-state","selected"],false],Math.max(8, Number(layer.style?.pointRadius || 6) + 1),Number(layer.style?.pointRadius || 6)],
        "circle-stroke-color":["case",["boolean",["feature-state","selected"],false],"#5f4d00",layer.style?.pointStrokeColor || layer.style?.lineColor || "#1f2937"],
        "circle-stroke-width":["case",["boolean",["feature-state","selected"],false],Math.max(2, Number(layer.style?.pointStrokeWidth || 1.25) + 0.4),Number(layer.style?.pointStrokeWidth || 1.25)],
        "circle-opacity":0.96
      }
    });
    state.map.addLayer({
      id:`${layer.id}-point-label`, type:"symbol", source:layer.id, ...sourceLayer,
      layout:{
        visibility:"none",
        "symbol-placement":"point",
        "text-field":pointLabelExpression(layer),
        "text-size":12,
        "text-font":["Open Sans Semibold"],
        "text-anchor":"top",
        "text-offset":[0,-1.2],
        "text-max-width":100,
        "text-allow-overlap":false,
        "text-ignore-placement":false,
        "symbol-sort-key":1
      },
      paint:{
        "text-color":"#111111",
        "text-halo-color":"rgba(255,255,255,0.80)",
        "text-halo-width":2.2,
        "text-halo-blur":0.2
      }
    });
    applyCombinedLayerFilter(layer);
    applyLayerRenderOptions(layer);
    return;
  }
  if (layer.kind === "Polygon" && (layer.style.fillOpacity ?? 0) > 0) {
    state.map.addLayer({
      id:`${layer.id}-fill`, type:"fill", source:layer.id, ...sourceLayer,
      layout:{visibility},
      paint:{
        "fill-color":["case",["boolean",["feature-state","selected"],false],"#ffea00",fillColor],
        "fill-opacity":["case",["boolean",["feature-state","selected"],false],0.75,layer.style.fillOpacity ?? 0.5]
      }
    });
  }
  state.map.addLayer({
    id:`${layer.id}-line`, type:"line", source:layer.id, ...sourceLayer,
    layout:{visibility},
    paint:{
      "line-color":["case",["boolean",["feature-state","selected"],false],"#ffd400",lineColor],
      "line-width":["case",["boolean",["feature-state","selected"],false],4.4,layer.style.lineWidth]
    }
  });
  if (layer.style?.other && categoryRule(layer)) {
    state.map.addLayer({
      id:`${layer.id}-other-line`, type:"line", source:layer.id, ...sourceLayer,
      layout:{visibility},
      paint:{
        "line-color":layer.style.other.lineColor || "#4b5563",
        "line-opacity":1,
        "line-width":layer.style.other.lineWidth ?? 0.7
      }
    });
  }
  ensureCentroidLayer(layer);
  applyCombinedLayerFilter(layer);
  applyLayerRenderOptions(layer);
}


function exchangeLayer() {
  return state.config?.layers?.find((layer) => layer.exchange) || null;
}

function exchangeFieldLabel(layer, key) {
  return key || "\u0411\u0435\u0437 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u044f";
}

function exchangeValueFallback(value) {
  return value || "\u0411\u0435\u0437 \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u044f";
}

function exchangeValueToken(value) {
  return encodeURIComponent(value);
}

function decodeExchangeValueToken(value) {
  try {
    return decodeURIComponent(value || "");
  } catch (error) {
    return value || "";
  }
}

function exchangeEnabledMap(values, presetValues) {
  if (!presetValues) return Object.fromEntries(values.map((value) => [value, true]));
  const presetMap = Array.isArray(presetValues)
    ? Object.fromEntries(presetValues.map((value) => [value, true]))
    : presetValues;
  return Object.fromEntries(values.map((value) => [value, presetMap[value] !== false]));
}

function exchangeFeatureGroups(layer) {
  const borderField = layer.exchange?.borderField;
  const patternField = layer.exchange?.patternField;
  const groups = new Map();
  (state.datasets.get(layer.id)?.features || []).forEach((feature) => {
    const groupValue = String(feature.properties?.[borderField] ?? '');
    const subgroupValue = String(feature.properties?.[patternField] ?? '');
    if (!groups.has(groupValue)) groups.set(groupValue, new Set());
    groups.get(groupValue).add(subgroupValue);
  });
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right, 'ru'))
    .map(([groupValue, subgroupSet]) => ({
      value: groupValue,
      subgroups: [...subgroupSet].sort((left, right) => left.localeCompare(right, 'ru')),
    }));
}

function buildExchangeGroups(layer, preset) {
  const legacyBorders = exchangeEnabledMap(uniqueExchangeValues(layer, layer.exchange?.borderField), preset.borderValues);
  return exchangeFeatureGroups(layer).map((group) => {
    const presetGroup = preset.groups?.[group.value] || {};
    const subgroupPreset = presetGroup.subgroups || {};
    const subgroups = Object.fromEntries(group.subgroups.map((subgroup) => [subgroup, subgroupPreset[subgroup] !== false]));
    const hasEnabled = Object.values(subgroups).some((enabled) => enabled !== false);
    return {
      value: group.value,
      enabled: presetGroup.enabled !== undefined ? presetGroup.enabled !== false : legacyBorders[group.value] !== false && hasEnabled,
      subgroups,
    };
  });
}

function initializeExchangeState() {
  const layer = exchangeLayer();
  if (!layer) {
    state.exchange = null;
    return;
  }
  const preset = state.exchangePreset || {};
  state.exchange = {
    visible: preset.visible !== false && (state.layerVisible.get(layer.id) ?? (layer.visible !== false)),
    labelsVisible: preset.labelsVisible === true,
    groups: buildExchangeGroups(layer, preset),
  };
  layer.exchange._borderColors = buildExchangeColorMap(layer, layer.exchange.borderField, 18, 48);
  layer.exchange._fillColors = buildExchangeColorMap(layer, layer.exchange.patternField, 198, 58);
}

function exchangeGroupState(value) {
  return (state.exchange?.groups || []).find((group) => group.value === value) || null;
}

function setAllExchangeCategories(enabled) {
  const layer = exchangeLayer();
  if (!layer || !state.exchange) return;
  state.exchange.groups.forEach((group) => {
    group.enabled = Boolean(enabled);
    Object.keys(group.subgroups || {}).forEach((subgroup) => {
      group.subgroups[subgroup] = Boolean(enabled);
    });
  });
  applyExchangeVisibility(layer);
  renderExchangePanel();
}

function setExchangeGroupToggle(value, enabled) {
  const layer = exchangeLayer();
  const group = exchangeGroupState(value);
  if (!layer || !group) return;
  group.enabled = Boolean(enabled);
  Object.keys(group.subgroups || {}).forEach((subgroup) => {
    group.subgroups[subgroup] = Boolean(enabled);
  });
  applyExchangeVisibility(layer);
  renderExchangePanel();
}

function setExchangeSubgroupToggle(groupValue, subgroupValue, enabled) {
  const layer = exchangeLayer();
  const group = exchangeGroupState(groupValue);
  if (!layer || !group) return;
  group.subgroups[subgroupValue] = Boolean(enabled);
  group.enabled = Object.values(group.subgroups).some((value) => value !== false);
  applyExchangeVisibility(layer);
  renderExchangePanel();
}

function exchangeAllCategoriesHidden() {
  const groups = state.exchange?.groups || [];
  return groups.length ? groups.every((group) => Object.values(group.subgroups || {}).every((enabled) => enabled === false)) : false;
}

function renderExchangePanel() {
  const card = document.getElementById("exchangeCard");
  const legend = document.getElementById("exchangeLegend");
  const layer = exchangeLayer();
  if (!card) return;
  if (!layer || !state.exchange) {
    card.hidden = true;
    return;
  }
  const body = document.getElementById("exchangeCardBody");
  const bodyScroll = body?.scrollTop || 0;
  card.hidden = false;
  card.classList.toggle("exchange-layer-hidden", !state.exchange.visible);
  const hideAll = document.getElementById("exchangeHideAllToggle");
  if (hideAll) hideAll.checked = exchangeAllCategoriesHidden();
  if (body) body.hidden = false;
  const title = card.querySelector('.exchange-card-header strong');
  if (title) title.textContent = '\u041e\u0431\u043c\u0456\u043d\u0438';
  const hideAllText = document.querySelector('#exchangeHideAllToggle + span');
  if (hideAllText) hideAllText.textContent = '\u0421\u0445\u043e\u0432\u0430\u0442\u0438 \u0432\u0441\u0435';
  const labelsToggle = document.getElementById("exchangeLabelsToggle");
  if (labelsToggle) labelsToggle.checked = state.exchange.labelsVisible === true;
  const labelsToggleText = document.querySelector('#exchangeLabelsToggle + span');
  if (labelsToggleText) labelsToggleText.textContent = "\u041f\u0456\u0434\u043f\u0438\u0441\u0438 \u043e\u0431\u043c\u0456\u043d\u0456\u0432";
  const exchangeSearchInput = document.getElementById("exchangeSearchInput");
  if (exchangeSearchInput) {
    exchangeSearchInput.placeholder = "";
    if (exchangeSearchInput.value !== state.exchangeQuery) exchangeSearchInput.value = state.exchangeQuery;
  }
  if (legend) legend.innerHTML = exchangeLegendHtml(layer);
  bindExchangeLegendControls();
  if (body) body.scrollTop = bodyScroll;
  updateExchangePanelToggle();
}

function applyStoredPanelStates() {
  setExchangePanelCollapsed(window.localStorage.getItem(EXCHANGE_COLLAPSED_KEY) === "1", false);
}

function setExchangePanelCollapsed(collapsed, persist = true) {
  const panel = document.getElementById("exchangeCard");
  if (!panel) return;
  panel.classList.toggle("collapsed", collapsed);
  if (persist) window.localStorage.setItem(EXCHANGE_COLLAPSED_KEY, collapsed ? "1" : "0");
  updateExchangePanelToggle();
  state.map?.resize();
}

function updateExchangePanelToggle() {
  const panel = document.getElementById("exchangeCard");
  const button = document.getElementById("toggleExchangePanel");
  const text = document.getElementById("toggleExchangePanelText");
  if (!button || !text || !panel) return;
  const collapsed = panel.classList.contains("collapsed");
  text.textContent = collapsed ? "+" : "-";
  button.setAttribute("aria-label", collapsed ? "Expand exchanges" : "Collapse exchanges");
}

function exchangeLegendHtml(layer) {
  const query = state.exchangeQuery.trim().toLocaleLowerCase("ru");
  const groups = (state.exchange?.groups || []).filter((group) => {
    if (!query) return true;
    const groupMatch = exchangeValueFallback(group.value).toLocaleLowerCase("ru").includes(query);
    if (groupMatch) return true;
    return Object.keys(group.subgroups || {}).some((subgroup) => exchangeValueFallback(subgroup).toLocaleLowerCase("ru").includes(query));
  });
  if (!groups.length) return '<div class="empty-state"><p>\u041d\u0438\u0447\u0435\u0433\u043e \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e</p></div>';
  return groups.map((group) => exchangeLegendGroup(layer, group, query)).join('');
}

function exchangeLegendGroup(layer, group, query = "") {
  const groupColor = layer.exchange?._borderColors?.[group.value] || '#49566a';
  const groupToken = exchangeValueToken(group.value);
  const subgroupRows = Object.entries(group.subgroups || {}).filter(([subgroupValue]) => !query || exchangeValueFallback(group.value).toLocaleLowerCase("ru").includes(query) || exchangeValueFallback(subgroupValue).toLocaleLowerCase("ru").includes(query)).map(([subgroupValue, enabled]) => {
    const checked = enabled !== false ? ' checked' : '';
    const subgroupToken = exchangeValueToken(subgroupValue);
    const fillColor = layer.exchange?._fillColors?.[subgroupValue] || '#c4b07a';
    return '<label class="exchange-subgroup-item"><input type="checkbox" data-exchange-group="' + groupToken + '" data-exchange-subgroup="' + subgroupToken + '"' + checked + '><span class="exchange-category-swatch"><span class="exchange-swatch fill" style="color:' + fillColor + ';opacity:.5"></span></span><span class="exchange-category-label"><span>' + escapeHtml(exchangeValueFallback(subgroupValue)) + '</span></span></label>';
  }).join('');
  const checked = group.enabled !== false ? ' checked' : '';
  return '<details class="exchange-group" open><summary class="exchange-summary"><label class="exchange-group-toggle"><input type="checkbox" data-exchange-group-toggle="' + groupToken + '"' + checked + '><span class="exchange-category-swatch"><span class="exchange-swatch line" style="color:' + groupColor + '"></span></span><span class="exchange-category-label"><span>' + escapeHtml(exchangeValueFallback(group.value)) + '</span></span></label><button type="button" class="exchange-fit-button" data-exchange-fit="' + groupToken + '" title="\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u0438 \u0433\u0440\u0443\u043f\u0443" aria-label="\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u0438 \u0433\u0440\u0443\u043f\u0443"><i data-lucide="eye"></i></button></summary><div class="exchange-group-body">' + subgroupRows + '</div></details>';
}

function bindExchangeLegendControls() {
  document.querySelectorAll('[data-exchange-group-toggle]').forEach((input) => {
    input.addEventListener('change', (event) => {
      const target = event.currentTarget;
      const value = decodeExchangeValueToken(target.dataset.exchangeGroupToggle || '');
      setExchangeGroupToggle(value, target.checked);
    });
  });
  document.querySelectorAll('[data-exchange-subgroup]').forEach((input) => {
    input.addEventListener('change', (event) => {
      const target = event.currentTarget;
      const groupValue = decodeExchangeValueToken(target.dataset.exchangeGroup || '');
      const subgroupValue = decodeExchangeValueToken(target.dataset.exchangeSubgroup || '');
      setExchangeSubgroupToggle(groupValue, subgroupValue, target.checked);
    });
  });
  document.querySelectorAll('[data-exchange-fit]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const value = decodeExchangeValueToken(event.currentTarget.dataset.exchangeFit || '');
      fitExchangeBorderCategory(value);
    });
  });
}

function uniqueExchangeValues(layer, fieldKey) {
  if (!fieldKey) return [];
  const values = new Set();
  (state.datasets.get(layer.id)?.features || []).forEach((feature) => values.add(String(feature.properties?.[fieldKey] ?? '')));
  return [...values].sort((left, right) => left.localeCompare(right, 'ru'));
}

function buildExchangeColorMap(layer, fieldKey, hueOffset = 0, lightness = 56) {
  const values = uniqueExchangeValues(layer, fieldKey);
  return Object.fromEntries(values.map((value, index) => [value, generatedExchangeColor(index, values.length, hueOffset, lightness)]));
}

function generatedExchangeColor(index, total, hueOffset = 0, lightness = 56) {
  const hue = (hueOffset + (360 / Math.max(total, 1)) * index) % 360;
  return hslToHex(hue, 68, lightness);
}

function hslToHex(h, s, l) {
  const sat = s / 100;
  const light = l / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = light - c / 2;
  let rgb = [0, 0, 0];
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return '#' + rgb.map((value) => Math.round((value + m) * 255).toString(16).padStart(2, '0')).join('');
}

function exchangeColorExpression(fieldName, values, fallback) {
  if (!fieldName || !values || !Object.keys(values).length) return fallback;
  const expression = ['match', ['coalesce', ['to-string', ['get', fieldName]], '']];
  Object.entries(values).forEach(([value, color]) => expression.push(value, color));
  expression.push(fallback);
  return expression;
}

function exchangeFilterExpression(layer) {
  const borderField = layer.exchange?.borderField;
  const patternField = layer.exchange?.patternField;
  const groups = state.exchange?.groups || [];
  if (!borderField || !groups.length) return null;
  const activePairs = groups.flatMap((group) => Object.entries(group.subgroups || {}).filter(([, enabled]) => enabled !== false).map(([subgroup]) => [group.value, subgroup]));
  const allPairs = groups.flatMap((group) => Object.keys(group.subgroups || {}).map((subgroup) => [group.value, subgroup]));
  if (!activePairs.length) return ['==', ['literal', true], false];
  if (activePairs.length === allPairs.length) return null;
  const borderExpr = ['coalesce', ['to-string', ['get', borderField]], ''];
  if (!patternField) return ['in', borderExpr, ['literal', [...new Set(activePairs.map(([groupValue]) => groupValue))]]];
  const patternExpr = ['coalesce', ['to-string', ['get', patternField]], ''];
  const clauses = activePairs.map(([groupValue, subgroupValue]) => ['all', ['==', borderExpr, groupValue], ['==', patternExpr, subgroupValue]]);
  return ['any', ...clauses];
}

function addExchangeLayer(layer) {
  const borderColors = layer.exchange?._borderColors || {};
  state.map.addLayer({
    id:`${layer.id}-exchange-fill`,
    type:'fill',
    source:layer.id,
    layout:{visibility:'none'},
    paint:{
      'fill-color': exchangeColorExpression(layer.exchange?.patternField, layer.exchange?._fillColors || {}, '#c4b07a'),
      'fill-opacity': 0.5
    }
  });
  state.map.addLayer({
    id:`${layer.id}-exchange-border`,
    type:'line',
    source:layer.id,
    layout:{visibility:'none'},
    paint:{
      'line-color': exchangeColorExpression(layer.exchange?.borderField, borderColors, '#49566a'),
      'line-width': 1,
      'line-opacity': 1
    }
  });
  ensureExchangeLabelLayer(layer);
}

function ensureExchangeLabelLayer(layer) {
  const sourceId = `${layer.id}-exchange-label-source`;
  const layerId = `${layer.id}-exchange-labels`;
  if (!state.map.getSource(sourceId)) state.map.addSource(sourceId, {type:'geojson', data:createExchangeLabelCollection(layer)});
  if (!state.map.getLayer(layerId)) {
    state.map.addLayer({
      id:layerId,
      type:'symbol',
      source:sourceId,
      layout:{
        visibility:'none',
        'symbol-placement':'point',
        'text-field':['get','exchange_label'],
        'text-size':11,
        'text-font':['Open Sans Semibold'],
        'text-allow-overlap':true,
        'text-ignore-placement':true,
        'text-anchor':'center'
      },
      paint:{
        'text-color':'#24312d',
        'text-halo-color':'rgba(255,255,255,0.96)',
        'text-halo-width':1.7
      }
    });
  }
}

function applyExchangeVisibility(layer) {
  if (!state.map || !layer.exchange || !state.exchange) return;
  state.map.getSource(`${layer.id}-exchange-label-source`)?.setData(createExchangeLabelCollection(layer));
  const master = state.layerVisible.get(layer.id) ?? layer.visible !== false;
  const hasVisibleCategories = (state.exchange.groups || []).some((group) => Object.values(group.subgroups || {}).some((value) => value !== false));
  const visibility = master && hasVisibleCategories ? 'visible' : 'none';
  const filter = exchangeFilterExpression(layer);
  if (state.map.getLayer(`${layer.id}-exchange-fill`)) {
    state.map.setLayoutProperty(`${layer.id}-exchange-fill`, 'visibility', visibility);
    state.map.setFilter(`${layer.id}-exchange-fill`, filter);
  }
  if (state.map.getLayer(`${layer.id}-exchange-border`)) {
    state.map.setLayoutProperty(`${layer.id}-exchange-border`, 'visibility', visibility);
    state.map.setFilter(`${layer.id}-exchange-border`, filter);
  }
  if (state.map.getLayer(`${layer.id}-exchange-labels`)) {
    const labelsVisibility = visibility === 'visible' && state.exchange.labelsVisible === true && state.labelsVisible ? 'visible' : 'none';
    state.map.setLayoutProperty(`${layer.id}-exchange-labels`, 'visibility', labelsVisibility);
  }
  renderExchangePanel();
}

function createExchangeLabelCollection(layer) {
  const borderField = layer.exchange?.borderField;
  const fillField = layer.exchange?.patternField;
  const groups = state.exchange?.groups || [];
  const features = (state.datasets.get(layer.id)?.features || []).map((feature, index) => {
    const borderValue = String(feature.properties?.[borderField] ?? '');
    const fillValue = String(feature.properties?.[fillField] ?? '');
    const groupState = groups.find((group) => group.value === borderValue);
    if (!groupState || groupState.subgroups?.[fillValue] === false) return null;
    const coordinates = representativePointForGeometry(feature.geometry);
    if (!coordinates) return null;
    return {
      type:'Feature',
      id:`${feature.id ?? feature.properties?.id ?? index + 1}-exchange-label`,
      properties:{ exchange_label: exchangeValueFallback(fillValue || borderValue) },
      geometry:{ type:'Point', coordinates }
    };
  }).filter(Boolean);
  return {type:'FeatureCollection', features};
}

function fitExchangeBorderCategory(value) {
  const layer = exchangeLayer();
  if (!layer || !state.map) return;
  const field = layer.exchange?.borderField;
  if (!field) return;
  const features = (state.datasets.get(layer.id)?.features || []).filter((feature) => String(feature.properties?.[field] ?? '') === value);
  if (!features.length) return;
  const bounds = boundsForFeatures(features);
  if (!bounds) return;
  state.map.fitBounds(bounds, {padding:64, duration:500, maxZoom:16});
}

function boundsForFeatures(features) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const visitCoords = (coords) => {
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      minX = Math.min(minX, coords[0]);
      minY = Math.min(minY, coords[1]);
      maxX = Math.max(maxX, coords[0]);
      maxY = Math.max(maxY, coords[1]);
      return;
    }
    coords.forEach(visitCoords);
  };
  features.forEach((feature) => visitCoords(feature.geometry?.coordinates));
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) return null;
  return [[minX, minY], [maxX, maxY]];
}

function styleColorExpression(layer, ruleName, fallback) {
  const rule = layer.style?.[ruleName];
  if (!rule?.property || !rule.values) return fallback;
  const expression = ["match", ["coalesce", ["to-string", ["get", rule.property]], ""]];
  Object.entries(rule.values).forEach(([value, color]) => expression.push(value, color));
  expression.push(rule.fallback || fallback);
  return expression;
}
function addMeasureLayers() {
  state.map.addSource("measure", {type:"geojson",data:emptyFeatureCollection()});
  state.map.addLayer({id:"measure-fill",type:"fill",source:"measure",filter:["==",["geometry-type"],"Polygon"],paint:{"fill-color":"#ffd400","fill-opacity":0.18}});
  state.map.addLayer({id:"measure-line",type:"line",source:"measure",paint:{"line-color":"#ffd400","line-width":3,"line-dasharray":[2,1]}});
  state.map.addLayer({id:"measure-points",type:"circle",source:"measure",filter:["==",["geometry-type"],"Point"],paint:{"circle-radius":5,"circle-color":"#ffd400","circle-stroke-color":"#6b5a00","circle-stroke-width":1.5}});
  updateMeasureControls();
}

function renderLayerList() {
  const list = document.getElementById("layerList");
  list.replaceChildren();
  state.config.layers.filter((layer) => !layer.exchange).forEach((layer) => {
    const item = document.createElement("section");
    item.className = "layer-item";
    const row = document.createElement("div");
    row.className = "layer-row";
    const count = state.datasets.get(layer.id)?.features?.length ?? layer.count ?? "—";
    const collection = state.datasets.get(layer.id)?.features || [];
    const layerChecked = (state.layerVisible.get(layer.id) ?? (layer.visible !== false)) ? "checked" : "";
    row.innerHTML = `<input type="checkbox" ${layerChecked} aria-label="Показать слой ${escapeHtml(layer.label)}"><span class="layer-swatch"></span><span class="layer-name"></span><span class="layer-count"></span><button class="layer-expand" type="button" aria-expanded="false" title="Фильтр слоя"><i data-lucide="chevron-down"></i></button>`;
    row.querySelector(".layer-name").textContent = layer.label;
    row.querySelector(".layer-name").title = layer.label;
    row.querySelector(".layer-count").innerHTML = layerMetricHtml(layer, collection, collection);
    row.querySelector(".layer-swatch").style.cssText = `--swatch-fill:${layer.style.fillColor}66;--swatch-line:${layer.style.lineColor}`;
    row.querySelector("input").addEventListener("change", (event) => setLayerVisibility(layer.id, event.target.checked));
    const filter = createFilterPanel(layer, item);
    row.querySelector(".layer-expand").addEventListener("click", (event) => {
      const expanded = event.currentTarget.getAttribute("aria-expanded") === "true";
      if (expanded) {
        renderLayerStyleControls(layer, filter);
        renderCategoryControls(layer, filter, item);
        updateLayerCount(layer, item);
      }
      event.currentTarget.setAttribute("aria-expanded", String(!expanded));
      event.currentTarget.classList.toggle("expanded", !expanded);
      filter.hidden = expanded;
    });
    item.append(row, filter);
    list.appendChild(item);
  });
  lucide.createIcons({nodes:[list]});
}

function createFilterPanel(layer, item) {
  const panel = document.createElement("div");
  panel.className = "filter-panel";
  panel.hidden = true;
  panel.innerHTML = '<div class="layer-style-controls"></div><div class="category-panel"></div><div class="filter-summary"></div><div class="filter-actions"><button class="filter-apply" type="button">\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u0438 \u0432\u0441\u0435</button><button class="filter-fit" type="button" title="Показать слой"><i data-lucide="expand"></i></button><button class="filter-reset" type="button" title="Сбросить настройки"><i data-lucide="rotate-ccw"></i></button></div>';
  renderLayerStyleControls(layer, panel);
  renderCategoryControls(layer, panel, item);
  panel.querySelector(".filter-summary").textContent = layerSummaryText(layer);
  panel.querySelector(".filter-apply").addEventListener("click", () => {
    const categoryPanel = panel.querySelector(".category-panel");
    if (categoryRule(layer) && categoryPanel?.children.length) setAllCategories(layer, item, categoryPanel, true);
    updateLayerCount(layer, item);
  });
  panel.querySelector(".filter-fit").addEventListener("click", () => fitLayer(layer));
  panel.querySelector(".filter-reset").addEventListener("click", () => {
    const categoryPanel = panel.querySelector(".category-panel");
    if (categoryRule(layer) && categoryPanel?.children.length) setAllCategories(layer, item, categoryPanel, true);
    state.layerRenderOptions.set(layer.id, {mode:"both", opacity:nearestOpacityStep(layer.style?.fillOpacity ?? 0.5), width:nearestWidthStep(layer.style?.lineWidth ?? 1)});
    renderLayerStyleControls(layer, panel);
    applyLayerRenderOptions(layer);
    updateLayerCount(layer, item);
  });
  return panel;
}

function applyLayerFilter(layer, filter, item) {
  if (!filter.value && !["empty","not-empty"].includes(filter.operator)) return resetLayerFilter(layer, item.querySelector(".filter-panel"), item);
  const meta = fieldMeta(layer, filter.field);
  const numeric = meta.numeric && ["equals","not-equals","greater","less","between"].includes(filter.operator);
  const range = filter.operator === "between" ? parseNumberRange(filter.value) : null;
  const value = numeric ? parseLocaleNumber(filter.value) : filter.value.toLocaleLowerCase("ru");
  if (filter.operator === "between" && !range) return showToast("Введите диапазон, например 10-50");
  if (numeric && filter.operator !== "between" && !Number.isFinite(value)) return showToast("Введите число для числового фильтра");
  const property = ["get", filter.field];
  const textProperty = ["downcase", ["to-string", ["coalesce", property, ""]]];
  const numberProperty = ["to-number", ["to-string", ["coalesce", property, ""]]];
  let expression;
  if (filter.operator === "contains") expression = ["in", String(value), textProperty];
  if (filter.operator === "equals") expression = numeric ? ["==", numberProperty, value] : ["==", textProperty, String(value)];
  if (filter.operator === "not-equals") expression = numeric ? ["!=", numberProperty, value] : ["!=", textProperty, String(value)];
  if (filter.operator === "greater") expression = [">", numberProperty, value];
  if (filter.operator === "less") expression = ["<", numberProperty, value];
  if (filter.operator === "between") expression = ["all", [">=", numberProperty, range[0]], ["<=", numberProperty, range[1]]];
  if (filter.operator === "empty") expression = ["==", textProperty, ""];
  if (filter.operator === "not-empty") expression = ["!=", textProperty, ""];
  state.filters.set(layer.id, filter);
  applyCombinedLayerFilter(layer);
  item.classList.add("filtered");
  updateLayerCount(layer, item);
  showToast("Фильтр «" + layer.label + "»: " + matches + " объектов");
}

function applyCombinedLayerFilter(layer) {
  const filters = [];
  const categoryExpression = buildCategoryFilterExpression(layer);
  if (categoryExpression) filters.push(categoryExpression);
  const attributeExpression = buildAttributeFilterExpression(layer);
  if (attributeExpression) filters.push(attributeExpression);
  const expression = filters.length > 1 ? ["all", ...filters] : (filters[0] || null);
  ["fill", "line", "point", "point-label"].forEach((part) => { if (state.map.getLayer(layer.id + "-" + part)) state.map.setFilter(layer.id + "-" + part, expression); });
  if (state.map.getLayer(layer.id + "-other-line")) state.map.setFilter(layer.id + "-other-line", buildOtherFilterExpression(layer));
  if (state.map.getLayer(layer.id + "-centroid")) state.map.setFilter(layer.id + "-centroid", buildCentroidFilterExpression(layer));
}

function buildAttributeFilterExpression(layer) {
  const filter = state.filters.get(layer.id);
  if (!filter) return null;
  const meta = fieldMeta(layer, filter.field);
  const numeric = meta.numeric && ["equals","not-equals","greater","less","between"].includes(filter.operator);
  const range = filter.operator === "between" ? parseNumberRange(filter.value) : null;
  const value = numeric ? parseLocaleNumber(filter.value) : filter.value.toLocaleLowerCase("ru");
  const property = ["get", filter.field];
  const textProperty = ["downcase", ["to-string", ["coalesce", property, ""]]];
  const numberProperty = ["to-number", ["to-string", ["coalesce", property, ""]]];
  if (filter.operator === "contains") return ["in", String(value), textProperty];
  if (filter.operator === "equals") return numeric ? ["==", numberProperty, value] : ["==", textProperty, String(value)];
  if (filter.operator === "not-equals") return numeric ? ["!=", numberProperty, value] : ["!=", textProperty, String(value)];
  if (filter.operator === "greater") return [">", numberProperty, value];
  if (filter.operator === "less") return ["<", numberProperty, value];
  if (filter.operator === "between" && range) return ["all", [">=", numberProperty, range[0]], ["<=", numberProperty, range[1]]];
  if (filter.operator === "empty") return ["==", textProperty, ""];
  if (filter.operator === "not-empty") return ["!=", textProperty, ""];
  return null;
}

function buildCategoryFilterExpression(layer) {
  const rule = categoryRule(layer);
  const selected = state.categoryFilters.get(layer.id);
  if (!rule || !selected) return null;
  const known = Object.keys(rule.values);
  const selectedKnown = known.filter((value) => selected.has(value));
  if (layer.style?.other || selectedKnown.length !== known.length) {
    if (!selectedKnown.length) return ["==", ["literal", true], false];
    const property = ["coalesce", ["to-string", ["get", rule.property]], ""];
    return ["in", property, ["literal", selectedKnown]];
  }
  return null;
}

function buildOtherFilterExpression(layer) {
  const rule = categoryRule(layer);
  const selected = state.categoryFilters.get(layer.id);
  if (!rule || !layer.style?.other || !selected?.has(OTHER_CATEGORY)) return ["==", ["literal", true], false];
  const filters = [];
  const property = ["coalesce", ["to-string", ["get", rule.property]], ""];
  filters.push(["!", ["in", property, ["literal", Object.keys(rule.values)]]]);
  return filters.length > 1 ? ["all", ...filters] : filters[0];
}

function matchesLayerFilters(feature, layer) {
  const rule = categoryRule(layer);
  const selected = state.categoryFilters.get(layer.id);
  if (rule && selected) {
    const value = String(feature.properties?.[rule.property] ?? "");
    const known = Object.prototype.hasOwnProperty.call(rule.values, value);
    if (known && !selected.has(value)) return false;
    if (!known && layer.style?.other && !selected.has(OTHER_CATEGORY)) return false;
  }
  return true;
}

function categoryRule(layer) {
  const fillRule = layer.style?.fillBy;
  const lineRule = layer.style?.lineBy;
  return fillRule?.property && fillRule.values ? fillRule : (lineRule?.property && lineRule.values ? lineRule : null);
}

function renderLayerStyleControls(layer, panel) {
  const container = panel.querySelector(".layer-style-controls");
  if (!container) return;
  const options = layerRenderOptions(layer);
  if (layer.kind === "Point") {
    container.innerHTML = '<div class="centroid-controls"><div class="category-heading"><span>\u041f\u0456\u0434\u043f\u0438\u0441\u0438 \u0442\u043e\u0447\u043e\u043a</span></div><div class="centroid-grid"><label class="style-control"><span>\u041f\u043e\u043a\u0430\u0437\u0443\u0432\u0430\u0442\u0438 \u043f\u0456\u0434\u043f\u0438\u0441\u0438</span><select class="point-label-visible"><option value="1">\u0422\u0430\u043a</option><option value="0">\u041d\u0456</option></select></label><label class="style-control"><span>\u041c\u0456\u043d. zoom</span><select class="point-label-minzoom"><option value="10">10</option><option value="12">12</option><option value="14">14</option><option value="16">16</option><option value="18">18</option></select></label></div></div><div class="centroid-controls author-only"><div class="category-heading"><span>\u041a\u043e\u043b\u044c\u043e\u0440\u0438 \u0442\u043e\u0447\u043e\u043a</span></div><div class="centroid-grid"><label class="style-control"><span>\u041c\u0430\u0440\u043a\u0435\u0440</span><input class="base-fill-color" type="color" aria-label="\u041a\u043e\u043b\u0456\u0440 \u043c\u0430\u0440\u043a\u0435\u0440\u0430 \u0442\u043e\u0447\u043a\u0438"></label><label class="style-control"><span>\u041a\u043e\u043d\u0442\u0443\u0440</span><input class="base-line-color" type="color" aria-label="\u041a\u043e\u043b\u0456\u0440 \u043a\u043e\u043d\u0442\u0443\u0440\u0443 \u0442\u043e\u0447\u043a\u0438"></label></div></div>';
    const visibleInput = container.querySelector(".point-label-visible");
    const minZoomInput = container.querySelector(".point-label-minzoom");
    const baseFill = container.querySelector(".base-fill-color");
    const baseLine = container.querySelector(".base-line-color");
    if (visibleInput) visibleInput.value = options.labelsVisible === false ? "0" : "1";
    if (minZoomInput) minZoomInput.value = String(options.minZoom || 14);
    if (baseFill) baseFill.value = normalizeHexColor(layer.style?.pointColor || layer.style?.fillColor || "#d85f5f");
    if (baseLine) baseLine.value = normalizeHexColor(layer.style?.pointStrokeColor || layer.style?.lineColor || "#1f2937");
    visibleInput?.addEventListener("change", () => { layerRenderOptions(layer).labelsVisible = visibleInput.value !== "0"; applyLayerRenderOptions(layer); });
    minZoomInput?.addEventListener("change", () => { layerRenderOptions(layer).minZoom = Number(minZoomInput.value || 14); applyLayerRenderOptions(layer); });
    baseFill?.addEventListener("input", () => {
      const hex = normalizeHexColor(baseFill.value);
      layer.style.pointColor = hex;
      layer.style.fillColor = hex;
      applyCategoryColors(layer);
    });
    baseLine?.addEventListener("input", () => {
      const hex = normalizeHexColor(baseLine.value);
      layer.style.pointStrokeColor = hex;
      layer.style.lineColor = hex;
      applyCategoryColors(layer);
    });
    return;
  }
  if (layer.kind !== "Polygon") return;
  const centroid = layer.centroid || {mode:"none", field:""};
  const fields = (layer.fields || []).map((field) => `<option value="${escapeHtml(field.key)}">${escapeHtml(field.label)}</option>`).join("");
  container.innerHTML = '<label class="style-control"><span>\u0412\u0438\u0433\u043b\u044f\u0434</span><select class="style-mode"><option value="both">\u0417\u0430\u043b\u0438\u0432\u043a\u0430 \u0456 \u043a\u043e\u043d\u0442\u0443\u0440</option><option value="fill">\u041b\u0438\u0448\u0435 \u0437\u0430\u043b\u0438\u0432\u043a\u0430</option><option value="line">\u041b\u0438\u0448\u0435 \u043a\u043e\u043d\u0442\u0443\u0440</option></select></label><label class="style-control"><span>\u041f\u0440\u043e\u0437\u043e\u0440\u0456\u0441\u0442\u044c \u0448\u0430\u0440\u0443</span><select class="style-opacity-input"><option value="0.25">25%</option><option value="0.5">50%</option><option value="0.75">75%</option><option value="1">100%</option></select></label><label class="style-control"><span>\u0422\u043e\u0432\u0449\u0438\u043d\u0430 \u043a\u043e\u043d\u0442\u0443\u0440\u0443</span><select class="style-width-input"><option value="1">1 px</option><option value="2">2 px</option><option value="3">3 px</option><option value="4">4 px</option><option value="5">5 px</option></select></label><div class="centroid-controls author-only"><div class="category-heading"><span>\u0411\u0430\u0437\u043e\u0432\u0456 \u043a\u043e\u043b\u044c\u043e\u0440\u0438</span></div><div class="centroid-grid"><label class="style-control"><span>\u0417\u0430\u043b\u0438\u0432\u043a\u0430</span><input class="base-fill-color" type="color" aria-label="\u0411\u0430\u0437\u043e\u0432\u0438\u0439 \u043a\u043e\u043b\u0456\u0440 \u0437\u0430\u043b\u0438\u0432\u043a\u0438"></label><label class="style-control"><span>\u041a\u043e\u043d\u0442\u0443\u0440</span><input class="base-line-color" type="color" aria-label="\u0411\u0430\u0437\u043e\u0432\u0438\u0439 \u043a\u043e\u043b\u0456\u0440 \u043a\u043e\u043d\u0442\u0443\u0440\u0443"></label></div></div><div class="centroid-controls author-only"><div class="category-heading"><span>\u0426\u0435\u043d\u0442\u0440\u043e\u0457\u0434\u0438</span></div><div class="centroid-grid"><label class="style-control"><span>\u0420\u0435\u0436\u0438\u043c</span><select class="centroid-mode"><option value="none">\u0421\u0445\u043e\u0432\u0430\u0442\u0438</option><option value="marker">\u041c\u0430\u0440\u043a\u0435\u0440</option><option value="label">\u041f\u0456\u0434\u043f\u0438\u0441</option><option value="both">\u041c\u0430\u0440\u043a\u0435\u0440 + \u043f\u0456\u0434\u043f\u0438\u0441</option></select></label><label class="style-control"><span>\u041f\u043e\u043b\u0435 \u043f\u0456\u0434\u043f\u0438\u0441\u0443</span><select class="centroid-field"><option value="">\u0411\u0435\u0437 \u043f\u043e\u043b\u044f</option>' + fields + '</select></label></div></div>';
  const mode = container.querySelector(".style-mode");
  const opacity = container.querySelector(".style-opacity-input");
  const width = container.querySelector(".style-width-input");
  const baseFill = container.querySelector(".base-fill-color");
  const baseLine = container.querySelector(".base-line-color");
  const centroidMode = container.querySelector(".centroid-mode");
  const centroidField = container.querySelector(".centroid-field");
  if (mode) mode.value = options.mode;
  if (opacity) opacity.value = String(options.opacity);
  if (width) width.value = String(options.width);
  if (baseFill) baseFill.value = normalizeHexColor(layer.style?.fillColor || "#67a65f");
  if (baseLine) baseLine.value = normalizeHexColor(layer.style?.lineColor || "#4b5563");
  if (centroidMode) centroidMode.value = centroid.mode || "none";
  if (centroidField) centroidField.value = centroid.field || "";
  mode?.addEventListener("change", () => { layerRenderOptions(layer).mode = mode.value; applyLayerRenderOptions(layer); });
  opacity?.addEventListener("change", () => { layerRenderOptions(layer).opacity = Number(opacity.value); applyLayerRenderOptions(layer); });
  width?.addEventListener("change", () => { layerRenderOptions(layer).width = Number(width.value); applyLayerRenderOptions(layer); });
  baseFill?.addEventListener("input", () => { layer.style.fillColor = normalizeHexColor(baseFill.value); applyCategoryColors(layer); });
  baseLine?.addEventListener("input", () => { layer.style.lineColor = normalizeHexColor(baseLine.value); applyCategoryColors(layer); });
  centroidMode?.addEventListener("change", () => { if (!layer.centroid) layer.centroid = {mode:"none", field:""}; layer.centroid.mode = centroidMode.value; applyCentroidLayer(layer); });
  centroidField?.addEventListener("change", () => { if (!layer.centroid) layer.centroid = {mode:"none", field:""}; layer.centroid.field = centroidField.value; applyCentroidLayer(layer); });
}

function defaultLayerRenderOptions(layer) {
  if (layer.kind === "Point") {
    return {labelsVisible: layer.pointLabel?.visible !== false, minZoom: Number(layer.pointLabel?.minZoom || 14)};
  }
  return {mode:"both", opacity:nearestOpacityStep(layer.style?.fillOpacity ?? 0.5), width:nearestWidthStep(layer.style?.lineWidth ?? 1)};
}

function layerRenderOptions(layer) {
  if (!state.layerRenderOptions.has(layer.id)) state.layerRenderOptions.set(layer.id, defaultLayerRenderOptions(layer));
  return state.layerRenderOptions.get(layer.id);
}

function nearestOpacityStep(value) {
  const steps = [0.25, 0.5, 0.75, 1];
  return steps.reduce((best, step) => Math.abs(step - value) < Math.abs(best - value) ? step : best, 0.5);
}

function nearestWidthStep(value) {
  const steps = [1, 2, 3, 4, 5];
  return steps.reduce((best, step) => Math.abs(step - value) < Math.abs(best - value) ? step : best, 1);
}

function applyLayerRenderOptions(layer) {
  if (!state.map) return;
  if (layer.exchange) {
    applyExchangeVisibility(layer);
    return;
  }
  const options = layerRenderOptions(layer);
  const visible = state.layerVisible.get(layer.id) ?? layer.visible !== false;
  if (layer.kind === "Point") {
    if (state.map.getLayer(layer.id + "-point")) state.map.setLayoutProperty(layer.id + "-point", "visibility", visible ? "visible" : "none");
    applyPointLabelLayer(layer);
    return;
  }
  const mode = layer.kind === "Polygon" ? options.mode : "both";
  const opacity = Number.isFinite(options.opacity) ? options.opacity : 0.5;
  const width = Number.isFinite(options.width) ? options.width : 1;
  const fillVisible = visible && layer.kind === "Polygon" && mode !== "line";
  const lineVisible = visible && mode !== "fill";
  if (state.map.getLayer(layer.id + "-fill")) {
    state.map.setLayoutProperty(layer.id + "-fill", "visibility", fillVisible ? "visible" : "none");
    state.map.setPaintProperty(layer.id + "-fill", "fill-opacity", ["case",["boolean",["feature-state","selected"],false],Math.min(1, opacity + 0.25),opacity]);
  }
  if (state.map.getLayer(layer.id + "-line")) {
    state.map.setLayoutProperty(layer.id + "-line", "visibility", lineVisible ? "visible" : "none");
    state.map.setPaintProperty(layer.id + "-line", "line-opacity", ["case",["boolean",["feature-state","selected"],false],1,opacity]);
    state.map.setPaintProperty(layer.id + "-line", "line-width", ["case",["boolean",["feature-state","selected"],false],width + 2,width]);
  }
  if (state.map.getLayer(layer.id + "-other-line")) {
    state.map.setLayoutProperty(layer.id + "-other-line", "visibility", lineVisible ? "visible" : "none");
    state.map.setPaintProperty(layer.id + "-other-line", "line-opacity", ["case",["boolean",["feature-state","selected"],false],1,Math.min(1, (layer.style?.other?.lineOpacity ?? 1) * (opacity / 0.5))]);
    state.map.setPaintProperty(layer.id + "-other-line", "line-width", width);
  }
  applyCentroidLayer(layer);
}

function renderCategoryControls(layer, panel, item) {
  const container = panel.querySelector(".category-panel");
  const rule = categoryRule(layer);
  if (!rule) return;
  const values = Object.entries(rule.values);
  if (!values.length) return;
  const allValues = [...values.map(([value]) => value), ...(layer.style?.other ? [OTHER_CATEGORY] : [])];
  const existing = state.categoryFilters.get(layer.id);
  const selectedValues = existing ? new Set([...existing].filter((value) => allValues.includes(value))) : new Set(allValues);
  state.categoryFilters.set(layer.id, selectedValues);
  container.innerHTML = '<div class="category-heading"><span>Категории</span><button type="button" class="category-all">Все</button><button type="button" class="category-none">Снять</button></div><div class="category-list"></div>';
  const list = container.querySelector(".category-list");
  values.forEach(([value, color]) => addCategoryRow(list, layer, item, value, value || "(пусто)", color, selectedValues.has(value)));
  if (layer.style?.other) addCategoryRow(list, layer, item, OTHER_CATEGORY, layer.style.other.label || "Остальные", layer.style.other.lineColor || "#4b5563", selectedValues.has(OTHER_CATEGORY));
  container.querySelector(".category-all").addEventListener("click", () => setAllCategories(layer, item, container, true));
  container.querySelector(".category-none").addEventListener("click", () => setAllCategories(layer, item, container, false));
}

function addCategoryRow(list, layer, item, value, labelText, color, checked = true) {
  const label = document.createElement("label");
  label.className = value === OTHER_CATEGORY ? "category-row category-other" : "category-row";
  label.innerHTML = '<input type="checkbox"><span class="category-swatch"></span><span class="category-name"></span><input class="category-color author-only" type="color" aria-label="Цвет категории">';
  label.querySelector('input[type="checkbox"]').checked = checked;
  label.querySelector(".category-swatch").style.background = color;
  label.querySelector(".category-name").textContent = labelText;
  const colorInput = label.querySelector(".category-color");
  colorInput.value = normalizeHexColor(color);
  colorInput.addEventListener("input", (event) => updateCategoryColor(layer, value, event.target.value, label));
  label.querySelector("input[type=checkbox]").addEventListener("change", (event) => {
    const selected = state.categoryFilters.get(layer.id) || new Set();
    if (event.target.checked) selected.add(value); else selected.delete(value);
    state.categoryFilters.set(layer.id, selected);
    applyCombinedLayerFilter(layer);
    updateLayerCount(layer, item);
  });
  list.appendChild(label);
}

function setAllCategories(layer, item, container, checked) {
  const rule = categoryRule(layer);
  const values = [...Object.keys(rule.values), ...(layer.style?.other ? [OTHER_CATEGORY] : [])];
  state.categoryFilters.set(layer.id, new Set(checked ? values : []));
  container.querySelectorAll('input[type="checkbox"]').forEach((input) => input.checked = checked);
  applyCombinedLayerFilter(layer);
  updateLayerCount(layer, item);
}

function updateLayerCount(layer, item) {
  const collection = state.datasets.get(layer.id);
  const features = collection?.features || [];
  const matches = filteredFeatures(layer);
  const counter = item.querySelector(".layer-count");
  if (counter) counter.innerHTML = layerMetricHtml(layer, features, matches);
  const summary = item.querySelector(".filter-panel .filter-summary");
  if (summary) summary.textContent = layerSummaryText(layer, matches, features);
}

function layerSummaryConfig(layer) {
  return layer?.summary?.field ? layer.summary : null;
}

function featureSummaryArea(layer, feature) {
  const summary = layerSummaryConfig(layer);
  if (!summary) return null;
  const raw = parseLocaleNumber(feature?.properties?.[summary.field]);
  if (!Number.isFinite(raw)) return null;
  return summary.unit === "m2" ? raw / 10000 : raw;
}

function sumLayerArea(layer, features) {
  return features.reduce((total, feature) => {
    const value = featureSummaryArea(layer, feature);
    return total + (Number.isFinite(value) ? value : 0);
  }, 0);
}

function formatCountValue(value) {
  return new Intl.NumberFormat("ru-RU").format(value) + " шт.";
}

function formatAreaValue(value) {
  return new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value) + " га";
}

function metricValueText(visible, total, formatter) {
  return visible === total ? formatter(total) : formatter(visible) + " / " + formatter(total);
}

function metricParts(layer, allFeatures = [], matchedFeatures = null) {
  const sourceFeatures = Array.isArray(allFeatures) ? allFeatures : [];
  const visibleFeatures = matchedFeatures || sourceFeatures;
  const totalCount = sourceFeatures.length || layer.count || 0;
  const visibleCount = visibleFeatures.length;
  const summary = layerSummaryConfig(layer);
  const result = {
    countText: metricValueText(visibleCount, totalCount, formatCountValue),
    hasArea: Boolean(summary),
    areaText: ""
  };
  if (summary) {
    const totalArea = sumLayerArea(layer, sourceFeatures);
    const visibleArea = sumLayerArea(layer, visibleFeatures);
    result.areaText = metricValueText(visibleArea, totalArea, formatAreaValue);
  }
  return result;
}

function layerMetricHtml(layer, allFeatures = [], matchedFeatures = null) {
  const metrics = metricParts(layer, allFeatures, matchedFeatures);
  const chips = [
    '<span class="metric-chip metric-count" title="Количество объектов">' + escapeHtml(metrics.countText) + '</span>'
  ];
  if (metrics.hasArea) chips.push('<span class="metric-chip metric-area" title="Суммарная площадь">' + escapeHtml(metrics.areaText) + '</span>');
  return chips.join('');
}

function layerSummaryText(layer, matchedFeatures = null, allFeatures = null) {
  const sourceFeatures = allFeatures || state.datasets.get(layer.id)?.features || [];
  const visibleFeatures = matchedFeatures || filteredFeatures(layer);
  const metrics = metricParts(layer, sourceFeatures, visibleFeatures);
  return metrics.hasArea
    ? 'Объектов: ' + metrics.countText + ' • Площадь: ' + metrics.areaText
    : 'Объектов: ' + metrics.countText;
}

function formatDateValue(raw, type) {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!match) return value;
  const [, year, month, day, hour, minute] = match;
  const date = day + '.' + month + '.' + year;
  if (type === 'datetime' && hour && minute) return date + ' ' + hour + ':' + minute;
  return date;
}

function formatFieldValue(field, raw) {
  if (raw === undefined || raw === null || raw === '') return '-';
  const formatted = field?.type === 'date' || field?.type === 'datetime'
    ? formatDateValue(raw, field.type)
    : String(raw);
  return formatted + (field?.suffix || '');
}

function matchesFilter(raw, filter) {
  const text = String(raw ?? "").toLocaleLowerCase("ru");
  const value = filter.value.toLocaleLowerCase("ru");
  if (filter.operator === "contains") return text.includes(value);
  if (filter.operator === "equals") return compareFilterValue(raw, filter, (left,right) => left === right);
  if (filter.operator === "not-equals") return compareFilterValue(raw, filter, (left,right) => left !== right);
  if (filter.operator === "greater") return parseLocaleNumber(raw) > parseLocaleNumber(filter.value);
  if (filter.operator === "less") return parseLocaleNumber(raw) < parseLocaleNumber(filter.value);
  if (filter.operator === "between") {
    const range = parseNumberRange(filter.value);
    const number = parseLocaleNumber(raw);
    return Boolean(range) && number >= range[0] && number <= range[1];
  }
  if (filter.operator === "empty") return text === "";
  if (filter.operator === "not-empty") return text !== "";
  return true;
}

function compareFilterValue(raw, filter, compare) {
  const leftNumber = parseLocaleNumber(raw);
  const rightNumber = parseLocaleNumber(filter.value);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return compare(leftNumber, rightNumber);
  return compare(String(raw ?? "").toLocaleLowerCase("ru"), filter.value.toLocaleLowerCase("ru"));
}

function filteredFeatures(layer) {
  const features = state.datasets.get(layer.id)?.features || [];
  const filter = state.filters.get(layer.id);
  return features.filter((feature) => {
    if (!matchesLayerFilters(feature, layer)) return false;
    if (!filter) return true;
    return matchesFilter(feature.properties?.[filter.field], filter);
  });
}

function fieldMeta(layer, fieldKey) {
  const values = (state.datasets.get(layer.id)?.features || [])
    .map((feature) => feature.properties?.[fieldKey])
    .filter((value) => value !== undefined && value !== null && value !== "");
  const numericCount = values.filter((value) => Number.isFinite(parseLocaleNumber(value))).length;
  const uniqueValues = [...new Set(values.map(String))].sort((a,b) => a.localeCompare(b,"ru",{numeric:true}));
  return { values, uniqueValues, numeric:numericCount > 0 && numericCount / values.length > 0.9 };
}

function parseLocaleNumber(value) {
  if (typeof value === "number") return value;
  return Number(String(value ?? "").replace(/\s/g, "").replace(",", "."));
}

function parseNumberRange(value) {
  const match = String(value ?? "").trim().replace(/,/g, ".").match(/^([0-9.]+)\s*(?:-|–|—|\.\.)\s*([0-9.]+)$/);
  if (!match) return null;
  const first = Number(match[1]);
  const second = Number(match[2]);
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;
  return first <= second ? [first, second] : [second, first];
}

function updateFilterFieldUi(layer, panel) {
  const field = panel.querySelector(".filter-field").value;
  const meta = fieldMeta(layer, field);
  const datalist = panel.querySelector("datalist");
  const quickValues = panel.querySelector(".filter-quick-values");
  const input = panel.querySelector(".filter-value");
  const summary = panel.querySelector(".filter-summary");
  datalist.replaceChildren();
  quickValues.replaceChildren();
  if (!meta.numeric && meta.uniqueValues.length <= 80) {
    meta.uniqueValues.slice(0,80).forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      datalist.appendChild(option);
    });
  }
  if (!meta.numeric && meta.uniqueValues.length > 1 && meta.uniqueValues.length <= 12) {
    meta.uniqueValues.forEach((value) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "filter-chip";
      button.textContent = value;
      button.addEventListener("click", () => {
        panel.querySelector(".filter-operator").value = "equals";
        input.value = value;
        panel.requestSubmit();
      });
      quickValues.appendChild(button);
    });
  }
  if (meta.numeric && meta.values.length) {
    const numbers = meta.values.map(parseLocaleNumber).filter(Number.isFinite);
    const min = Math.min(...numbers);
    const max = Math.max(...numbers);
    input.placeholder = `Например ${formatNumber(min)}-${formatNumber(max)}`;
    summary.textContent = `Диапазон: ${formatNumber(min)}-${formatNumber(max)}`;
  } else {
    input.placeholder = "Введите значение";
    summary.textContent = meta.uniqueValues.length ? `Значений: ${meta.uniqueValues.length}` : "Нет заполненных значений";
  }
  const operator = panel.querySelector(".filter-operator");
  [...operator.options].forEach((option) => {
    option.disabled = !meta.numeric && ["greater","less","between"].includes(option.value);
  });
  if (operator.selectedOptions[0]?.disabled) operator.value = "contains";
}

function formatNumber(value) {
  return new Intl.NumberFormat("ru-RU", {maximumFractionDigits:2}).format(value).replace(/\s/g, "");
}

function resetLayerFilter(layer, panel, item) {
  state.filters.delete(layer.id);
  applyCombinedLayerFilter(layer);
  panel.querySelector(".filter-value").value = "";
  panel.querySelector(".filter-value").disabled = false;
  panel.querySelector(".filter-summary").textContent = layerSummaryText(layer);
  item.classList.remove("filtered");
  updateLayerCount(layer, item);
  showToast("������ �" + layer.label + "� �������");
}

function setLayerVisibility(id, visible) {
  state.layerVisible.set(id, visible);
  const layer = state.config.layers.find((item) => item.id === id);
  if (layer) {
    if (layer.exchange && state.exchange) state.exchange.visible = visible;
    applyLayerRenderOptions(layer);
    applyCentroidLayer(layer);
    if (layer.exchange) renderExchangePanel();
  }
}

function isConfiguredLayerVisible(layer) {
  if (layer.exchange) return ["exchange-fill", "exchange-border", "exchange-labels"].some((part) => state.map?.getLayer(layer.id + "-" + part) && state.map.getLayoutProperty(layer.id + "-" + part, "visibility") !== "none");
  return ["fill","line","other-line","point","point-label"].some((part) => state.map?.getLayer(layer.id + "-" + part) && state.map.getLayoutProperty(layer.id + "-" + part, "visibility") !== "none");
}

function handleMapClick(event) {
  if (state.measureMode) {
    state.measurePoints.push([event.lngLat.lng,event.lngLat.lat]);
    state.measureCursor = [event.lngLat.lng,event.lngLat.lat];
    updateMeasure();
    return;
  }
  const layer = interactiveLayer();
  if (!layer) return;
  const layerIds = [layer.id + "-fill", layer.id + "-line", layer.id + "-other-line", layer.id + "-point", layer.id + "-point-label"].filter((id) => state.map.getLayer(id));
  const rendered = state.map.queryRenderedFeatures(event.point,{layers:layerIds})[0];
  const feature = resolveInteractiveFeature(layer, rendered, event.lngLat);
  if (feature) selectFeature(layer, feature, {zoom:false});
  else clearSelection();
}

function selectFeature(layer, feature, options = {}) {
  clearSelection();
  const resolved = resolveInteractiveFeature(layer, feature, null) || feature;
  const featureId = resolved.id ?? resolved.properties?.id ?? feature.id ?? feature.properties?.id;
  if (featureId !== undefined && state.map.getSource(layer.id)) {
    state.map.setFeatureState({source:layer.id,id:featureId,...(layer.sourceLayer ? {sourceLayer:layer.sourceLayer} : {})},{selected:true});
  }
  state.selected = {layer,feature:resolved,id:featureId};
  if (options.zoom) zoomToFeature(resolved, true);
  showFeaturePopup(layer, resolved);
}

function clearSelection() {
  if (!state.selected || !state.map?.getSource(state.selected.layer.id)) {
    if (state.popup) { state.popup.remove(); state.popup = null; }
    state.selected = null;
    return;
  }
  if (state.selected.id !== undefined) {
    const target = {source:state.selected.layer.id,id:state.selected.id};
    if (state.selected.layer.sourceLayer) target.sourceLayer = state.selected.layer.sourceLayer;
    state.map.setFeatureState(target,{selected:false});
  }
  state.selected = null;
  if (state.popup) { state.popup.remove(); state.popup = null; }
}

function resolveInteractiveFeature(layer, renderedFeature, lngLat) {
  const filtered = filteredFeatures(layer);
  const renderedId = renderedFeature?.id ?? renderedFeature?.properties?.id;
  if (renderedId !== undefined) {
    const byId = filtered.find((item) => String(item.properties?.id ?? item.id) === String(renderedId));
    if (byId) return byId;
  }
  if (lngLat) {
    const byPoint = filtered.find((item) => geometryContainsLngLat(item.geometry, lngLat));
    if (byPoint) return byPoint;
  }
  return renderedFeature || null;
}

function geometryContainsLngLat(geometry, lngLat) {
  if (!geometry || !lngLat) return false;
  const point = [lngLat.lng, lngLat.lat];
  if (geometry.type === "Polygon") return polygonContainsPoint(geometry.coordinates, point);
  if (geometry.type === "MultiPolygon") return geometry.coordinates.some((polygon) => polygonContainsPoint(polygon, point));
  return false;
}

function polygonContainsPoint(rings, point) {
  if (!rings?.length) return false;
  if (!ringContainsPoint(rings[0], point)) return false;
  for (let index = 1; index < rings.length; index += 1) {
    if (ringContainsPoint(rings[index], point)) return false;
  }
  return true;
}

function ringContainsPoint(ring, point) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersects = ((yi > point[1]) !== (yj > point[1])) && (point[0] < (xj - xi) * (point[1] - yi) / ((yj - yi) || Number.EPSILON) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function showFeaturePopup(layer, feature) {
  if (!state.map) return;
  const placement = popupPlacement(feature);
  if (!placement) return;
  const content = document.createElement("div");
  content.className = "feature-popup";
  const header = document.createElement("div");
  header.className = "feature-popup-header";
  const heading = document.createElement("div");
  heading.className = "feature-popup-heading";
  heading.textContent = layer.label;
  const close = document.createElement("button");
  close.type = "button";
  close.className = "feature-popup-close";
  close.textContent = "\u00d7";
  close.setAttribute("aria-label", "\u0417\u0430\u043a\u0440\u044b\u0442\u044c");
  close.addEventListener("click", clearSelection);
  header.append(heading, close);
  const list = document.createElement("dl");
  list.className = "feature-popup-fields";
  (layer.fields || []).forEach((field) => {
    const row = document.createElement("div");
    row.className = "field-row";
    const term = document.createElement("dt");
    const value = document.createElement("dd");
    term.textContent = field.label;
    const raw = feature.properties?.[field.key];
    value.textContent = formatFieldValue(field, raw);
    row.append(term,value);
    list.appendChild(row);
  });
  const actions = document.createElement("div");
  actions.className = "feature-popup-actions";
  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "secondary-button";
  copy.textContent = "Копировать атрибут поиска";
  copy.addEventListener("click", copyCadastre);
  actions.append(copy);
  content.append(header, list, actions);
  if (state.popup) state.popup.remove();
  state.popup = new maplibregl.Popup({closeButton:false, closeOnClick:false, maxWidth:"520px", anchor:placement.anchor, offset:placement.offset})
    .setLngLat(placement.lngLat)
    .setDOMContent(content)
    .addTo(state.map);
}

function popupPlacement(feature) {
  if (!feature?.geometry || !state.map) return null;
  const bounds = screenBoundsForGeometry(feature.geometry);
  if (!bounds) return null;
  const width = state.map.getCanvas().clientWidth;
  const height = state.map.getCanvas().clientHeight;
  const gap = width <= 560 ? 12 : 18;
  const sideSpace = width <= 560 ? 14 : 18;
  const popupWidth = width <= 560 ? 340 : 520;
  const centerY = clamp((bounds.minY + bounds.maxY) / 2, 28, height - 28);
  const centerX = clamp((bounds.minX + bounds.maxX) / 2, 28, width - 28);
  const rightX = bounds.maxX + gap;
  if (rightX + popupWidth <= width - sideSpace) {
    return {lngLat:state.map.unproject([rightX, centerY]), anchor:"left", offset:[0,0]};
  }
  const leftX = bounds.minX - gap;
  if (leftX - popupWidth >= sideSpace) {
    return {lngLat:state.map.unproject([leftX, centerY]), anchor:"right", offset:[0,0]};
  }
  const topY = bounds.minY - gap;
  if (topY >= 110) {
    return {lngLat:state.map.unproject([centerX, topY]), anchor:"bottom", offset:[0,0]};
  }
  const bottomY = bounds.maxY + gap;
  return {lngLat:state.map.unproject([centerX, clamp(bottomY, 28, height - 28)]), anchor:"top", offset:[0,0]};
}

function screenBoundsForGeometry(geometry) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  walkCoordinates(geometry, (coordinate) => {
    const point = state.map.project(coordinate);
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  });
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) return null;
  return {minX, minY, maxX, maxY};
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function selectionPadding() {
  return window.matchMedia("(max-width: 900px)").matches
    ? {top:90, right:90, bottom:90, left:90}
    : {top:90, right:380, bottom:90, left:90};
}

function zoomToFeature(feature, animate=true) {
  if (!feature?.geometry) return;
  const bounds = boundsForGeometry(feature.geometry);
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  if (sw.lng === ne.lng && sw.lat === ne.lat) {
    state.map.easeTo({center:[sw.lng, sw.lat], zoom:17, padding:selectionPadding(), duration:animate ? 650 : 0, essential:true});
    return;
  }
  state.map.fitBounds(bounds,{padding:selectionPadding(), duration:animate ? 650 : 0, maxZoom:17});
}

function renderInspector() {
  // The feature card is rendered on the map as a popup.
}

function closeInspector() {
  clearSelection();
}

function fitAll(animate=true) {
  const geometries = [];
  state.config.layers.forEach((layer) => {
    const visible = isConfiguredLayerVisible(layer);
    if (visible) filteredFeatures(layer).forEach((feature) => feature.geometry && geometries.push(feature.geometry));
  });
  if (!geometries.length) return showToast("Нет видимых объектов для показа");
  state.map.fitBounds(boundsForGeometry({type:"GeometryCollection",geometries}),{padding:state.config.map.fitPadding,duration:animate ? 650 : 0});
}

function fitLayer(layer, animate=true) {
  const geometries = filteredFeatures(layer).map((feature) => feature.geometry).filter(Boolean);
  if (!geometries.length) return showToast("Фильтр не нашёл объектов на карте");
  state.map.fitBounds(boundsForGeometry({type:"GeometryCollection",geometries}),{padding:state.config.map.fitPadding,duration:animate ? 650 : 0,maxZoom:16});
}

function boundsForGeometry(geometry) {
  const bounds = new maplibregl.LngLatBounds();
  walkCoordinates(geometry, (coordinate) => bounds.extend(coordinate));
  return bounds;
}

function walkCoordinates(geometry, visit) {
  if (geometry.type === "GeometryCollection") return geometry.geometries.forEach((item) => walkCoordinates(item,visit));
  const walk = (coordinates) => typeof coordinates[0] === "number" ? visit(coordinates) : coordinates.forEach(walk);
  walk(geometry.coordinates);
}

function bindUi() {
  document.getElementById("brandButton").addEventListener("click", () => fitAll());
  document.getElementById("closeLayers").addEventListener("click", () => document.getElementById("layersPanel").classList.remove("open"));
  document.getElementById("closeInspector").addEventListener("click", closeInspector);
  document.getElementById("searchForm").addEventListener("submit", searchFeatures);
  document.getElementById("searchInput").addEventListener("input", (event) => renderSearchResults(event.target.value));
  document.getElementById("searchInput").addEventListener("focus", (event) => renderSearchResults(event.target.value));
  document.getElementById("searchClear").addEventListener("click", () => { document.getElementById("searchInput").value=""; renderSearchResults(""); document.getElementById("searchInput").focus(); });
  document.getElementById("measureLength").addEventListener("click", () => toggleMeasureMode("length"));
  document.getElementById("measureArea").addEventListener("click", () => toggleMeasureMode("area"));
  document.getElementById("measureClear").addEventListener("click", clearMeasurement);
  document.getElementById("measureClose").addEventListener("click", stopMeasuring);
  document.getElementById("authorToggle").addEventListener("click", toggleAuthorMode);
  document.getElementById("authorClose").addEventListener("click", closeAuthorPanel);
  document.getElementById("copyStyleLink").addEventListener("click", copyStyleLink);
  document.getElementById("resetStyleLink").addEventListener("click", resetStyleOverrides);
  document.getElementById("labelVisibilityToggle").addEventListener("change", (event) => setGlobalLabelsVisible(event.target.checked));
  document.getElementById("copyCadastre").addEventListener("click", copyCadastre);
  document.getElementById("downloadFeature").addEventListener("click", downloadSelected);
  document.getElementById("exchangeHideAllToggle")?.addEventListener("change", (event) => setAllExchangeCategories(!event.target.checked));
  document.getElementById("exchangeLabelsToggle")?.addEventListener("change", (event) => { if (!state.exchange) return; state.exchange.labelsVisible = event.target.checked; const layer = exchangeLayer(); if (layer) applyExchangeVisibility(layer); });
  document.getElementById("exchangeSearchInput")?.addEventListener("input", (event) => { state.exchangeQuery = event.target.value || ""; renderExchangePanel(); });
  document.getElementById("toggleExchangePanel")?.addEventListener("click", () => {
    const panel = document.getElementById("exchangeCard");
    if (!panel) return;
    setExchangePanelCollapsed(!panel.classList.contains("collapsed"));
  });
  document.addEventListener("click", (event) => { const form = document.getElementById("searchForm"); if (form && !form.contains(event.target)) renderSearchResults(""); });
  bindLayerResizer();
  updateLabelVisibilityUi();
}

function renderSearchFields() {
  const input = document.getElementById("searchInput");
  if (!input) return;
  const layer = interactiveLayer();
  const selectedField = layer?.defaultSearchField || layer?.searchFields?.[0] || "";
  input.disabled = !selectedField;
  input.placeholder = "";
  renderSearchResults("");
}

function interactiveLayer() {
  return state.config.layers.find((layer) => layer.interactive) || state.config.layers[0] || null;
}

function getSearchMatches(rawQuery, limit = 20) {
  const query = String(rawQuery || "").trim().toLocaleLowerCase("ru");
  const layer = interactiveLayer();
  if (!query || !layer) return [];
  const selectedField = layer.defaultSearchField || layer.searchFields?.[0] || "";
  if (!selectedField) return [];
  const features = state.datasets.get(layer.id)?.features || [];
  return features
    .filter((item) => String(item.properties?.[selectedField] ?? "").toLocaleLowerCase("ru").includes(query))
    .slice(0, limit)
    .map((feature) => ({ layer, feature, value:String(feature.properties?.[selectedField] ?? "") }));
}

function renderSearchResults(rawQuery) {
  const results = document.getElementById("searchResults");
  if (!results) return;
  const query = String(rawQuery || "").trim();
  if (!query) {
    state.searchMatches = [];
    results.hidden = true;
    results.innerHTML = "";
    return;
  }
  const matches = getSearchMatches(query);
  state.searchMatches = matches;
  if (!matches.length) {
    results.hidden = false;
    results.innerHTML = '<div class="search-result"><strong>\u041d\u0438\u0447\u0435\u0433\u043e \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e</strong></div>';
    return;
  }
  results.hidden = false;
  results.innerHTML = matches.map((match, index) => '<button type="button" class="search-result" data-search-result="' + index + '"><strong>' + escapeHtml(match.value || "?") + '</strong><span>' + escapeHtml(match.layer.label) + '</span></button>').join('');
  results.querySelectorAll('[data-search-result]').forEach((button) => {
    button.addEventListener('click', () => {
      const match = matches[Number(button.dataset.searchResult)];
      if (!match) return;
      selectFeature(match.layer, match.feature, {zoom:true});
      renderSearchResults("");
      showToast("\u041d\u0430\u0439\u0434\u0435\u043d\u043e: " + match.layer.label);
    });
  });
}

function searchFeatures(event) {
  event.preventDefault();
  const matches = getSearchMatches(document.getElementById("searchInput").value, 1);
  if (matches.length) {
    const match = matches[0];
    selectFeature(match.layer, match.feature, {zoom:true});
    renderSearchResults("");
    showToast("\u041d\u0430\u0439\u0434\u0435\u043d\u043e: " + match.layer.label);
    return;
  }
  showToast("\u041e\u0431\u044a\u0435\u043a\u0442 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d");
}

function handleMeasureDoubleClick(event) {
  if (!state.measureMode) return;
  event.preventDefault();
  updateMeasure();
}

function toggleMeasureMode(mode) {
  if (state.measureMode === mode) {
    stopMeasuring();
    return;
  }
  clearSelection();
  state.measureMode = mode;
  state.measurePoints = [];
  state.measureCursor = null;
  updateMeasure();
  updateMeasureControls();
}

function stopMeasuring() {
  state.measureMode = null;
  state.measurePoints = [];
  state.measureCursor = null;
  updateMeasure();
  updateMeasureControls();
}

function clearMeasurement() {
  state.measurePoints = [];
  state.measureCursor = null;
  updateMeasure();
  if (state.measureMode) updateMeasureControls();
}

function updateMeasureControls() {
  const lengthButton = document.getElementById("measureLength");
  const areaButton = document.getElementById("measureArea");
  const clearButton = document.getElementById("measureClear");
  const panel = document.getElementById("measurePanel");
  const title = document.getElementById("measureTitle");
  const hint = document.getElementById("measureHint");
  const value = document.getElementById("measureValue");
  const active = Boolean(state.measureMode);
  document.body.classList.toggle("measure-mode", active);
  if (state.map?.doubleClickZoom) {
    if (active) state.map.doubleClickZoom.disable();
    else state.map.doubleClickZoom.enable();
  }
  lengthButton?.setAttribute("aria-pressed", String(state.measureMode === "length"));
  areaButton?.setAttribute("aria-pressed", String(state.measureMode === "area"));
  if (clearButton) clearButton.disabled = !active && !state.measurePoints.length;
  if (!panel || !title || !hint || !value) return;
  if (!active) {
    panel.hidden = true;
    value.textContent = "—";
    return;
  }
  panel.hidden = false;
  title.textContent = state.measureMode === "area" ? "Измерение площади" : "Измерение длины";
  if (!state.measurePoints.length) {
    hint.textContent = state.measureMode === "area" ? "Кликайте по контуру участка. Площадь будет показана в гектарах." : "Кликайте по линии маршрута. Длина будет показана в километрах.";
    value.textContent = "—";
    return;
  }
  hint.textContent = state.measureMode === "area" ? "Добавляйте точки по контуру. Двойной клик завершает фигуру, сброс очищает измерение." : "Добавляйте точки вдоль линии. Двойной клик завершает линию, сброс очищает измерение.";
}

function measureDisplayPoints() {
  if (!state.measureMode) return [];
  const points = state.measurePoints.slice();
  if (state.measureCursor && points.length) points.push(state.measureCursor);
  return points;
}

function updateMeasure() {
  const source = state.map.getSource("measure");
  if (!state.measureMode) {
    source?.setData(emptyFeatureCollection());
    const value = document.getElementById("measureValue");
    if (value) value.textContent = "—";
    return;
  }
  const points = measureDisplayPoints();
  const features = state.measurePoints.map((coordinates, index) => ({type:"Feature", properties:{index}, geometry:{type:"Point", coordinates}}));
  if (state.measureMode === "length" && points.length >= 2) {
    features.push({type:"Feature", properties:{mode:"length"}, geometry:{type:"LineString", coordinates:points}});
  }
  if (state.measureMode === "area" && points.length >= 2) {
    const line = points.length >= 3 ? [...points, points[0]] : points;
    features.push({type:"Feature", properties:{mode:"area-line"}, geometry:{type:"LineString", coordinates:line}});
  }
  if (state.measureMode === "area" && points.length >= 3) {
    features.push({type:"Feature", properties:{mode:"area"}, geometry:{type:"Polygon", coordinates:[[...points, points[0]]]}});
  }
  source?.setData({type:"FeatureCollection", features});
  renderMeasureValue(points);
}

function renderMeasureValue(points) {
  const value = document.getElementById("measureValue");
  if (!value) return;
  if (state.measureMode === "length") {
    if (points.length < 2) {
      value.textContent = "—";
      return;
    }
    const distance = totalDistance(points);
    value.textContent = distance < 1000 ? Math.round(distance) + " м" : (distance / 1000).toFixed(2) + " км";
    return;
  }
  if (points.length < 3) {
    value.textContent = "—";
    return;
  }
  const area = polygonAreaSquareMeters(points);
  value.textContent = (area / 10000).toFixed(2) + " га";
}

function totalDistance(points) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) total += haversine(points[index - 1], points[index]);
  return total;
}

function polygonAreaSquareMeters(points) {
  const projected = points.map(projectLngLatToMercator);
  let area = 0;
  for (let index = 0; index < projected.length; index += 1) {
    const [x1, y1] = projected[index];
    const [x2, y2] = projected[(index + 1) % projected.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

function projectLngLatToMercator(point) {
  const earth = 6378137;
  const lng = point[0] * Math.PI / 180;
  const lat = clamp(point[1], -85.05112878, 85.05112878) * Math.PI / 180;
  return [earth * lng, earth * Math.log(Math.tan(Math.PI / 4 + lat / 2))];
}

function haversine(a,b) {
  const rad = Math.PI / 180;
  const earth = 6371000;
  const dLat = (b[1] - a[1]) * rad;
  const dLon = (b[0] - a[0]) * rad;
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * earth * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function selectedSearchFieldKey() {
  return state.selected?.layer?.defaultSearchField || interactiveLayer()?.defaultSearchField || interactiveLayer()?.searchFields?.[0] || "";
}

async function copyCadastre() {
  const key = selectedSearchFieldKey();
  const value = key ? state.selected?.feature.properties?.[key] : "";
  if (!value) return showToast("У объекта нет значения атрибута поиска");
  await navigator.clipboard.writeText(String(value));
  showToast("Значение атрибута поиска скопировано");
}

function downloadSelected() {
  if (!state.selected) return;
  const blob = new Blob([JSON.stringify(state.selected.feature,null,2)],{type:"application/geo+json"});
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${state.selected.layer.id}-${state.selected.id}.geojson`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function updateMapStatus() {
  if (!state.map) return;
  const zoom = state.map.getZoom();
  const scale = Math.round((559082264.028 * Math.cos(state.map.getCenter().lat * Math.PI / 180)) / 2 ** zoom);
  document.getElementById("zoomStatus").textContent = `Масштаб 1:${new Intl.NumberFormat("ru-RU").format(scale)}`;
  document.getElementById("scaleCard").textContent = `1:${new Intl.NumberFormat("ru-RU").format(scale)}`;
}

function applyStoredPanelWidth() {
  const stored = Number(window.localStorage.getItem(PANEL_WIDTH_KEY));
  if (!Number.isFinite(stored)) return;
  document.documentElement.style.setProperty("--layers-width", `${Math.max(240, Math.min(520, stored))}px`);
}

function bindLayerResizer() {
  const handle = document.getElementById("layersResizer");
  const panel = document.getElementById("layersPanel");
  if (!handle || !panel) return;
  let startX = 0;
  let startWidth = 0;
  const move = (event) => {
    if (window.matchMedia("(max-width: 900px)").matches) return;
    const width = Math.max(240, Math.min(520, startWidth + (event.clientX - startX)));
    document.documentElement.style.setProperty("--layers-width", `${width}px`);
    window.localStorage.setItem(PANEL_WIDTH_KEY, String(width));
    state.map?.resize();
  };
  const stop = () => {
    document.body.classList.remove("resizing-layers");
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", stop);
    state.map?.resize();
  };
  handle.addEventListener("pointerdown", (event) => {
    if (window.matchMedia("(max-width: 900px)").matches) return;
    startX = event.clientX;
    startWidth = panel.getBoundingClientRect().width;
    document.body.classList.add("resizing-layers");
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  });
}
function initializeLayerDefaults() {
  state.config.layers.forEach((layer) => {
    if (!layer.style) layer.style = {};
    if (!layer.centroid) layer.centroid = {mode:"none", field:""};
    if (!layer.style.other && categoryRule(layer)) layer.style.other = null;
  });
}

function snapshotOriginalLayerStyles() {
  state.originalLayerStyles = new Map(state.config.layers.map((layer) => {
    const rule = categoryRule(layer);
    const enabledCategories = rule ? [...Object.keys(rule.values), ...(layer.style?.other ? [OTHER_CATEGORY] : [])] : [];
    return [layer.id, cloneValue({
      style:layer.style || {},
      centroid:layer.centroid || {mode:"none", field:""},
      visible:layer.visible !== false,
      renderOptions:defaultLayerRenderOptions(layer),
      enabledCategories
    })];
  }));
}

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function toggleAuthorMode() {
  state.authorMode = !state.authorMode;
  document.body.classList.toggle("author-mode", state.authorMode);
  document.getElementById("authorPanel").hidden = !state.authorMode;
  renderLayerList();
  lucide.createIcons();
}

function closeAuthorPanel() {
  state.authorMode = false;
  document.body.classList.remove("author-mode");
  document.getElementById("authorPanel").hidden = true;
  renderLayerList();
  lucide.createIcons();
}

function normalizeHexColor(color) {
  if (!color) return "#4b5563";
  const match = String(color).trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return "#4b5563";
  return match[1].length === 3 ? ("#" + match[1].split("").map((item) => item + item).join("")).toLowerCase() : ("#" + match[1].toLowerCase());
}

function darkenHexColor(color, factor = 0.68) {
  const hex = normalizeHexColor(color).slice(1);
  const rgb = [0, 2, 4].map((index) => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(index, index + 2), 16) * factor))));
  return "#" + rgb.map((value) => value.toString(16).padStart(2, "0")).join("");
}

function updateCategoryColor(layer, value, color, label) {
  const hex = normalizeHexColor(color);
  if (value === OTHER_CATEGORY) {
    if (!layer.style.other) layer.style.other = {label:"Остальные", lineColor:hex, lineOpacity:0.35, lineWidth:0.7};
    layer.style.other.lineColor = hex;
  } else {
    if (layer.style?.fillBy?.values) layer.style.fillBy.values[value] = hex;
    if (layer.style?.lineBy?.values) layer.style.lineBy.values[value] = darkenHexColor(hex);
  }
  const swatch = label?.querySelector(".category-swatch");
  if (swatch) swatch.style.background = hex;
  applyCategoryColors(layer);
}

function applyCategoryColors(layer) {
  if (state.map.getLayer(layer.id + "-fill")) state.map.setPaintProperty(layer.id + "-fill", "fill-color", ["case", ["boolean", ["feature-state", "selected"], false], "#ffea00", styleColorExpression(layer, "fillBy", layer.style.fillColor)]);
  if (state.map.getLayer(layer.id + "-line")) state.map.setPaintProperty(layer.id + "-line", "line-color", ["case", ["boolean", ["feature-state", "selected"], false], "#ffd400", styleColorExpression(layer, "lineBy", layer.style.lineColor)]);
  if (state.map.getLayer(layer.id + "-point")) {
    state.map.setPaintProperty(layer.id + "-point", "circle-color", ["case", ["boolean", ["feature-state", "selected"], false], "#ffea00", layer.style?.pointColor || layer.style?.fillColor || "#d85f5f"]);
    state.map.setPaintProperty(layer.id + "-point", "circle-stroke-color", ["case", ["boolean", ["feature-state", "selected"], false], "#5f4d00", layer.style?.pointStrokeColor || layer.style?.lineColor || "#1f2937"]);
  }
  if (state.map.getLayer(layer.id + "-other-line")) state.map.setPaintProperty(layer.id + "-other-line", "line-color", layer.style?.other?.lineColor || "#4b5563");
  applyCentroidLayer(layer);
  applyPointLabelLayer(layer);
}

function ensureCentroidLayer(layer) {
  if (!state.map || layer.kind !== "Polygon") return;
  const sourceId = layer.id + "-centroids";
  const centroidLayerId = layer.id + "-centroid";
  if (!state.map.getSource(sourceId)) {
    state.map.addSource(sourceId, {type:"geojson", data:createCentroidFeatureCollection(layer)});
  }
  if (state.map.getLayer(centroidLayerId)) return;
  state.map.addLayer({
    id: centroidLayerId,
    type: "symbol",
    source: sourceId,
    layout: {
      visibility: "none",
      "symbol-placement": "point",
      "text-field": centroidTextExpression(layer),
      "text-size": 12,
      "text-anchor": "center",
      "text-allow-overlap": false,
      "text-ignore-placement": false,
      "text-font": ["Open Sans Regular"]
    },
    paint: {
      "text-color": "#1c2523",
      "text-halo-color": "rgba(255,255,255,0.92)",
      "text-halo-width": 1.6
    }
  });
}

function applyPointLabelLayer(layer) {
  if (!state.map || layer.kind !== "Point") return;
  const layerId = layer.id + "-point-label";
  if (!state.map.getLayer(layerId)) return;
  const options = layerRenderOptions(layer);
  const visible = (state.layerVisible.get(layer.id) ?? layer.visible !== false) && state.labelsVisible && options.labelsVisible !== false && !!pointLabelField(layer) && (state.map.getZoom?.() ?? 0) >= Number(options.minZoom || 14);
  state.map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
  state.map.setLayoutProperty(layerId, "text-field", pointLabelExpression(layer));
}

function applyCentroidLayer(layer) {
  if (!state.map || layer.kind !== "Polygon") return;
  ensureCentroidLayer(layer);
  const sourceId = layer.id + "-centroids";
  const centroidLayerId = layer.id + "-centroid";
  state.map.getSource(sourceId)?.setData(createCentroidFeatureCollection(layer));
  if (!state.map.getLayer(centroidLayerId)) return;
  const mode = layer.centroid?.mode || "none";
  const zoomVisible = (state.map.getZoom?.() ?? LABEL_MIN_ZOOM) >= LABEL_MIN_ZOOM;
  const visible = (state.layerVisible.get(layer.id) ?? layer.visible !== false) && state.labelsVisible && zoomVisible && mode !== "none";
  state.map.setLayoutProperty(centroidLayerId, "visibility", visible ? "visible" : "none");
  state.map.setLayoutProperty(centroidLayerId, "text-field", centroidTextExpression(layer));
}

function centroidTextExpression(layer) {
  const mode = layer.centroid?.mode || "none";
  const field = layer.centroid?.field || "";
  const fieldValue = field ? ["to-string", ["coalesce", ["get", field], ""]] : "";
  if (mode === "marker") return "•";
  if (mode === "label") return field ? fieldValue : "";
  if (mode === "both") return field ? ["concat", "• ", fieldValue] : "•";
  return "";
}

function buildCentroidFilterExpression(layer) {
  const rule = categoryRule(layer);
  const selected = state.categoryFilters.get(layer.id);
  if (!rule || !selected) return null;
  const property = ["coalesce", ["to-string", ["get", rule.property]], ""];
  const known = Object.keys(rule.values);
  const selectedKnown = known.filter((value) => selected.has(value));
  const includeOther = Boolean(layer.style?.other && selected.has(OTHER_CATEGORY));
  if (selectedKnown.length === known.length && !includeOther) return null;
  const clauses = [];
  if (selectedKnown.length) clauses.push(["in", property, ["literal", selectedKnown]]);
  if (includeOther) clauses.push(["!", ["in", property, ["literal", known]]]);
  if (!clauses.length) return ["==", ["literal", true], false];
  return clauses.length === 1 ? clauses[0] : ["any", ...clauses];
}

function collectStyleOverrides() {
  const layers = {};
  state.config.layers.forEach((layer) => {
    const original = state.originalLayerStyles.get(layer.id) || {};
    const current = {style: layer.style || {}, centroid: layer.centroid || {mode:"none", field:""}};
    const override = {};
    const currentVisible = state.layerVisible.get(layer.id) ?? (layer.visible !== false);
    if (currentVisible !== original.visible) override.visible = currentVisible;
    const currentOptions = state.layerRenderOptions.get(layer.id) || layerRenderOptions(layer);
    if (JSON.stringify(currentOptions) !== JSON.stringify(original.renderOptions || {})) override.renderOptions = currentOptions;
    const currentCategories = [...(state.categoryFilters.get(layer.id) || new Set(original.enabledCategories || []))];
    if (JSON.stringify(currentCategories) !== JSON.stringify(original.enabledCategories || [])) override.enabledCategories = currentCategories;
    const currentBaseFill = current.style?.fillColor || null;
    const originalBaseFill = original.style?.fillColor || null;
    if (currentBaseFill && currentBaseFill !== originalBaseFill) override.fillColor = currentBaseFill;
    const currentBaseLine = current.style?.lineColor || null;
    const originalBaseLine = original.style?.lineColor || null;
    if (currentBaseLine && currentBaseLine !== originalBaseLine) override.lineColor = currentBaseLine;
    const currentFill = current.style?.fillBy?.values || {};
    const originalFill = original.style?.fillBy?.values || {};
    const fillDiff = Object.fromEntries(Object.entries(currentFill).filter(([key, value]) => originalFill[key] !== value));
    if (Object.keys(fillDiff).length) override.fillBy = fillDiff;
    const currentOther = current.style?.other?.lineColor || null;
    const originalOther = original.style?.other?.lineColor || null;
    if (currentOther && currentOther !== originalOther) override.other = currentOther;
    const currentCentroid = current.centroid || {mode:"none", field:""};
    const originalCentroid = original.centroid || {mode:"none", field:""};
    if (currentCentroid.mode !== originalCentroid.mode || (currentCentroid.field || "") !== (originalCentroid.field || "")) override.centroid = currentCentroid;
    if (Object.keys(override).length) layers[layer.id] = override;
  });
  const payload = {layers};
  if (!state.labelsVisible) payload.labelsVisible = false;
  if (state.exchange) payload.exchange = {visible:state.exchange.visible, labelsVisible:state.exchange.labelsVisible === true, groups:Object.fromEntries((state.exchange.groups || []).map((group) => [group.value, {enabled:group.enabled !== false, subgroups:group.subgroups || {}}]))};
  return payload;
}

function applyStyleOverridesPayload(payload) {
  if (!payload || typeof payload !== "object") return;
  if (typeof payload.labelsVisible === "boolean") state.labelsVisible = payload.labelsVisible;
  if (payload.exchange) state.exchangePreset = payload.exchange;
  Object.entries(payload.layers || {}).forEach(([layerId, override]) => {
    const layer = state.config.layers.find((item) => item.id === layerId);
    if (!layer) return;
    if (typeof override.visible === "boolean") state.layerVisible.set(layer.id, override.visible);
    if (override.renderOptions) state.layerRenderOptions.set(layer.id, override.renderOptions);
    if (Array.isArray(override.enabledCategories)) state.categoryFilters.set(layer.id, new Set(override.enabledCategories));
    if (override.fillColor) layer.style.fillColor = override.fillColor;
    if (override.lineColor) layer.style.lineColor = override.lineColor;
    Object.entries(override.fillBy || {}).forEach(([value, color]) => {
      if (layer.style?.fillBy?.values) layer.style.fillBy.values[value] = color;
      if (layer.style?.lineBy?.values) layer.style.lineBy.values[value] = darkenHexColor(color);
    });
    if (override.other && layer.style?.other) layer.style.other.lineColor = override.other;
    if (override.centroid) layer.centroid = {...layer.centroid, ...override.centroid};
  });
}

async function applyPersistedStyleOverrides() {
  try {
    const payload = await fetchJson(`style.json?ts=${Date.now()}`);
    applyStyleOverridesPayload(payload);
  } catch (error) {
    console.warn("style.json \u043d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u0437\u0430\u0432\u0430\u043d\u0442\u0430\u0436\u0438\u0442\u0438", error);
  }
}

function applyUrlStyleOverrides() {
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get("style");
  if (!encoded) return;
  try {
    applyStyleOverridesPayload(JSON.parse(decodeBase64Unicode(encoded)));
  } catch (error) {
    console.error(error);
  }
}

function buildLegacyStyleLink() {
  const overrides = collectStyleOverrides();
  const url = new URL(window.location.href);
  if (!Object.keys(overrides.layers || {}).length && overrides.labelsVisible !== false && !overrides.exchange) url.searchParams.delete("style");
  else url.searchParams.set("style", encodeBase64Unicode(JSON.stringify(overrides)));
  return url.toString();
}

function buildStyleLink() {
  const url = new URL(window.location.href);
  url.searchParams.delete("style");
  return url.toString();
}

async function persistStyleOverrides() {
  const response = await fetch("__qwp__/style", {
    method: "POST",
    headers: {"Content-Type": "application/json; charset=utf-8"},
    body: JSON.stringify(collectStyleOverrides())
  });
  if (!response.ok) throw new Error("\u043d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u0437\u0431\u0435\u0440\u0435\u0433\u0442\u0438 style.json: HTTP " + response.status);
  try {
    return await response.json();
  } catch (error) {
    return {};
  }
}

function updateStyleLinkField(url) {
  const field = document.getElementById("styleLinkOutput");
  if (!field) return;
  field.value = url;
  field.setAttribute("value", url);
  field.focus();
  field.select();
}

async function copyStyleLink() {
  const shortUrl = buildStyleLink();
  try {
    await persistStyleOverrides();
    window.history.replaceState({}, "", shortUrl);
    updateStyleLinkField(shortUrl);
    await navigator.clipboard.writeText(shortUrl);
    showToast("Короткая ссылка скопирована");
  } catch (error) {
    console.error(error);
    const fallbackUrl = buildLegacyStyleLink();
    window.history.replaceState({}, "", fallbackUrl);
    updateStyleLinkField(fallbackUrl);
    try {
      await navigator.clipboard.writeText(fallbackUrl);
    } catch (clipboardError) {
      console.error(clipboardError);
    }
    showToast("style.json не сохранён, скопирована длинная ссылка");
  }
}

async function resetStyleOverrides() {
  state.labelsVisible = true;
  state.exchangePreset = null;
  state.config.layers.forEach((layer) => {
    const original = state.originalLayerStyles.get(layer.id);
    if (!original) return;
    layer.style = cloneValue(original.style || {});
    layer.centroid = cloneValue(original.centroid || {mode:"none", field:""});
    if (typeof original.visible === "boolean") state.layerVisible.set(layer.id, original.visible);
    if (original.renderOptions) state.layerRenderOptions.set(layer.id, cloneValue(original.renderOptions));
    state.categoryFilters.set(layer.id, new Set(original.enabledCategories || []));
    applyCategoryColors(layer);
    applyLayerRenderOptions(layer);
    applyCombinedLayerFilter(layer);
    applyCentroidLayer(layer);
  });
  initializeExchangeState();
  const exchange = exchangeLayer();
  if (exchange) applyExchangeVisibility(exchange);
  const url = buildStyleLink();
  window.history.replaceState({}, "", url);
  renderLayerList();
  lucide.createIcons();
  try {
    await persistStyleOverrides();
    showToast("Стиль сброшен к публикации");
  } catch (error) {
    console.error(error);
    showToast("Стиль сброшен локально");
  }
}
function buildCentroidDatasets() {
  state.centroidDatasets.clear();
  state.config.layers.forEach((layer) => {
    if (layer.kind === "Polygon") state.centroidDatasets.set(layer.id, createCentroidFeatureCollection(layer));
  });
}

function createCentroidFeatureCollection(layer) {
  const features = (state.datasets.get(layer.id)?.features || []).map((feature, index) => {
    const coordinates = representativePointForGeometry(feature.geometry);
    if (!coordinates) return null;
    return {
      type:"Feature",
      id:String(feature.id ?? feature.properties?.id ?? index + 1),
      properties:{...(feature.properties || {})},
      geometry:{type:"Point", coordinates}
    };
  }).filter(Boolean);
  return {type:"FeatureCollection", features};
}

function representativePointForGeometry(geometry) {
  if (!geometry) return null;
  if (geometry.type === "Polygon") return representativePointForPolygon(geometry.coordinates);
  if (geometry.type === "MultiPolygon") {
    const largest = geometry.coordinates.slice().sort((a, b) => Math.abs(ringArea(b[0] || [])) - Math.abs(ringArea(a[0] || [])))[0];
    return representativePointForPolygon(largest);
  }
  return null;
}

function representativePointForPolygon(rings) {
  const outer = rings?.[0];
  if (!outer?.length) return null;
  const centroid = polygonCentroid(outer);
  if (centroid && ringContainsPoint(outer, centroid)) return centroid;
  return ringBoundsCenter(outer);
}

function polygonCentroid(ring) {
  let area = 0;
  let x = 0;
  let y = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const factor = xi * yj - xj * yi;
    area += factor;
    x += (xi + xj) * factor;
    y += (yi + yj) * factor;
  }
  if (!area) return ringBoundsCenter(ring);
  const normalizedArea = area / 2;
  return [x / (6 * normalizedArea), y / (6 * normalizedArea)];
}

function ringArea(ring) {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) area += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  return area / 2;
}

function ringBoundsCenter(ring) {
  const bounds = ring.reduce((acc, point) => ({minX:Math.min(acc.minX, point[0]), minY:Math.min(acc.minY, point[1]), maxX:Math.max(acc.maxX, point[0]), maxY:Math.max(acc.maxY, point[1])}), {minX:Infinity, minY:Infinity, maxX:-Infinity, maxY:-Infinity});
  return [(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2];
}

function encodeBase64Unicode(value) {
  return btoa(unescape(encodeURIComponent(value)));
}

function decodeBase64Unicode(value) {
  return decodeURIComponent(escape(atob(value)));
}

function handleMapError() {}
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove("visible"),2200);
}

function emptyFeatureCollection() { return {type:"FeatureCollection",features:[]}; }
function escapeHtml(value) { const node=document.createElement("span"); node.textContent=value; return node.innerHTML; }



function setGlobalLabelsVisible(visible) {
  state.labelsVisible = Boolean(visible);
  updateLabelVisibilityUi();
  refreshCentroidLayers();
  refreshPointLabelLayers();
}

function refreshCentroidLayers() {
  if (!state.map) return;
  state.config?.layers?.forEach((layer) => {
    if (layer.kind === "Polygon") applyCentroidLayer(layer);
  });
  const exchange = exchangeLayer();
  if (exchange) applyExchangeVisibility(exchange);
}

function refreshPointLabelLayers() {
  if (!state.map) return;
  state.config?.layers?.forEach((layer) => {
    if (layer.kind === "Point") applyPointLabelLayer(layer);
  });
}

function updateLabelVisibilityUi() {
  const input = document.getElementById("labelVisibilityToggle");
  const card = document.getElementById("labelVisibilityCard");
  if (!input) return;
  input.checked = state.labelsVisible;
  const zoom = state.map?.getZoom?.() ?? LABEL_MIN_ZOOM;
  const autoHidden = zoom < LABEL_MIN_ZOOM;
  if (card) card.title = autoHidden
    ? "Подписи скрыты до масштаба " + LABEL_MIN_ZOOM
    : "Подписи автоматически скрываются при масштабе меньше " + LABEL_MIN_ZOOM;
}


