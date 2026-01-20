// Runtime probe removed
// Global error handlers — log errors to the console
window.addEventListener('error', function(ev){ try{ console.error('map:error', ev.message || ev.error || ev); }catch(e){} });
window.addEventListener('unhandledrejection', function(ev){ try{ console.error('map:unhandledrejection', ev.reason || ev); }catch(e){} });
// Use inline SVG (avoids XHR/file:// restrictions)
const svg = d3.select('#map').select('svg');

// Let CSS and the viewBox control SVG sizing (responsive)

// Tooltip for states
const tooltip = d3.select('body').append('div').attr('class', 'tooltip');

// Select state shapes (paths, polygons, groups) and compute fills.
const states = svg.selectAll('path, polygon, g[id]');
// Single-hue shading (HSL) computed per state.
const stateCount = states.size();
// base color derived from #B9E8E4 (approx HSL)
const baseHue = 175;
const sat = '50%';
// Widen lightness range to increase contrast between adjacent states
const minLight = 75; // Conservative: darker darkest areas
const maxLight = 85; // Conservative: slightly lighter highlights
// Helper: deterministic per-state jitter (hue deg, sat %, light %)
function computeJitter(i){
    // deterministic hashes chosen to spread values with small periods
    const hueJ = ((i * 97) % 21) - 10;   // -10 .. +10 degrees
    const satJ = ((i * 67) % 11) - 5;    // -5 .. +5 percent
    const lightJ = ((i * 53) % 5) - 2;   // -2 .. +2 percent
    return {hueJ, satJ, lightJ};
}
// read geoViewBox for lon/lat mapping: mapsvg:geoViewBox = minLon maxLat maxLon minLat
const geoAttr = svg.attr('mapsvg:geoViewBox') || (svg.node() && svg.node().getAttribute('mapsvg:geoViewBox'));
const vbArr = (svg.attr('viewBox') || svg.attr('viewbox') || '0 0 1 1').split(/\s+/).map(Number);
const vbW = vbArr[2] || +svg.attr('width') || 1;
const vbH = vbArr[3] || +svg.attr('height') || 1;
let geo = null;
if (geoAttr) {
    const parts = geoAttr.trim().split(/\s+/).map(Number);
    if (parts.length === 4 && parts.every(n => !Number.isNaN(n))) {
        geo = { minLon: parts[0], maxLat: parts[1], maxLon: parts[2], minLat: parts[3] };
        geo.latSpan = geo.maxLat - geo.minLat;
    }
}

// Add a `state` class and store the display name from the `title` attribute
states
    .classed('state', true)
    .each(function() {
        // Prefer `title` attribute, then child <title>, then id
        const attrTitle = this.getAttribute && this.getAttribute('title');
        let childTitle = '';
        try { if (this.querySelector) { const t = this.querySelector('title'); childTitle = t ? t.textContent : ''; } } catch(e){}
        const name = attrTitle || childTitle || this.id || '';
        this.setAttribute('data-name', name);
    })
    // compute a shade for each state — use geographic latitude as a simple elevation proxy
    .each(function(d, i) {
        const el = d3.select(this);
        // default fall-back: spread by index if no geo info
        if (!geo) {
            const t = stateCount > 1 ? (i / (stateCount - 1)) : 0;
            const j = computeJitter(i);
            const hue = baseHue + j.hueJ;
            const satNum = parseFloat(sat) || 50;
            const satVal = Math.max(20, Math.min(80, Math.round(satNum + j.satJ))) + '%';
            const light = Math.round(minLight + (maxLight - minLight) * t + j.lightJ);
            el.style('fill', `hsl(${hue} ${satVal} ${light}%)`);
            return;
        }

        // compute element centroid in viewBox units
        let cx = 0, cy = 0;
        try {
            const bb = this.getBBox();
            cx = bb.x + bb.width / 2;
            cy = bb.y + bb.height / 2;
        } catch (e) {
            // fallback to index-based if getBBox fails
            const t = stateCount > 1 ? (i / (stateCount - 1)) : 0;
            const j = computeJitter(i);
            const hue = baseHue + j.hueJ;
            const satNum = parseFloat(sat) || 50;
            const satVal = Math.max(20, Math.min(80, Math.round(satNum + j.satJ))) + '%';
            const light = Math.round(minLight + (maxLight - minLight) * t + j.lightJ);
            el.style('fill', `hsl(${hue} ${satVal} ${light}%)`);
            return;
        }

        // map centroid y -> latitude using geoViewBox mapping
        const latSpan = geo.latSpan || 1;
        const lat = geo.maxLat - (cy * (latSpan / vbH));
        // normalized score: 0 = lowest lat (south), 1 = highest lat (north)
        let score = (lat - geo.minLat) / (latSpan || 1);
        score = Math.max(0, Math.min(1, score));
        // emphasize higher values slightly (mild non-linearity)
        score = Math.pow(score, 1.35);

        // add a tiny deterministic hue jitter per state to break adjacent sameness
        const jitter = ((i * 37) % 9) - 4; // ±4° by index
        const hue = baseHue + jitter;

        // higher score -> darker (lower lightness)
        const light = Math.round(maxLight - score * (maxLight - minLight));
        el.style('fill', `hsl(${hue} ${sat} ${light}%)`);
    })
    .on('mouseover', function(event) {
        const name = this.getAttribute('data-name') || this.id;
        const el = d3.select(this);
        // bring hovered state to front
        try { el.raise(); } catch(e) {}
        // ensure hotspots layer remains on top
        try { svg.select('#hotspots-layer').raise(); } catch(e) {}
        // save prior stroke so we can restore it on mouseout
        if (!this.hasAttribute('data-prev-stroke')) {
            this.setAttribute('data-prev-stroke', this.getAttribute('stroke') || '');
            this.setAttribute('data-prev-stroke-width', this.getAttribute('stroke-width') || '');
        }
        el.attr('stroke', '#000').attr('stroke-width', 1.2).style('vector-effect', 'non-scaling-stroke');
        tooltip.style('opacity', 1).html(name);
        el.style('opacity', 0.8);
    })
    .on('mousemove', function(event) {
        tooltip.style('left', (event.pageX + 10) + 'px').style('top', (event.pageY - 10) + 'px');
    })
    .on('mouseout', function() {
        const el = d3.select(this);
        tooltip.style('opacity', 0);
        el.style('opacity', null);
        // restore previous stroke values
        const prev = this.getAttribute('data-prev-stroke');
        const prevW = this.getAttribute('data-prev-stroke-width');
        if (prev !== null) {
            if (prev === '') el.attr('stroke', null); else el.attr('stroke', prev);
        }
        if (prevW !== null) {
            if (prevW === '') el.attr('stroke-width', null); else el.attr('stroke-width', prevW);
        }
        el.style('vector-effect', null);
        // re-raise hotspots layer so hotspots stay visually above states
        try { svg.select('#hotspots-layer').raise(); } catch(e) {}
    });

// Hotspots: predefined points with metadata
const popup = d3.select('body').append('div').attr('class', 'popup');
// popup structure: content container (no close button or auto-close handlers)
popup.append('div').attr('class', 'popup-content');

let hotspots = [
    {
        provinceId: 'TH-41', // Udon Thani
        title: 'Kumphawapi Hospital',
        description: '180-bed hospital. Saikang supplied hospital beds, bedside tables and overbed tables for new wards.',
        x: 382.822,
        y: 231.766,
        imageUrl: 'rsc/udon_thani.jpg'
    },
    {
        provinceId: 'TH-36', // Chaiyaphum
        title: 'Kaengkhro Hospital',
        description: 'Public hospital with 300 beds. Saikang electric beds provide safety and comfort for patients.',
        x: 331.438,
        y: 300.624,
        imageUrl: 'rsc/chaiyaphum.jpg'
    },
    {
        provinceId: 'TH-10', // Bangkok 1
        title: 'King Chulalongkorn Memorial Hospital',
        description: 'Public general and tertiary referral hospital with 1,435 beds. Saikang supplied medical trolleys to support clinical operations.',
        x: 215.263,
        y: 464.452,
        imageUrl: 'rsc/bangkok_chu.jpg'
    },
    {
        provinceId: 'TH-10', // Bangkok 2
        title: 'The Blessing Nursing Home & Rehab',
        description: 'Nursing home and rehabilitation center using Saikang electric beds to ensure daily safety and care for the elderly.',
        x: 225,
        y: 467,
        imageUrl: 'rsc/bangkok_bless.jpg'
    },
    {
        provinceId: 'TH-81', // Krabi
        title: 'Khlong Thom Hospital',
        description: 'Multispecialty hospital using Saikang electric beds and accessories to support patient care.',
        x: 130,
        y: 870,
        imageUrl: 'rsc/krabi.jpg'
    }
];

// Hotspot sizing globals
let hotspotBaseRadiusVB = null;
let hotspotBaseStrokeVB = null; // legacy: viewBox units (kept for reference)
let hotspotBaseStrokePx = null; // base stroke in screen pixels (preferred)
let hotspotFullVBWidth = vbW || 1;
// State border base stroke (viewBox units) so borders can scale/dampen like hotspots
let stateBaseStrokeVB = null;

// Helper to create hotspots; accepts optional whitelist array (IDs) or null for all.
function createHotspots(whitelist) {
    svg.selectAll('.hotspot-group').remove();
    const filtered = whitelist ? hotspots.filter(h => whitelist.includes(h.provinceId)) : hotspots;

    // Use the initial viewBox width (vbW) as the baseline so radius in viewBox units
    // remains constant and therefore scales with viewBox zoom.
    const dispWidth = svg.node().getBoundingClientRect().width || 1;
    const initialVBWidth = vbW || 1; // vbW defined earlier from the SVG's viewBox

    // desired on-screen radius in pixels at original scale
    const desiredPx = 6.5;
    // convert desired px at original scale into viewBox units (constant)
    const baseRadiusVB = desiredPx * (initialVBWidth / dispWidth);

    // stroke width in screen pixels (adjust for desired border thickness)
    const strokePx = 0.7;
    const baseStrokeVB = strokePx * (initialVBWidth / dispWidth);

    // radii are set in viewBox units so circles scale with viewBox.
    // stroke is applied in screen pixels so it remains visually consistent while radii scale.

    // store base values
    hotspotBaseRadiusVB = baseRadiusVB;
    hotspotBaseStrokeVB = baseStrokeVB; // legacy
    hotspotBaseStrokePx = strokePx; // canonical px value used for styling
    hotspotFullVBWidth = initialVBWidth;

    // ensure a dedicated hotspots layer exists at the end of the SVG
    let layer = svg.select('#hotspots-layer');
    if (layer.empty()) layer = svg.append('g').attr('id', 'hotspots-layer');

    // popup positioning state to reduce jitter and avoid rapid DOM thrash
    // single shared state because `popup` is a single element reused for all hotspots
    let popupPosState = { raf: null, lastVert: null, lastHoriz: null, lastX: 0, lastY: 0 };

    filtered.forEach(h => {
        const group = layer.append('g').attr('class', 'hotspot-group');

        group.append('circle')
            .attr('cx', h.x)
            .attr('cy', h.y)
            // use base viewBox radius so circle scales visually with zoom
            .attr('r', baseRadiusVB)
            .attr('class', 'hotspot')
            .attr('stroke', '#d7263d')
            .style('stroke-width', strokePx + 'px')
            .style('fill', 'rgba(215,38,61,0.65)')
            .on('mouseover', function(event) {
                const imgHtml = h.imageUrl ? `<img src="${h.imageUrl}" alt="${h.title}">` : '';
                popup.select('.popup-content').html(imgHtml + `<strong>${h.title}</strong><br><p>${h.description}</p>`);
                popup.classed('open', true);
                // animate image fade-in when present (handles cached images too)
                const img = popup.select('.popup-content').select('img');
                if (!img.empty()) {
                    img.style('opacity', 0).style('transform', 'translateY(6px)');
                    const node = img.node();
                    if (node && node.complete) {
                        img.style('opacity', 1).style('transform', 'translateY(0)');
                    } else {
                        img.on('load', function() { d3.select(this).style('opacity', 1).style('transform', 'translateY(0)'); });
                    }
                }
            })
            .on('mousemove', function(event) {
                try {
                    // debounce position updates via requestAnimationFrame to avoid layout thrash
                    if (popupPosState.raf) cancelAnimationFrame(popupPosState.raf);
                    popupPosState.raf = requestAnimationFrame(() => {
                        const pad = 8; // small gap between cursor and popup
                        const px = event.pageX;
                        const py = event.pageY;
                        const node = popup.node();
                        // measure popup reliably
                        const rect = node.getBoundingClientRect();
                        const pw = rect.width || 200;
                        const ph = rect.height || 100;
                        const vpLeft = window.scrollX || window.pageXOffset;
                        const vpTop = window.scrollY || window.pageYOffset;
                        const vpRight = vpLeft + window.innerWidth;
                        const vpBottom = vpTop + window.innerHeight;

                        // availability checks with small hysteresis margins
                        const canAbove = (py - pad - ph) >= (vpTop + pad + 6);
                        const canBelow = (py + pad + ph) <= (vpBottom - pad - 6);
                        const canRight = (px + pad + pw) <= (vpRight - pad - 6);
                        const canLeft = (px - pad - pw) >= (vpLeft + pad + 6);

                        // choose vertical position (prefer above); keep previous choice when ambiguous
                        let vert;
                        if (canAbove) vert = 'above';
                        else if (canBelow) vert = 'below';
                        else vert = popupPosState.lastVert || 'above';

                        // choose horizontal position (prefer right)
                        let horiz;
                        if (canRight) horiz = 'right';
                        else if (canLeft) horiz = 'left';
                        else horiz = popupPosState.lastHoriz || 'right';

                        let top = (vert === 'above') ? (py - pad - ph) : (py + pad);
                        let left = (horiz === 'right') ? (px + pad) : (px - pad - pw);

                        // final clamps to viewport
                        if (left < vpLeft + pad) left = vpLeft + pad;
                        if (left + pw > vpRight - pad) left = Math.max(vpLeft + pad, vpRight - pw - pad);
                        if (top < vpTop + pad) top = vpTop + pad;
                        if (top + ph > vpBottom - pad) top = Math.max(vpTop + pad, vpBottom - ph - pad);

                        popup.style('left', Math.round(left) + 'px').style('top', Math.round(top) + 'px');
                        popupPosState.lastVert = vert;
                        popupPosState.lastHoriz = horiz;
                        popupPosState.lastX = px;
                        popupPosState.lastY = py;
                        popupPosState.raf = null;
                    });
                } catch (e) {
                    // fallback to simple positioning
                    popup.style('left', (event.pageX + 10) + 'px').style('top', (event.pageY - 10) + 'px');
                }
            })
            .on('mouseout', function() {
                popup.classed('open', false);
            });
    });

    // Ensure the hotspots layer is the last child so it renders on top
    try { svg.select('#hotspots-layer').raise(); } catch (e) {}
}

// recompute hotspots sizes on window resize so the base VB radius is accurate
window.addEventListener('resize', () => { createHotspots(null); setTimeout(adjustHotspots,0); });


// adjustHotspots(): recalc and apply r/stroke-width based on current viewBox
function adjustHotspots() {
    if (!hotspotBaseRadiusVB || !hotspotBaseStrokeVB) return;

    // Prefer reading the live SVG viewBox from the element (more reliable),
    // fallback to the attribute string if necessary.
    let curVBWidth = hotspotFullVBWidth;
    try {
        const el = svg.node();
        if (el && el.viewBox && el.viewBox.baseVal && el.viewBox.baseVal.width) {
            curVBWidth = el.viewBox.baseVal.width;
        } else {
            const vbCur = (svg.attr('viewBox') || '').split(/\s+/).map(Number);
            curVBWidth = vbCur[2] || hotspotFullVBWidth;
        }
    } catch (e) {
        curVBWidth = hotspotFullVBWidth;
    }
    // When zooming in, curVBWidth becomes smaller; use cur/full so radius
    // decreases as you zoom in (scale < 1 when zoomed in).
    const scaleFactor = curVBWidth / hotspotFullVBWidth;
    // Damping: reduce sensitivity so hotspots change size more slowly (0..1)
    const hotspotDamping = 0.9; // 0.0 = no change, 1.0 = full change
    const adjusted = 1 - (1 - scaleFactor) * hotspotDamping;

    const newR = hotspotBaseRadiusVB * adjusted;
    const newStrokePx = (hotspotBaseStrokePx || 1.5) * adjusted;

    svg.selectAll('.hotspot').attr('r', newR).style('stroke-width', newStrokePx + 'px');
    // also adjust state border stroke to shrink when zooming in
    if (stateBaseStrokeVB) {
        // use a stronger damping for state borders so they become thinner on zoom
        const stateDamping = 0.8; // 0..1, higher -> more shrink
        const adjustedState = 1 - (1 - scaleFactor) * stateDamping;
        const newStateStroke = stateBaseStrokeVB * adjustedState;
        svg.selectAll('.state').attr('stroke-width', newStateStroke).style('stroke-width', newStateStroke + 'px');
        // no console logging here
    }
}

// Create hotspots after layout so the displayed SVG size is available
// (compute radii in viewBox units from the current display width)
setTimeout(() => { createHotspots(null); setTimeout(adjustHotspots,0);
    // compute base state stroke in viewBox units if not set
        if (stateBaseStrokeVB === null) {
        const dispWidth = svg.node().getBoundingClientRect().width || 1;
        const initialVBWidth = vbW || 1;
        const desiredStateStrokePx = 0.9; // desired on-screen stroke in px at original scale
        stateBaseStrokeVB = desiredStateStrokePx * (initialVBWidth / dispWidth);
    }
}, 50);
// re-create on full load too (ensures correct sizing when CSS/layout finishes)
window.addEventListener('load', () => setTimeout(() => { createHotspots(null); setTimeout(adjustHotspots,0);
    if (stateBaseStrokeVB === null) {
        const dispWidth = svg.node().getBoundingClientRect().width || 1;
        const initialVBWidth = vbW || 1;
        const desiredStateStrokePx = 0.9; // standardized to match initial desired thickness
        stateBaseStrokeVB = desiredStateStrokePx * (initialVBWidth / dispWidth);
    }
}, 50));

// sanity check: ensure adjustHotspots runs after load
setTimeout(() => { try { adjustHotspots(); } catch(e){} }, 200);

// Ctrl+Wheel zoom (hold Ctrl/Meta) — update the SVG viewBox centered at the pointer
(function(){
    const svgEl = svg.node();
    if (!svgEl) return;
    // parse or initialize viewBox
    let vb = (svg.attr('viewBox') || '').split(/\s+/).map(Number);
    if (vb.length < 4) vb = [0, 0, +svg.attr('width') || svgEl.viewBox.baseVal.width, +svg.attr('height') || svgEl.viewBox.baseVal.height];
    const initial = { w: vb[2], h: vb[3] };
    const minScale = 1; // don't allow zooming out beyond the original viewBox (1×)
    const maxScale = 10;  // maximum zoom-in (1000% of initial)

    function clientToSvgPoint(evt){
        const pt = svgEl.createSVGPoint();
        pt.x = evt.clientX; pt.y = evt.clientY;
        return pt.matrixTransform(svgEl.getScreenCTM().inverse());
    }

    // shared wheel handler used by the SVG element and a window-level fallback
    function doWheel(e){
        if (e.defaultPrevented) return; // another handler already handled it
        // accept Ctrl (Windows/Linux) or Meta (macOS) as the modifier
        if (!(e.ctrlKey || e.metaKey)) return;
        e.preventDefault();

        // wheel: positive deltaY -> scroll down -> zoom out
        const zoomOut = e.deltaY > 0;
        const factor = zoomOut ? 1.12 : 0.88; // adjust speed

        const p = clientToSvgPoint(e);

        const [vx, vy, vw, vh] = vb;
        const newW = vw * factor;
        const newH = vh * factor;

        // clamp scale relative to initial viewBox
        const newScale = initial.w / newW;
        // if attempting to zoom out past original, reset to the original full viewBox
        if (newScale <= minScale + 1e-9) {
            vb = fullVB.slice();
            svg.attr('viewBox', vb.join(' '));
            setTimeout(adjustHotspots,0);
            return;
        }
        if (newScale > maxScale) return;

        const newX = p.x - (p.x - vx) * factor;
        const newY = p.y - (p.y - vy) * factor;

        vb = [newX, newY, newW, newH];
        // clamp to full bounds so we don't keep offsets when at near-original scale
        vb = clampToFull(vb);
        svg.attr('viewBox', vb.join(' '));
        setTimeout(adjustHotspots,0);
    }

    svgEl.addEventListener('wheel', doWheel, { passive: false });

    // Fallback: if an overlay or other element prevents the SVG from receiving wheel
    // events, listen at the window level but restrict to events whose pointer is
    // currently over the `.map-card` container to avoid global interception.
    window.addEventListener('wheel', function(e){
        if (e.defaultPrevented) return;
        if (!(e.ctrlKey || e.metaKey)) return;
        const target = document.elementFromPoint(e.clientX, e.clientY);
        if (!target) return;
        const mapCard = document.querySelector('.map-card');
        if (!mapCard) return;
        if (!mapCard.contains(target)) return;
        doWheel(e);
    }, { passive: false });

    // Capture-phase fallback: try to intercept the wheel event before any
    // overlay can stop it. Still restrict to modifier key and map area.
    window.addEventListener('wheel', function(e){
        try{
            if (e.defaultPrevented) return;
            if (!(e.ctrlKey || e.metaKey)) return;
            const mapCard = document.querySelector('.map-card');
            if (!mapCard) return;
            const target = document.elementFromPoint(e.clientX, e.clientY);
            if (!target) return;
            if (!mapCard.contains(target)) return;
            doWheel(e);
        }catch(err){}
    }, { passive: false, capture: true });

    // Toggle temporary CSS class while the modifier is held so overlays
    // won't block wheel events. This helps when `.popup` or `#map-controls`
    // sit above the SVG and intercept pointer events.
    function setMapInteractionActive(active){
        try{
            if (active) document.documentElement.classList.add('map-interaction-active');
            else document.documentElement.classList.remove('map-interaction-active');
        }catch(e){}
    }

    // Key handlers — respond to Control (Windows/Linux) and Meta (macOS)
    window.addEventListener('keydown', function(e){
        if (e.key === 'Control' || e.key === 'Meta') setMapInteractionActive(true);
    }, { passive: true });
    window.addEventListener('keyup', function(e){
        if (e.key === 'Control' || e.key === 'Meta') setMapInteractionActive(false);
    }, { passive: true });
    // Defensive cleanup when focus changes
    window.addEventListener('blur', function(){ setMapInteractionActive(false); }, { passive: true });

    // Panning without inertia, stable pixel->viewBox mapping and edge clamping
    let isPanning = false;
    let startClient = null;
    let vbStart = null;

    // full (original) viewBox — used for clamping
    const fullVB = vb.slice();

    function clampToFull(vbArr){
        const [fx, fy, fw, fh] = fullVB;
        let [x, y, w, h] = vbArr;
        if (w >= fw) x = fx + (fw - w) / 2;
        else x = Math.max(Math.min(x, fx + fw - w), fx);
        if (h >= fh) y = fy + (fh - h) / 2;
        else y = Math.max(Math.min(y, fy + fh - h), fy);
        return [x, y, w, h];
    }

    function setCursorDragging(dragging){
        try { svgEl.style.cursor = dragging ? 'grabbing' : 'grab'; } catch(e){}
    }

    svgEl.addEventListener('mousedown', function(e){
        // left button only, ignore when Ctrl is held (used for zoom)
        if (e.button !== 0 || e.ctrlKey) return;
        
        e.preventDefault();
        isPanning = true;
        startClient = { x: e.clientX, y: e.clientY };
        vbStart = vb.slice();
        setCursorDragging(true);
    });

    window.addEventListener('mousemove', function(e){
        if (!isPanning) return;
        const rect = svgEl.getBoundingClientRect();
        const dxPx = e.clientX - startClient.x;
        const dyPx = e.clientY - startClient.y;
        const scaleX = vbStart[2] / rect.width;
        const scaleY = vbStart[3] / rect.height;
        const dx = dxPx * scaleX;
        const dy = dyPx * scaleY;
        let newX = vbStart[0] - dx;
        let newY = vbStart[1] - dy;
        let clamped = clampToFull([newX, newY, vbStart[2], vbStart[3]]);
        vb = [clamped[0], clamped[1], clamped[2], clamped[3]];
        svg.attr('viewBox', vb.join(' '));
        setTimeout(adjustHotspots,0);
    });

    window.addEventListener('mouseup', function(e){
        if (!isPanning) return;
        isPanning = false;
        startClient = null;
        vbStart = null;
        setCursorDragging(false);
    });

    // set initial cursor
    setCursorDragging(false);

})();
