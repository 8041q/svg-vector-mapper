<<<<<<< Updated upstream
# Thailand Interactive Map (Barebones Version)

## Overview
This project provides a barebones interactive map of Thailand, designed for visualizing and exploring hospital project locations. The main interface is a responsive HTML page with an inline SVG map, interactive hotspots, and smooth zoom/pan controls. The map is styled for clarity and ease of use, making it suitable as a foundation for more advanced mapping or data visualization projects.

## Features
- **Responsive SVG Map**: The map scales to fit any screen size, maintaining clarity and usability on both desktop and mobile devices.
- **Interactive Hotspots**: Clickable points (hotspots) are overlaid on the map to represent hospital projects or other locations. Hovering or clicking a hotspot displays a popup with details.
- **Zoom & Pan**: Hold Ctrl (or Cmd on Mac) and use the mouse wheel to zoom in/out, centered on the pointer. Drag to pan the map when zoomed in.
- **Customizable**: Easily add more hotspots or locations by editing the JavaScript section in the HTML file. Each hotspot can have its own label, coordinates, and popup content.
- **Clean, Modern UI**: The map is styled with a pale blue color scheme, subtle shadows, and card-based layout for a professional look.
- **No External Dependencies**: Only D3.js is loaded from CDN; all map data and logic are self-contained in the HTML file.
=======
# Interactive Map Projects
>>>>>>> Stashed changes

A lightweight, hash-routed web app for displaying interactive maps with project hotspots. Built with vanilla JavaScript and D3.js, runs entirely in the browser—no backend required.

<<<<<<< Updated upstream
## Usage

- **Run Locally:**
	- Make sure you have Python installed.
	- Start a simple HTTP server in this folder:
		- For Python 3: `python -m http.server`
	- Open your browser and go to: [http://localhost:8000/index.html](http://localhost:8000/index.html)

- **Explore the Map:**
	- Click hotspots for more information.
	- Zoom and pan using Ctrl+Wheel and drag.

- **Add More Locations:**
	- Edit the `hotspots` array in the JavaScript section of `index.html`.
	- Specify coordinates, labels, and popup content for each new hotspot.

- **Extend the Map:**
	- The SVG and code can be expanded for dynamic data, filtering, or API integration.

## Niche Features
- **Popup Smart Positioning:** Popups automatically reposition if they would go off the edge of the screen, so information is always visible.
- **Pointer-Centered Zoom:** Zooming is centered on the mouse pointer for intuitive navigation.
- **Responsive Hotspot Scaling:** Hotspot sizes and borders scale smoothly with the map, staying visible at any zoom level or screen size.
- **Keyboard/Touch Friendly:** Hotspots and map controls are designed to work with both mouse and touch input.

## Limitations
- This is a **barebones version**: it does not include a backend, persistent data storage, or advanced analytics. It is intended as a starting point for custom mapping projects.
- Only a subset of provinces and hotspots are included by default. You can expand the map by adding more SVG paths or hotspot entries.
=======
## Features

- **Multi-map support** – Add as many maps as you want using a simple catalog system
- **Hash-based routing** – Navigate between maps using URL hashes (e.g., `#thailand`)
- **Landing page** – Automatically generated card grid from your map catalog
- **Interactive hotspots** – Click to see project details with photos
- **Zoom & pan** – Ctrl/Cmd + scroll to zoom, drag to pan
- **Search** – Find provinces/regions with autocomplete suggestions
- **Responsive** – Works on desktop, tablet, and mobile

## Quick Start

1. **Start a local server:**
   ```bash
   python -m http.server
   ```

2. **Open in browser:**
   ```
   http://localhost:8000
   ```

3. **Navigate:**
   - Landing page shows all available maps
   - Click a card to view that map
   - Click "← All Maps" to return to landing

## Project Structure

```
├── index.html              # Main HTML file
├── /data
│   ├── catalog.js         # Map catalog and configuration
│   ├── main.js            # Core map logic and interactions
│   └── styles.css         # All styles
└── /images
    └── /thailand          # Map-specific assets
        ├── thailand.svg   # SVG map file
        ├── logo-02.png    # Logo image
        └── *.jpg          # Hotspot photos
```

## Adding a New Map

### 1. Prepare Your Assets

Create a folder in `/images/` for your map:
```
/images
  └── /vietnam
      ├── vietnam.svg
      ├── logo.png
      └── [hotspot photos].jpg
```

### 2. Add to Catalog

Open `data/catalog.js` and add a new entry:

```javascript
const MAP_CATALOG = {
    thailand: { /* existing entry */ },
    
    // Add your new map here
    vietnam: {
        title: 'Projects in Vietnam',
        svgUrl: 'images/vietnam/vietnam.svg',
        logoUrl: 'images/vietnam/logo.png',
        logoAlt: 'Company Logo',
        thumbnail: 'images/vietnam/vietnam.svg',
        description: 'Brief description for the landing card.',
        
        // Geographic bounds (must match SVG's mapsvg:geoViewBox)
        geoBounds: {
            minLon: 102.14,
            maxLat: 23.39,
            maxLon: 109.46,
            minLat: 8.56
        },
        
        // Color scheme (HSL values)
        colorConfig: {
            baseHue: 175,
            sat: '50%',
            minLight: 75,
            maxLight: 85
        },
        
        // Project locations
        hotspots: [
            {
                provinceId: 'VN-01',        // SVG path ID
                title: 'Hospital Name',
                description: 'Project details here.',
                x: 123.45,                  // SVG viewBox coordinates
                y: 678.90,
                imageUrl: 'images/vietnam/hospital.jpg'
            }
            // Add more hotspots...
        ]
    }
};
```

## SVG Map Requirements

Your SVG file should have:

1. **Province/region paths** with unique IDs:
   ```html
   <path id="TH-10" class="state" ... />
   <path id="VN-HN" class="state" ... />
   ```
>>>>>>> Stashed changes

2. **Optional: Geographic metadata** in the SVG root:
   ```html
   <svg mapsvg:geoViewBox="97.34,5.61,105.64,20.46" ...>
   ```

<<<<<<< Updated upstream
# geocode.py (Helper Script)

A simple Python script to geocode hospital addresses using OpenStreetMap's Nominatim API. It converts addresses to latitude/longitude and can append results to a local file for use in the map.

- **Usage**: Run `python geocode.py` to geocode predefined address groups. Use `--append` to append results to a local file (default: `coordinates.txt`). Change the output file with `--out <path>`.
- **Note**: This script is an optional helper to automate finding coordinates. By default it writes simple CSV lines (`lat,lon,label`) to the output file; edit `geocode.py` if you need a different format.
=======
3. **Optional: Province names** as attributes:
   ```html
   <path id="TH-10" data-name="Bangkok" ... />
   ```

## Configuration Tips

### Hotspot Coordinates

Hotspot `x` and `y` values use SVG viewBox units. To find coordinates:
1. Open your SVG in a browser
2. Open browser console
3. Click where you want the hotspot
4. Run: `document.querySelector('svg').addEventListener('click', e => console.log(e.offsetX, e.offsetY))`

### Color Schemes

Each map can have its own color palette defined in `colorConfig`:
- `baseHue`: 0-360 (e.g., 175 for blue-green, 200 for blue)
- `sat`: Saturation percentage
- `minLight` / `maxLight`: Lightness range for province shading

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Requires JavaScript enabled
- No Internet Explorer support

## Dependencies

- **D3.js v7** – Loaded from CDN for SVG manipulation and interactions
- No build tools or npm required

## License

## License

The source code in this repository is licensed under the MIT License.
See the `LICENSE` file for details.

### Assets / Images

All images, artwork, and other visual assets included in this repository
are **NOT** covered by the MIT License.

All rights to these assets are reserved. They may not be used, copied,
modified, or redistributed without explicit written permission from the
copyright holder.
>>>>>>> Stashed changes
