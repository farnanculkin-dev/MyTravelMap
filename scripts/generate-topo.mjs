import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { feature, merge } from 'topojson-client'
import { topology } from 'topojson-server'
import polygonClipping from 'polygon-clipping'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(root, 'public/data/europe-topo.json')
const countriesPath = resolve(root, 'src/data/countries.json')
const EUROPE_CLIP = [[[-30, 25], [50, 25], [50, 72], [-30, 72], [-30, 25]]]

const NATURAL_EARTH_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson'
const UK_URLS = {
  'GB-ENG': 'https://raw.githubusercontent.com/martinjc/UK-GeoJSON/master/json/electoral/eng/topo_eer.json',
  'GB-SCT': 'https://raw.githubusercontent.com/martinjc/UK-GeoJSON/master/json/electoral/sco/topo_eer.json',
  'GB-WLS': 'https://raw.githubusercontent.com/martinjc/UK-GeoJSON/master/json/electoral/wal/topo_eer.json',
  'GB-NIR': 'https://raw.githubusercontent.com/martinjc/UK-GeoJSON/master/json/electoral/ni/topo_eer.json',
}

const naturalEarthIdByAppId = {
  IS: 'IS', IE: 'IE', PT: 'PT', ES: 'ES', FR: 'FR', BE: 'BE', NL: 'NL', LU: 'LU',
  DE: 'DE', CH: 'CH', AT: 'AT', LI: 'LI', IT: 'IT', SM: 'SM', VA: 'VA', MC: 'MC',
  AD: 'AD', DK: 'DK', NO: 'NO', SE: 'SE', FI: 'FI', FO: 'FO', EE: 'EE', LV: 'LV',
  LT: 'LT', PL: 'PL', CZ: 'CZ', SK: 'SK', HU: 'HU', SI: 'SI', HR: 'HR', BA: 'BA',
  RS: 'RS', ME: 'ME', XK: 'XK', AL: 'AL', MK: 'MK', GR: 'GR', BG: 'BG', RO: 'RO',
  MD: 'MD', UA: 'UA', BY: 'BY', RU: 'RU', MT: 'MT', CY: 'CY', TR: 'TR', MA: 'MA',
  DZ: 'DZ', TN: 'TN',
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to download ${url}: ${response.status}`)
  return response.json()
}

function naturalEarthCode(properties) {
  return properties.ISO_A2_EH || properties.ISO_A2 || properties.ADM0_A3
}

function clipToEurope(geometry) {
  const subject = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  const clipped = polygonClipping.intersection([EUROPE_CLIP], subject)
  if (clipped.length === 0) throw new Error('Russia does not intersect the Europe clip window')
  return {
    type: 'MultiPolygon',
    coordinates: clipped.map((polygon) => polygon.map((ring) => ring.slice().reverse())),
  }
}

function geometryParts(geometry) {
  return geometry.type === 'Polygon'
    ? [geometry.coordinates]
    : geometry.coordinates
}

function partBounds(part) {
  const points = part.flat(1)
  return points.reduce(
    (bounds, [longitude, latitude]) => [
      Math.min(bounds[0], longitude),
      Math.min(bounds[1], latitude),
      Math.max(bounds[2], longitude),
      Math.max(bounds[3], latitude),
    ],
    [Infinity, Infinity, -Infinity, -Infinity],
  )
}

function keepEuropeanPortugalAndSpain(geometry, appId) {
  const parts = geometryParts(geometry)
  const retained = parts.filter((part) => {
    const [minLongitude, minLatitude, maxLongitude, maxLatitude] = partBounds(part)
    if (appId === 'PT') return maxLongitude > -10 && minLongitude < -6 && maxLatitude > 36
    if (appId === 'FR') return maxLongitude > -6 && minLongitude < 10 && maxLatitude > 41 && minLatitude < 52
    return (
      (maxLongitude > -10 && minLongitude < 5 && maxLatitude > 35) ||
      (minLongitude > -20 && maxLongitude < -12 && minLatitude > 26 && maxLatitude < 30)
    )
  })
  return retained.length === 1
    ? { type: 'Polygon', coordinates: retained[0] }
    : { type: 'MultiPolygon', coordinates: retained }
}

function asMultiPolygon(geometry) {
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
}

function isCrimea(part) {
  const [minLongitude, minLatitude, maxLongitude, maxLatitude] = partBounds(part)
  return minLongitude > 30 && maxLongitude < 40 && minLatitude > 43 && maxLatitude < 47
}

function moveCrimeaToUkraine(features) {
  const russia = features.find((candidate) => candidate.properties.mapId === 'RU')
  const ukraine = features.find((candidate) => candidate.properties.mapId === 'UA')
  if (!russia || !ukraine) throw new Error('Could not find Ukraine and Russia features')

  const russiaParts = asMultiPolygon(russia.geometry)
  const crimeaParts = russiaParts.filter(isCrimea)
  if (crimeaParts.length !== 1) throw new Error(`Expected one Crimea polygon in Russia, found ${crimeaParts.length}`)

  russia.geometry = { type: 'MultiPolygon', coordinates: russiaParts.filter((part) => !isCrimea(part)) }
  ukraine.geometry = { type: 'MultiPolygon', coordinates: [...asMultiPolygon(ukraine.geometry), ...crimeaParts] }
}

function offsetArcReferences(value, offset) {
  if (Array.isArray(value)) return value.map((item) => offsetArcReferences(item, offset))
  if (typeof value !== 'number') return value
  const index = value >= 0 ? value : ~value
  const shifted = index + offset
  return value >= 0 ? shifted : ~shifted
}

const countries = JSON.parse(await readFile(countriesPath, 'utf8'))
const mapCountries = countries.filter((country) => country.mapVisible !== false)
const naturalEarth = await fetchJson(NATURAL_EARTH_URL)
const requiredCodes = new Set(Object.values(naturalEarthIdByAppId))
const naturalCandidates = naturalEarth.features
  .filter((candidate) => naturalEarthCode(candidate.properties) !== 'GB')
  .filter((candidate) => requiredCodes.has(naturalEarthCode(candidate.properties)))
  .map((candidate) => {
    const sourceCode = naturalEarthCode(candidate.properties)
    const appId = Object.keys(naturalEarthIdByAppId).find(
      (id) => naturalEarthIdByAppId[id] === sourceCode,
    )
    let geometry = ['NO', 'RU'].includes(appId)
      ? clipToEurope(candidate.geometry)
      : candidate.geometry
    if (['PT', 'ES', 'FR'].includes(appId)) {
      geometry = keepEuropeanPortugalAndSpain(geometry, appId)
    }
    return {
      ...candidate,
      geometry,
      properties: { mapId: appId, mapName: countries.find((country) => country.id === appId).name },
    }
  })

const naturalFeatures = Object.values(
  naturalCandidates.reduce((groups, candidate) => {
    const existing = groups[candidate.properties.mapId]
    if (!existing) {
      groups[candidate.properties.mapId] = candidate
      return groups
    }

    const polygons = [existing.geometry, candidate.geometry].flatMap((geometry) =>
      geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates,
    )
    groups[candidate.properties.mapId] = {
      ...existing,
      geometry: { type: 'MultiPolygon', coordinates: polygons },
    }
    return groups
  }, {}),
)
moveCrimeaToUkraine(naturalFeatures)

const ukFeatures = await Promise.all(
  Object.entries(UK_URLS).map(async ([appId, url]) => {
    const ukTopology = await fetchJson(url)
    const objectName = Object.keys(ukTopology.objects)[0]
    const sourceObject = ukTopology.objects[objectName]
    const collection = feature(ukTopology, sourceObject)
    const ukGeometry = sourceObject.geometries.length > 1
      ? merge(ukTopology, sourceObject.geometries)
      : collection.features[0].geometry
    return {
      type: 'Feature',
      geometry: ukGeometry,
      properties: { mapId: appId, mapName: countries.find((country) => country.id === appId).name },
    }
  }),
)

const contextFeatures = naturalEarth.features
  .filter((candidate) => ['LY', 'EG', 'IL', 'SY', 'GE'].includes(naturalEarthCode(candidate.properties)))
  .map((candidate) => ({
    ...candidate,
    properties: {
      contextId: naturalEarthCode(candidate.properties),
      contextName: candidate.properties.NAME_EN,
    },
  }))
// Allow Georgia to be optional (may fall outside viewport after enlargement)
const expectedContextIds = new Set(['LY', 'EG', 'IL', 'SY', 'GE'])
const foundContextIds = new Set(contextFeatures.map((f) => f.properties.contextId))
if (!foundContextIds.has('LY') || !foundContextIds.has('EG') || !foundContextIds.has('IL') || !foundContextIds.has('SY')) {
  throw new Error('Natural Earth map data missing required context features (Libya, Egypt, Israel, Syria)')
}

const expectedIds = new Set(mapCountries.map((country) => country.id))
const combinedFeatures = [...naturalFeatures, ...ukFeatures]
const matchedIds = new Set(combinedFeatures.map((candidate) => candidate.properties.mapId))
const missingIds = mapCountries.filter((country) => !matchedIds.has(country.id)).map((country) => country.id)
if (missingIds.length > 0) throw new Error(`Map generation missing country IDs: ${missingIds.join(', ')}`)
if (combinedFeatures.length !== expectedIds.size) {
  throw new Error(`Map generation emitted ${combinedFeatures.length} features for ${expectedIds.size} mapped countries`)
}

await mkdir(dirname(outputPath), { recursive: true })
const russiaFeature = combinedFeatures.find((candidate) => candidate.properties.mapId === 'RU')
const otherCountryFeatures = combinedFeatures.filter((candidate) => candidate.properties.mapId !== 'RU')
const baseTopology = topology({
  countries: { type: 'FeatureCollection', features: otherCountryFeatures },
  context: { type: 'FeatureCollection', features: contextFeatures },
})
const russiaTopology = topology({ russia: russiaFeature })
const russiaObject = {
  ...russiaTopology.objects.russia,
  arcs: offsetArcReferences(russiaTopology.objects.russia.arcs, baseTopology.arcs.length),
}
const outputTopology = {
  type: 'Topology',
  objects: { ...baseTopology.objects, russia: russiaObject },
  arcs: [...baseTopology.arcs, ...russiaTopology.arcs],
}
await writeFile(
  outputPath,
  `${JSON.stringify(outputTopology, null, 2)}\n`,
)
console.log(`Generated ${combinedFeatures.length} matched country features at ${outputPath}`)