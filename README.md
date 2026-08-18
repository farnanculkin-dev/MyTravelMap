# MyTravelMap

A simple family travel map web app (Version 1).

This branch contains a minimal Vite + React app implementing:

- Family profile selection (Mum, Dad, Amelia, Dylan, Cian)
- Interactive SVG map (placeholder in this commit)
- Click/tap a country to toggle visited/unvisited for the selected profile
- Visited-country counter
- Per-profile persistence using a TravelRepository abstraction and a LocalStorageTravelRepository implementation

Files of interest
- src/data/countries.json — single source of truth for country definitions and stable IDs
- public/data/europe-map.svg — placeholder SVG map (replaceable with a real political SVG or TopoJSON export)
- src/lib/TravelRepository.ts — interface for persistence
- src/lib/LocalStorageTravelRepository.ts — localStorage-backed implementation

Map data sources and transformation steps (how to produce a full, accurate TopoJSON/SVG)

For a production-quality map that exactly matches your printed map (England, Scotland, Wales, Northern Ireland as separate features, plus Faroe Islands), use the following public data sources and steps to produce a combined TopoJSON or SVG asset:

1) Sources
- Natural Earth (public domain) — use relevant Admin 0 / Admin 1 shapefiles: https://www.naturalearthdata.com
- martinjc / UK-GeoJSON — GeoJSON boundaries for UK constituent countries: https://github.com/martinjc/UK-GeoJSON

2) Suggested transformation steps (using Node and mapshaper)
- Install mapshaper: npm install -g mapshaper
- Download Natural Earth Admin 0/1 (10m) GeoJSON and the martinjc UK GeoJSON files.
- Merge/replace the UK MultiPolygon in Natural Earth with the martinjc features so England/Scotland/Wales/Northern Ireland are separate.
- Export a simplified TopoJSON for the web:

  mapshaper naturalearth_europe.geojson martinjc_uk.geojson -merge-files -o format=topojson precision=1e5 europe-topo.json

3) Attribution / licensing
- Natural Earth: public domain — attribution recommended but not required. https://www.naturalearthdata.com
- martinjc/UK-GeoJSON: see repository for license; it's permissive and widely used. https://github.com/martinjc/UK-GeoJSON

Current placeholder map
- This initial commit includes a placeholder SVG at public/data/europe-map.svg to verify UI functionality and persistence.
- Replace public/data/europe-map.svg or provide a TopoJSON at public/data/europe-topo.json and adjust src/components/MapView.tsx to load and render the TopoJSON features.

Run locally
1. npm install
2. npm run dev
3. Open http://localhost:5173

Build for production
1. npm run build
2. npm run preview

Next steps to replace placeholder map with real map
- Generate europe-topo.json using Natural Earth + martinjc as described above and place it at public/data/europe-topo.json
- Update MapView to render TopoJSON/GeoJSON (d3-geo + topojson-client) instead of the placeholder SVG rectangles. The project is structured so this can be done without changing the persistence or UI logic.

