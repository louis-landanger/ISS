# Orbit

A cinematic, interactive solar system with realistic textured planets and a liquid glass interface. Built with Three.js and browser-native JavaScript, CSS, and HTML.

## Run locally

From the repository root:

```sh
python3 -m http.server 5173 --directory dist
```

Open http://localhost:5173. No package installation or build step is required. Serve `dist/` through any static web host; ES modules require HTTP rather than opening the file directly.

## Explore

- Drag to orbit the camera; scroll or pinch to zoom.
- Select a planet from the glass dock or from the solar system overview.
- Pause and adjust animation speed.
- Space pauses, arrow keys change planets, R resets the camera, and H hides the interface when focus is outside a control. All controls are keyboard accessible.
- Reduced-motion preferences pause animation by default and skip camera transitions.

The visualization uses illustrative sizes, compressed distances, and circular orbits. Positions are not a live ephemeris. Orbital periods preserve relative rates; rotation is accelerated separately. Textured colors are artistic reconstructions and may differ from natural-color spacecraft photography.

## Structure

- `dist/index.html` — interface, metadata, and accessible controls
- `dist/styles.css` — glass materials and responsive layout
- `dist/app.js` — interface state and browser-native agent tools
- `dist/scene.js` — 3D rendering, camera, lighting, and orbital animation
- `dist/data.js` — planetary facts
- `dist/assets/` — local planet textures
- `dist/vendor/` — Three.js 0.180.0 and OrbitControls (MIT)

The shipped site has no external runtime dependencies or network data APIs. Source and vendor assets are committed so it can be hosted independently.

See [CREDITS.md](CREDITS.md) for source attribution. The generated design concept is a reference only; the website renders live 3D geometry, not a screenshot.
