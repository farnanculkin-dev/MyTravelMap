# MyTravelMap

A simple family travel map web app (Version 1).

This branch contains a minimal Vite + React app implementing:

- Family profile selection (Mum, Dad, Amelia, Dylan, Cian)
- Interactive SVG map generated from local TopoJSON data
- Click/tap a country to toggle visited/unvisited for the selected profile
- Visited-country counter
- Per-profile persistence using a TravelRepository abstraction and a LocalStorageTravelRepository implementation

Files of interest
- src/data/countries.json — single source of truth for country definitions and stable IDs
- public/data/europe-topo.json — generated map data used by the interactive SVG map
- src/lib/TravelRepository.ts — interface for persistence
- src/lib/LocalStorageTravelRepository.ts — localStorage-backed implementation

Map data sources and transformation steps (how to produce a full, accurate TopoJSON/SVG)

For a production-quality map that exactly matches your printed map (England, Scotland, Wales, Northern Ireland as separate features, plus Faroe Islands), use the following public data sources and steps to produce a combined TopoJSON or SVG asset:

1) Sources
- Natural Earth (public domain) — use relevant Admin 0 / Admin 1 shapefiles: https://www.naturalearthdata.com
- martinjc / UK-GeoJSON — GeoJSON boundaries for UK constituent countries: https://github.com/martinjc/UK-GeoJSON

2) Generate the map
- Download Natural Earth Admin 0 (10m) GeoJSON and the martinjc UK GeoJSON files.
- Remove the Natural Earth United Kingdom feature, add England, Scotland, Wales and Northern Ireland separately, and export the combined TopoJSON:

  npm run generate:topo

3) Attribution / licensing
- Natural Earth: public domain — attribution recommended but not required. https://www.naturalearthdata.com
- martinjc/UK-GeoJSON: see repository for license; it's permissive and widely used. https://github.com/martinjc/UK-GeoJSON

Run locally
1. npm install
2. npm run dev
3. Open http://localhost:5173

Build for production
1. npm run build
2. npm run preview

The generated TopoJSON is intentionally ignored by Git and can be recreated with `npm run generate:topo` before local development or production builds.

