// Extracted from inline script in index.html
// Runtime probe removed
// Log errors and unhandled promise rejections to the console
window.addEventListener('error', function(ev){ try{ console.error('map:error', ev.message || ev.error || ev); }catch(e){} });
window.addEventListener('unhandledrejection', function(ev){ try{ console.error('map:unhandledrejection', ev.reason || ev); }catch(e){} });
// Use inline SVG to avoid browser restrictions with file loading
const svg = d3.select('#map').select('svg');

// SVG sizing is handled by CSS and viewBox for responsiveness

// Tooltip element for showing state names on hover
const tooltip = d3.select('body').append('div').attr('class', 'tooltip');

// Select all state shapes and set up their fill colors
const states = svg.selectAll('path, polygon, g[id]');
// Use HSL color shading for each state
const stateCount = states.size();
// Base color is similar to #B9E8E4 in HSL
const baseHue = 175;
const sat = '50%';
// Increase lightness range for better contrast between states
const minLight = 75; // Conservative: darker darkest areas
const maxLight = 85; // Conservative: slightly lighter highlights
// Helper function: adds a bit of color variation for each state
function computeJitter(i){
    const hueJ = ((i * 97) % 21) - 10;
    const satJ = ((i * 67) % 11) - 5;
    const lightJ = ((i * 53) % 5) - 2;
    return {hueJ, satJ, lightJ};
}
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

states
    .classed('state', true)
    .each(function() {
        const attrTitle = this.getAttribute && this.getAttribute('title');
        let childTitle = '';
        try { if (this.querySelector) { const t = this.querySelector('title'); childTitle = t ? t.textContent : ''; } } catch(e){}
        const name = attrTitle || childTitle || this.id || '';
        this.setAttribute('data-name', name);
    })
    .each(function(d, i) {
        const el = d3.select(this);
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

        let cx = 0, cy = 0;
        try {
            const bb = this.getBBox();
            cx = bb.x + bb.width / 2;
            cy = bb.y + bb.height / 2;
        } catch (e) {
            const t = stateCount > 1 ? (i / (stateCount - 1)) : 0;
            const j = computeJitter(i);
            const hue = baseHue + j.hueJ;
            const satNum = parseFloat(sat) || 50;
            const satVal = Math.max(20, Math.min(80, Math.round(satNum + j.satJ))) + '%';
            const light = Math.round(minLight + (maxLight - minLight) * t + j.lightJ);
            el.style('fill', `hsl(${hue} ${satVal} ${light}%)`);
            return;
        }

        const latSpan = geo.latSpan || 1;
        const lat = geo.maxLat - (cy * (latSpan / vbH));
        let score = (lat - geo.minLat) / (latSpan || 1);
        score = Math.max(0, Math.min(1, score));
        score = Math.pow(score, 1.35);

        const jitter = ((i * 37) % 9) - 4;
        const hue = baseHue + jitter;

        const light = Math.round(maxLight - score * (maxLight - minLight));
        el.style('fill', `hsl(${hue} ${sat} ${light}%)`);
    })
    .on('mouseover', function(event) {
        const name = this.getAttribute('data-name') || this.id;
        const el = d3.select(this);
        // If this element is currently the active (selected) state, do not let hover mutate its stroke
        try { if (this.classList && this.classList.contains && this.classList.contains('state--active')) { tooltip.style('opacity',1).html(name); return; } } catch(e) {}
        try { el.raise(); } catch(e) {}
        // Keep the active-state-layer above states, then keep hotspots on top
        try { svg.select('#active-state-layer').raise(); } catch(e) {}
        try { svg.select('#hotspots-layer').raise(); } catch(e) {}
        if (!this.hasAttribute('data-prev-stroke')) {
            this.setAttribute('data-prev-stroke', this.getAttribute('stroke') || '');
            this.setAttribute('data-prev-stroke-width', this.getAttribute('stroke-width') || '');
        }
        el.attr('stroke', '#000').attr('stroke-width', 1.2).style('vector-effect', 'non-scaling-stroke');
        tooltip.style('opacity', 1).html(name);
        el.style('opacity', 0.8);
    })
    .on('mousemove', function(event) {
        // Position tooltip using transform (GPU-friendly) to avoid layout thrash
        try {
            const x = Math.round(event.pageX + 10);
            const y = Math.round(event.pageY - 10);
            tooltip.style('transform', `translate3d(${x}px, ${y}px, 0)`);
        } catch (e) {
            tooltip.style('transform', `translate3d(${event.pageX + 10}px, ${event.pageY - 10}px, 0)`);
        }
    })
    .on('mouseout', function() {
        const el = d3.select(this);
        tooltip.style('opacity', 0);
        el.style('opacity', null);
        const prev = this.getAttribute('data-prev-stroke');
        const prevW = this.getAttribute('data-prev-stroke-width');
        if (prev !== null) {
            if (prev === '') el.attr('stroke', null); else el.attr('stroke', prev);
        }
        if (prevW !== null) {
            if (prevW === '') el.attr('stroke-width', null); else el.attr('stroke-width', prevW);
        }
        el.style('vector-effect', null);
        try { svg.select('#active-state-layer').raise(); } catch(e) {}
        try { svg.select('#hotspots-layer').raise(); } catch(e) {}
    });

const popup = d3.select('body').append('div').attr('class', 'popup');
popup.append('div').attr('class', 'popup-content');

// Keep track of the currently active hotspot
let activeHotspot = null;

// Hide popup when mouse leaves the popup area
try { popup.on('mouseleave', function() { popup.classed('open', false); activeHotspot = null; }); } catch(e) {}

// Use transform and requestAnimationFrame for smooth popup positioning
const popupNode = popup.node();
let popupPending = false;
let popupLastEvent = null;
let popupRectCached = null;
function svgPointToClient(x, y) {
    try {
        const svgEl = svg.node();
        if (!svgEl || !svgEl.createSVGPoint) return null;
        const pt = svgEl.createSVGPoint();
        pt.x = x; pt.y = y;
        const screen = pt.matrixTransform(svgEl.getScreenCTM());
        const clientX = screen.x;
        const clientY = screen.y;
        const pageX = clientX + (window.scrollX || window.pageXOffset || 0);
        const pageY = clientY + (window.scrollY || window.pageYOffset || 0);
        return { pageX, pageY, clientX, clientY };
    } catch (e) { return null; }
}
function schedulePopupPosition() {
    if (popupPending) return;
    popupPending = true;
    requestAnimationFrame(() => {
        try {
            updatePopupPosition(popupLastEvent);
        } catch (e) {}
        popupPending = false;
    });
}
function updatePopupPosition(event) {
    if (!event) return;
    try {
        const pad = 8;
        // If popup is fixed (mobile), use viewport coordinates (clientX/Y); otherwise use page coords
        const isFixed = window.getComputedStyle && window.getComputedStyle(popup.node()).position === 'fixed';
        const px = isFixed ? (event.clientX || (event.pageX - (window.scrollX||0))) : (event.pageX || (event.clientX + (window.scrollX||0)));
        const py = isFixed ? (event.clientY || (event.pageY - (window.scrollY||0))) : (event.pageY || (event.clientY + (window.scrollY||0)));
        const node = popup.node();
        // Cache the measured rect to avoid repeated layout reads; invalidate when content changes
        if (!popupRectCached) {
            try { popupRectCached = node.getBoundingClientRect(); } catch (e) { popupRectCached = null; }
        }
        const pw = (popupRectCached && popupRectCached.width) || (node && node.offsetWidth) || 200;
        const ph = (popupRectCached && popupRectCached.height) || (node && node.offsetHeight) || 100;
        const vpLeft = isFixed ? 0 : (window.scrollX || window.pageXOffset);
        const vpTop = isFixed ? 0 : (window.scrollY || window.pageYOffset);
        const vpRight = vpLeft + window.innerWidth;
        const vpBottom = vpTop + window.innerHeight;

        const leftRight = px + pad;
        const leftLeft = px - pad - pw;
        const rightSpace = vpRight - (px + pad);
        const leftSpace = (px - pad) - vpLeft;

        let left;
        if (rightSpace >= pw && leftSpace >= pw) {
            left = (rightSpace >= leftSpace) ? leftRight : leftLeft;
        } else if (rightSpace >= pw) {
            left = leftRight;
        } else if (leftSpace >= pw) {
            left = leftLeft;
        } else {
            left = (rightSpace >= leftSpace) ? leftRight : leftLeft;
        }
        if (left < vpLeft + pad) left = vpLeft + pad;
        if (left + pw > vpRight - pad) left = vpRight - pw - pad;

        let top = py - pad - ph;
        if (top < vpTop + pad) top = py + pad;
        if (top + ph > vpBottom - pad) top = Math.max(vpTop + pad, vpBottom - ph - pad);

        const finalLeft = Math.round(left);
        const finalTop = Math.round(top);
        // Set CSS variables for translation so the CSS can manage scale transitions
        if (popup.node()) {
            try {
                popup.node().style.setProperty('--popup-left', finalLeft + 'px');
                popup.node().style.setProperty('--popup-top', finalTop + 'px');
            } catch (e) {
                // fallback to inline transform if CSS variables unsupported
                popup.node().style.transform = `translate3d(${finalLeft}px, ${finalTop}px, 0)` + (popup.classed('open') ? ' scale(1)' : ' scale(.98)');
            }
        }
    } catch (e) {
        if (popup.node()) {
            try {
                popup.node().style.setProperty('--popup-left', (event.pageX + 10) + 'px');
                popup.node().style.setProperty('--popup-top', (event.pageY - 10) + 'px');
            } catch (err) {
                popup.node().style.transform = `translate3d(${event.pageX + 10}px, ${event.pageY - 10}px, 0)`;
            }
        }
    }
}

// Reposition popup when scrolling or resizing the window
window.addEventListener('scroll', function(){
    if (!popup.classed('open')) return;
    // reuse last mouse event if available
    popupLastEvent = popupLastEvent || { pageX: window.scrollX + 20, pageY: window.scrollY + 20, clientX: 20, clientY: 20 };
    popupRectCached = null;
    schedulePopupPosition();
}, { passive: true });
window.addEventListener('resize', function(){
    if (!popup.classed('open')) return;
    popupLastEvent = popupLastEvent || { pageX: window.scrollX + 20, pageY: window.scrollY + 20, clientX: 20, clientY: 20 };
    popupRectCached = null;
    schedulePopupPosition();
}, { passive: true });

let hotspots = [
    {
        provinceId: 'TH-41',
        title: 'Kumphawapi Hospital',
        description: '180-bed hospital. Saikang supplied hospital beds, bedside tables and overbed tables for new wards.',
        x: 382.822,
        y: 231.766,
        imageUrl: 'rsc/udon_thani.jpg'
    },
    {
        provinceId: 'TH-36',
        title: 'Kaengkhro Hospital',
        description: 'Public hospital with 300 beds. Saikang electric beds provide safety and comfort for patients.',
        x: 331.438,
        y: 300.624,
        imageUrl: 'rsc/chaiyaphum.jpg'
    },
    {
        provinceId: 'TH-10',
        title: 'King Chulalongkorn Memorial Hospital',
        description: 'Public general and tertiary referral hospital with 1,435 beds. Saikang supplied medical trolleys to support clinical operations.',
        x: 215.263,
        y: 464.452,
        imageUrl: 'rsc/bangkok_chu.jpg'
    },
    {
        provinceId: 'TH-10',
        title: 'The Blessing Nursing Home & Rehab',
        description: 'Nursing home and rehabilitation center using Saikang electric beds to ensure daily safety and care for the elderly.',
        x: 225,
        y: 467,
        imageUrl: 'rsc/bangkok_bless.jpg'
    },
    {
        provinceId: 'TH-81',
        title: 'Khlong Thom Hospital',
        description: 'Multispecialty hospital using Saikang electric beds and accessories to support patient care.',
        x: 130,
        y: 870,
        imageUrl: 'rsc/krabi.jpg'
    }
];

let hotspotBaseRadiusVB = null;
let hotspotBaseStrokeVB = null;
let hotspotBaseStrokePx = null;
let hotspotFullVBWidth = vbW || 1;
let stateBaseStrokeVB = null;

function createHotspots(whitelist) {
    svg.selectAll('.hotspot-group').remove();
    const filtered = whitelist ? hotspots.filter(h => whitelist.includes(h.provinceId)) : hotspots;
    const dispWidth = svg.node().getBoundingClientRect().width || 1;
    const initialVBWidth = vbW || 1;
    const desiredPx = 6.5;
    const baseRadiusVB = desiredPx * (initialVBWidth / dispWidth);
    const strokePx = 0.7;
    const baseStrokeVB = strokePx * (initialVBWidth / dispWidth);
    hotspotBaseRadiusVB = baseRadiusVB;
    hotspotBaseStrokeVB = baseStrokeVB;
    hotspotBaseStrokePx = strokePx;
    hotspotFullVBWidth = initialVBWidth;
    let layer = svg.select('#hotspots-layer');
    if (layer.empty()) layer = svg.append('g').attr('id', 'hotspots-layer');
    filtered.forEach(h => {
        const group = layer.append('g').attr('class', 'hotspot-group');
        group.append('circle')
            .attr('cx', h.x)
            .attr('cy', h.y)
            .attr('r', baseRadiusVB)
            .attr('class', 'hotspot')
            .attr('stroke', '#d7263d')
            .style('stroke-width', strokePx + 'px')
            .style('fill', 'rgba(215,38,61,0.65)')
            .on('mouseover', function(event) {
                const imgHtml = h.imageUrl ? `<img src="${h.imageUrl}" alt="${h.title}">` : '';
                popup.select('.popup-content').html(imgHtml + `<strong>${h.title}</strong><br><p>${h.description}</p>`);
                // Content changed — invalidate cached measurements so we re-measure once
                popupRectCached = null;
                // Position synchronously (scale(.98)) then enable .open in next frame for smooth animation
                // mark this hotspot as active so delayed opens can verify intent
                activeHotspot = h;
                const pt = svgPointToClient(h.x, h.y) || { pageX: h.x, pageY: h.y, clientX: h.x, clientY: h.y };
                popupLastEvent = pt;
                popupRectCached = null;
                try { updatePopupPosition(popupLastEvent); } catch (e) {}
                requestAnimationFrame(() => requestAnimationFrame(() => { if (activeHotspot === h) popup.classed('open', true); }));
                const img = popup.select('.popup-content').select('img');
                if (!img.empty()) {
                    img.style('opacity', 0).style('transform', 'translateY(6px)');
                    const node = img.node();
                    if (node && node.complete) {
                        img.style('opacity', 1).style('transform', 'translateY(0)');
                        popupRectCached = null;
                        const pt2 = svgPointToClient(h.x, h.y) || pt;
                        popupLastEvent = pt2;
                        try { updatePopupPosition(popupLastEvent); } catch (e) {}
                        requestAnimationFrame(() => requestAnimationFrame(() => { if (activeHotspot === h) popup.classed('open', true); }));
                    } else {
                        img.on('load', function() {
                            d3.select(this).style('opacity', 1).style('transform', 'translateY(0)');
                            popupRectCached = null;
                            const pt3 = svgPointToClient(h.x, h.y) || pt;
                            popupLastEvent = pt3;
                            try { updatePopupPosition(popupLastEvent); } catch (e) {}
                            requestAnimationFrame(() => requestAnimationFrame(() => { if (activeHotspot === h) popup.classed('open', true); }));
                        });
                    }
                }
            })
            .on('mousemove', function(event) {
                // Throttle positioning to RAF and use transform for smooth GPU-accelerated moves
                popupLastEvent = event;
                // invalidate cached rect in case content changed size during interaction
                popupRectCached = null;
                schedulePopupPosition();
            })
            .on('mouseout', function() {
                popup.classed('open', false);
                activeHotspot = null;
                // update transform (scale) smoothly via RAF — use converted SVG coords as fallback
                const pt = svgPointToClient(h.x || 0, h.y || 0) || { pageX: (h.x || 0), pageY: (h.y || 0), clientX: (h.x || 0), clientY: (h.y || 0) };
                popupLastEvent = popupLastEvent || pt;
                popupRectCached = null;
                schedulePopupPosition();
            });
    });
    try { svg.select('#hotspots-layer').raise(); } catch (e) {}
}

window.addEventListener('resize', () => { createHotspots(null); setTimeout(adjustHotspots,0); });

function adjustHotspots() {
    if (!hotspotBaseRadiusVB || !hotspotBaseStrokeVB) return;
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
    const scaleFactor = curVBWidth / hotspotFullVBWidth;
    const hotspotDamping = 0.9;
    const adjusted = 1 - (1 - scaleFactor) * hotspotDamping;
    const newR = hotspotBaseRadiusVB * adjusted;
    const newStrokePx = (hotspotBaseStrokePx || 1.5) * adjusted;
    svg.selectAll('.hotspot').attr('r', newR).style('stroke-width', newStrokePx + 'px');
    if (stateBaseStrokeVB) {
        const stateDamping = 0.8;
        const adjustedState = 1 - (1 - scaleFactor) * stateDamping;
        const newStateStroke = stateBaseStrokeVB * adjustedState;
        svg.selectAll('.state').attr('stroke-width', newStateStroke).style('stroke-width', newStateStroke + 'px');
    }
}

setTimeout(() => { createHotspots(null); setTimeout(adjustHotspots,0);
    if (stateBaseStrokeVB === null) {
        const dispWidth = svg.node().getBoundingClientRect().width || 1;
        const initialVBWidth = vbW || 1;
        const desiredStateStrokePx = 0.9;
        stateBaseStrokeVB = desiredStateStrokePx * (initialVBWidth / dispWidth);
    }
}, 50);
window.addEventListener('load', () => setTimeout(() => { createHotspots(null); setTimeout(adjustHotspots,0);
    if (stateBaseStrokeVB === null) {
        const dispWidth = svg.node().getBoundingClientRect().width || 1;
        const initialVBWidth = vbW || 1;
        const desiredStateStrokePx = 0.9;
        stateBaseStrokeVB = desiredStateStrokePx * (initialVBWidth / dispWidth);
    }
}, 50));
setTimeout(() => { try { adjustHotspots(); } catch(e){} }, 200);

(function(){
    const svgEl = svg.node();
    if (!svgEl) return;
    let vb = (svg.attr('viewBox') || '').split(/\s+/).map(Number);
    if (vb.length < 4) vb = [0, 0, +svg.attr('width') || svgEl.viewBox.baseVal.width, +svg.attr('height') || svgEl.viewBox.baseVal.height];
    const initial = { w: vb[2], h: vb[3] };
    const minScale = 1;
    const maxScale = 10;
    function clientToSvgPoint(evt){
        const pt = svgEl.createSVGPoint();
        pt.x = evt.clientX; pt.y = evt.clientY;
        return pt.matrixTransform(svgEl.getScreenCTM().inverse());
    }
    function doWheel(e){
        if (e.defaultPrevented) return;
        if (!(e.ctrlKey || e.metaKey)) return;
        e.preventDefault();
        const zoomOut = e.deltaY > 0;
        const factor = zoomOut ? 1.12 : 0.88;
        const p = clientToSvgPoint(e);
        const [vx, vy, vw, vh] = vb;
        const newW = vw * factor;
        const newH = vh * factor;
        const newScale = initial.w / newW;
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
        vb = clampToFull(vb);
        svg.attr('viewBox', vb.join(' '));
        setTimeout(adjustHotspots,0);
    }
    svgEl.addEventListener('wheel', doWheel, { passive: false });
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
    function setMapInteractionActive(active){
        try{
            if (active) document.documentElement.classList.add('map-interaction-active');
            else document.documentElement.classList.remove('map-interaction-active');
        }catch(e){}
    }
    window.addEventListener('keydown', function(e){
        if (e.key === 'Control' || e.key === 'Meta') setMapInteractionActive(true);
    }, { passive: true });
    window.addEventListener('keyup', function(e){
        if (e.key === 'Control' || e.key === 'Meta') setMapInteractionActive(false);
    }, { passive: true });
    window.addEventListener('blur', function(){ setMapInteractionActive(false); }, { passive: true });
    let isPanning = false;
    let startClient = null;
    let vbStart = null;
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
    function setCursorDragging(dragging){ try { svgEl.style.cursor = dragging ? 'grabbing' : 'grab'; } catch(e){} }
    svgEl.addEventListener('mousedown', function(e){
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
    setCursorDragging(false);
})();

// Search UI: highlight a state when selected from the search box
(function(){
    try {
        const input = document.getElementById('map-search');
        const sugg = document.getElementById('map-search-suggestions');
        if (!input || !sugg || !states) return;

        const nodes = Array.from(states.nodes()).filter(n => n && n.id);
        const items = nodes.map(n => ({ id: n.id, name: (n.getAttribute('data-name') || n.getAttribute('title') || n.id || '').trim() }));
        let highlighted = -1;
        let currentMatches = [];
        let activeSearchState = null;

        function clearSuggestions(){ sugg.innerHTML = ''; sugg.setAttribute('aria-hidden','true'); highlighted = -1; currentMatches = []; }

        function render(matches){
            clearSuggestions();
            if (!matches || !matches.length) return;
            sugg.setAttribute('aria-hidden','false');
            const frag = document.createDocumentFragment();
            matches.slice(0,30).forEach((m, idx) => {
                const li = document.createElement('li');
                li.textContent = m.name;
                li.setAttribute('role','option');
                li.dataset.id = m.id;
                li.className = 'map-search-suggestion';
                li.addEventListener('click', function(){ activateState(m.id); input.value = m.name; clearSuggestions(); });
                frag.appendChild(li);
            });
            sugg.appendChild(frag);
        }

        function search(q){
            const s = (q||'').trim().toLowerCase();
            if (!s) { clearSuggestions(); clearActive(); return; }
            const matches = items.filter(it => it.name.toLowerCase().includes(s)).sort((a,b)=> a.name.localeCompare(b.name));
            currentMatches = matches;
            render(matches);
        }

        function clearActive(){
            try {
                if (activeSearchState) {
                    try {
                        const prev = activeSearchState.getAttribute('data-prev-stroke');
                        const prevW = activeSearchState.getAttribute('data-prev-stroke-width');
                        if (prev !== null) {
                            if (prev === '') activeSearchState.removeAttribute('stroke'); else activeSearchState.setAttribute('stroke', prev);
                        }
                        if (prevW !== null) {
                            if (prevW === '') activeSearchState.removeAttribute('stroke-width'); else activeSearchState.setAttribute('stroke-width', prevW);
                        }
                        activeSearchState.style && (activeSearchState.style.vectorEffect = null);
                    } catch(e){}
                    activeSearchState.classList.remove('state--active');
                    activeSearchState = null;
                }
                try {
                    const actLayer = svg.select('#active-state-layer');
                    if (!actLayer.empty()) actLayer.selectAll('*').remove();
                } catch(e) {}
                try { popup.classed('open', false); } catch(e){}
                try { tooltip.style('opacity', 0); } catch(e){}
            } catch(e){}
        }

        function activateState(id){
            try {
                clearActive();
                const el = document.getElementById(id);
                if (!el) return;
                // Save previous stroke attributes so we can restore later
                try {
                    if (!el.hasAttribute('data-prev-stroke')) el.setAttribute('data-prev-stroke', el.getAttribute('stroke') || '');
                    if (!el.hasAttribute('data-prev-stroke-width')) el.setAttribute('data-prev-stroke-width', el.getAttribute('stroke-width') || '');
                } catch(e){}
                // Hide original stroke so the cloned active-layer stroke is visible
                try { el.setAttribute('stroke', 'none'); el.setAttribute('stroke-width', '0'); el.style && (el.style.vectorEffect = null); } catch(e){}
                el.classList.add('state--active');
                activeSearchState = el;
                try {
                    // Ensure an active-state layer exists and is placed immediately before hotspots
                    let actLayer = svg.select('#active-state-layer');
                    if (actLayer.empty()) {
                        if (svg.select('#hotspots-layer').empty()) actLayer = svg.append('g').attr('id','active-state-layer');
                        else actLayer = svg.insert('g', '#hotspots-layer').attr('id','active-state-layer');
                    }
                    // Clear previous highlight clone
                    actLayer.selectAll('*').remove();

                    // Clone the selected element into the active layer and style the clone as stroke-only
                    const clone = el.cloneNode(true);
                    try { clone.removeAttribute && clone.removeAttribute('id'); } catch(e){}
                    // Recursively style cloned shape nodes
                    (function styleNode(n){
                        try {
                            const tag = (n.tagName || '').toLowerCase();
                            if (['path','polygon','polyline','rect','circle','ellipse','line'].includes(tag)) {
                                n.setAttribute('fill', 'none');
                                const accent = (getComputedStyle(document.documentElement).getPropertyValue('--popup-accent') || '#0a84ff').trim() || '#0a84ff';
                                n.setAttribute('stroke', accent);
                                n.setAttribute('stroke-width', '2');
                                n.setAttribute('vector-effect', 'non-scaling-stroke');
                                n.setAttribute('pointer-events', 'none');
                                try { n.style.filter = 'drop-shadow(0 8px 16px rgba(10,132,255,0.12))'; } catch(e){}
                            }
                        } catch(e){}
                        try { const ch = n.children || []; for (let i=0;i<ch.length;i++) styleNode(ch[i]); } catch(e){}
                    })(clone);

                    // Append clone to the active layer
                    const node = actLayer.node();
                    if (node) node.appendChild(clone);
                } catch(e) { console.error('active-layer', e); }
            } catch(e) { console.error('activateState', e); }
        }

        input.addEventListener('input', function(){ search(this.value); });
        input.addEventListener('keydown', function(e){
            const itemsEls = sugg ? Array.from(sugg.children) : [];
            if (e.key === 'ArrowDown'){
                if (!itemsEls.length) return;
                e.preventDefault(); highlighted = Math.min(itemsEls.length-1, highlighted+1);
                itemsEls.forEach((li,i)=> li.classList.toggle('selected', i===highlighted));
            } else if (e.key === 'ArrowUp'){
                if (!itemsEls.length) return;
                e.preventDefault(); highlighted = Math.max(0, highlighted-1);
                itemsEls.forEach((li,i)=> li.classList.toggle('selected', i===highlighted));
            } else if (e.key === 'Enter'){
                if (itemsEls.length){ e.preventDefault(); const idx = highlighted>=0?highlighted:0; const sel = itemsEls[idx]; if (sel){ activateState(sel.dataset.id); input.value = sel.textContent; clearSuggestions(); } }
            } else if (e.key === 'Escape'){
                input.value = ''; clearSuggestions(); clearActive();
            }
        }, false);

        // click outside closes suggestions
        document.addEventListener('click', function(ev){ if (!ev.target) return; if (ev.target === input || ev.target.closest && ev.target.closest('.map-search')) return; clearSuggestions(); }, { capture: true });

    } catch (e) { console.error('map-search:init', e); }
})();
