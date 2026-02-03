# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an interactive 3D globe visualization built with Three.js and Parcel. The application renders a detailed Earth globe with location markers that can be dynamically added and customized through a sidebar control panel.

## Commands

### Development
```bash
npm start
```
Starts the Parcel development server with hot module replacement. Opens the application at http://localhost:1234 (or next available port).

### Production Build
```bash
npm run build
```
Builds the application for production. Output is written to the `dist/` directory with minified and optimized assets.

### Linting
```bash
npx eslint script.js
```
Runs ESLint on the JavaScript code. Configuration uses babel-eslint parser.

## Architecture

### Core Components

**Scene Setup (script.js:12-26)**
- Three.js scene with PerspectiveCamera and WebGLRenderer
- Renderer attached to #container div element
- Initial camera positioned at z=2.5

**Globe Rendering (script.js:28-75)**
- SphereGeometry with 256x256 segments for high-detail displacement mapping
- Three texture maps applied to globe material:
  - `earth_texture.png` - Base color map
  - `8k_earth_normal_map.png` - Normal map for surface detail (also used as displacement map)
  - `8k_earth_specular_map.png` - Specular highlights
- MeshStandardMaterial with displacement mapping for physical terrain elevation
- Images loaded via Parcel's URL import system (`new URL('./file.png', import.meta.url)`)

**Marker System (script.js:77-148)**
- `latLonToVector3()` converts geographic coordinates to 3D sphere positions
- `addMarker()` creates CircleGeometry markers positioned on globe surface
- `geocodeAndAddMarkers()` fetches coordinates from OpenStreetMap Nominatim API
- 1-second delay between API calls to respect rate limits
- Markers stored in global `markers` array

**Lighting System (script.js:149-167)**
- AmbientLight for base illumination
- Three DirectionalLights positioned at different angles for uniform lighting
- Lights are configurable via UI controls (intensity adjustments)

**Interaction (script.js:169-195)**
- OrbitControls for camera manipulation (rotation, zoom, pan)
- Damping enabled for smooth camera movement
- Distance constrained between 1.5 and 5 units
- Globe auto-rotates at 0.002 radians per frame

**UI Controls (script.js:197-302)**
- Sidebar toggles on button click
- Real-time controls for:
  - Background color (hex color picker)
  - Marker color and size
  - Ambient and directional light intensity
  - Location management (add/remove cities)
- Location list persists in `settings.locations` array
- "Refresh Markers" button re-geocodes and re-renders all markers

### Data Flow

1. User adds location name → stored in `settings.locations`
2. Click "Refresh Markers" → `geocodeAndAddMarkers()` called
3. For each location:
   - Fetch coordinates from Nominatim API
   - Convert lat/lon to 3D position via `latLonToVector3()`
   - Create marker mesh with current settings
   - Add to globe as child object
4. Animation loop continuously rotates globe and updates controls

### External Dependencies

- **Three.js (0.182.0)** - 3D rendering engine
- **Parcel** - Zero-config bundler with automatic asset handling
- **OpenStreetMap Nominatim API** - Geocoding service (no API key required)

## Important Notes

### Asset Loading
Always use Parcel's URL import pattern for static assets:
```javascript
const assetUrl = new URL('./asset.png', import.meta.url);
textureLoader.load(assetUrl.href);
```

### API Rate Limiting
The Nominatim API has rate limits. The code includes a 1-second delay between requests. Do not remove this delay or make parallel requests.

### Normal Map Color Space
Normal maps must use `THREE.NoColorSpace` to prevent incorrect lighting calculations:
```javascript
normalMap.colorSpace = THREE.NoColorSpace;
```

### Marker Orientation
Markers use `lookAt()` with outward-facing normal vectors to ensure they appear flat against the globe surface rather than perpendicular to the camera.
