// Runtime probe removed
// Global error handlers — log errors to the console
window.addEventListener('error', function(ev){ try{ console.error('map:error', ev.message || ev.error || ev); }catch(e){} });
window.addEventListener('unhandledrejection', function(ev){ try{ console.error('map:unhandledrejection', ev.reason || ev); }catch(e){} });
// Use inline SVG (avoids XHR/file:// restrictions)
const svg = d3.select('#map').select('svg');

// (debugging helpers removed)
// Guard to avoid re-entrant highlight reordering
let _reorderingHighlights = false;

// Helper: ensure the hotspots layer is the last child of the SVG so
// hotspots always render above state shapes even if other code
// reorders elements. Uses direct DOM appendChild to guarantee ordering.
function raiseHotspotsLayerLast(){
    try{
        const layer = svg.select('#hotspots-layer');
        const node = layer.node();
        const parent = node && node.parentNode;
        if (!node || !parent) return;
        // if it's already the last element, do nothing
        const last = parent.lastElementChild || parent.lastChild;
        if (last === node) return;
        // schedule the DOM move via a shared RAF scheduler to coalesce calls
        if (!raiseHotspotsLayerLast._sched) {
            raiseHotspotsLayerLast._sched = { _pending: false, _ops: [] };
        }
        const sched = raiseHotspotsLayerLast._sched;
        sched._ops.push(() => {
            try{
                const last2 = parent.lastElementChild || parent.lastChild;
                if (last2 === node) return;
                parent.appendChild(node);
                // ensure highlights-layer (if present) is immediately before hotspots
                try{
                    const hl = parent.querySelector('#highlights-layer');
                    if (hl && hl !== node.previousElementSibling) parent.insertBefore(hl, node);
                }catch(e){}
                    
            }catch(e){}
        });
        if (!sched._pending) {
            sched._pending = true;
            try{ requestAnimationFrame(() => { sched._pending = false; const ops = sched._ops.splice(0); ops.forEach(f=>{ try{ f(); }catch(e){} }); }); }catch(e){ // fallback
                const ops = sched._ops.splice(0); ops.forEach(f=>{ try{ f(); }catch(e){} });
            }
        }
    }catch(e){}
}

// Highlights overlay: draw stroke-only clones of hovered states into a
// dedicated `#highlights-layer` so we don't need to reorder the main
// SVG state nodes (which can cause pointer-event jitter).
function ensureHighlightsLayer(){
    try{
        let layer = svg.select('#highlights-layer');
        if (!layer.empty()) return;
        // create the element now (DOM append is batched by raiseHotspotsLayerLast when needed)
        const g = document.createElementNS('http://www.w3.org/2000/svg','g');
        g.setAttribute('id','highlights-layer');
        // prefer inserting before hotspots if available, otherwise append
        try{
            const hot = svg.select('#hotspots-layer');
            const hotNode = hot.empty() ? null : hot.node();
            const parent = hotNode && hotNode.parentNode || (svg.node() && svg.node().parentNode) || svg.node();
            if (hotNode && parent) parent.insertBefore(g, hotNode);
            else svg.node().appendChild(g);
            try{ raiseHighlightsLayerLast(); }catch(e){}
            try{ raiseHotspotsLayerLast(); }catch(e){}
        }catch(e){
            try{ svg.append('g').attr('id','highlights-layer'); }catch(e){}
        }
    }catch(e){}
}

// Ensure the highlights layer sits after all `.state` nodes and before the
// `#hotspots-layer`. This is scheduled via RAF to coalesce DOM moves and avoid
// interleaved reorders that could retrigger pointer events.
function raiseHighlightsLayerLast(){
    try{
        const hlSel = svg.select('#highlights-layer');
        const hl = hlSel.node();
        if (!hl) return;
        const parent = hl.parentNode;
        if (!parent) return;
        // prefer placing right before hotspots if present
        const hot = parent.querySelector('#hotspots-layer');
        if (hot && hot.previousElementSibling === hl) return; // already placed

        if (!raiseHighlightsLayerLast._sched) raiseHighlightsLayerLast._sched = { _pending: false, _ops: [] };
        const sched = raiseHighlightsLayerLast._sched;
        sched._ops.push(() => {
            try{
                // Move highlights to the end, then ensure hotspots is after it
                parent.appendChild(hl);
                if (hot) parent.appendChild(hot);
                                // Find the last top-level child under `parent` that either is a `.state`
                // or contains `.state` descendants. Insert the highlights layer after
                // that child so it sits above all state fills but before hotspots.
                let insertBeforeNode = hot || null;
                try{
                    const children = Array.prototype.slice.call(parent.childNodes || []);
                    let lastChildWithState = null;
                    for (let i=0;i<children.length;i++){
                        const c = children[i];
                        if (!c) continue;
                        if (c === hl) continue;
                        try{
                            if (c.classList && c.classList.contains && c.classList.contains('state')) {
                                lastChildWithState = c;
                                continue;
                            }
                            if (c.querySelector && c.querySelector('.state')) {
                                lastChildWithState = c;
                            }
                        }catch(e){}
                    }
                    if (lastChildWithState) insertBeforeNode = lastChildWithState.nextSibling || insertBeforeNode;
                }catch(e){}
                // if insertBeforeNode is null, append at end
                if (insertBeforeNode) parent.insertBefore(hl, insertBeforeNode);
                
            }catch(e){}
        });
        if (!sched._pending) {
            sched._pending = true;
            try{
                requestAnimationFrame(() => { sched._pending = false; const ops = sched._ops.splice(0); ops.forEach(f=>{ try{ f(); }catch(e){} }); }); }catch(e){ const ops = sched._ops.splice(0); ops.forEach(f=>{ try{ f(); }catch(e){} });}
            }
    }catch(e){}
}

// Refresh active-state highlights: clones any `.state--active` shapes into the
// highlights layer so active borders always render above neighboring fills.
function refreshActiveHighlights(){
    try{
        ensureHighlightsLayer();
        const layer = svg.select('#highlights-layer');
        if (layer.empty()) return;
        // restore strokes for all states first (in case some were previously hidden)
        try{ const allStates = svg.selectAll('.state').nodes(); if (allStates && allStates.length) allStates.forEach(n=>{ try{ _restoreStroke(n); }catch(e){} }); }catch(e){}
        // remove previous active clones
        try{ svg.selectAll('[data-active-highlight]').remove(); }catch(e){}
        const act = svg.selectAll('.state--active').nodes();
        if (!act || !act.length) return;
        // hide original strokes for active states so cloned stroke renders cleanly on top
        try{ act.forEach(n=>{ try{ _storeAndHideStroke(n); }catch(e){} }); }catch(e){}
        act.forEach((node, idx) => {
            try{
                const clone = node.cloneNode(true);
                _stripIdsRec(clone);
                if (clone.setAttribute) {
                    clone.setAttribute('data-active-highlight', '1');
                    clone.setAttribute('fill', 'none');
                    clone.setAttribute('stroke', '#000');
                    clone.setAttribute('stroke-width', '1.8');
                    clone.setAttribute('vector-effect', 'non-scaling-stroke');
                    clone.style.pointerEvents = 'none';
                }
                try{
                    const root = svg.node();
                    const hot = root && root.querySelector ? root.querySelector('#hotspots-layer') : null;
                    if (root) {
                        if (hot) root.insertBefore(clone, hot);
                        else root.appendChild(clone);
                        
                    }
                }catch(e){ try{ svg.node().appendChild(clone); }catch(err){} }
            }catch(e){}
        });
        
    }catch(e){}
}

// Observe mutations that affect active-state class and child additions so we
// can refresh active highlights and maintain highlights layering without
// reordering state nodes directly.
try{
    const svgNode = svg.node();
    if (svgNode && typeof MutationObserver !== 'undefined'){
        const mo = new MutationObserver((mutations)=>{
            let needRefresh = false;
            let needRaise = false;
            for (const m of mutations){
                
                // If new state/path nodes are added, ensure highlights layer and clones are moved after them.
                if (m.type === 'childList' && m.addedNodes && m.addedNodes.length) {
                    try{
                        if (!_reorderingHighlights) {
                            let found = false;
                            for (let i=0;i<m.addedNodes.length;i++){
                                const n = m.addedNodes[i];
                                try{
                                    if (!n) continue;
                                    if (n.nodeType === 1) {
                                        const tag = (n.tagName || '').toLowerCase();
                                        if (tag === 'path' || tag === 'g' || (n.classList && n.classList.contains && n.classList.contains('state'))) { found = true; break; }
                                    }
                                }catch(e){}
                            }
                            if (found) {
                                _reorderingHighlights = true;
                                try{
                                    // perform immediate DOM reorder: move highlights-layer and any highlight clones
                                    try{
                                        const root = svg.node();
                                        if (root) {
                                            const hl = root.querySelector && root.querySelector('#highlights-layer');
                                            const hot = root.querySelector && root.querySelector('#hotspots-layer');
                                            if (hl && hl.parentNode) {
                                                const p = hl.parentNode;
                                                // move any existing highlight clones to just before hotspots
                                                try{
                                                    const clones = Array.prototype.slice.call(p.querySelectorAll('[data-active-highlight], [data-orig-key]'));
                                                    clones.forEach(cl => {
                                                        try{ if (hot) p.insertBefore(cl, hot); else p.appendChild(cl); }catch(e){}
                                                    });
                                                }catch(e){}
                                                // ensure highlights layer sits before hotspots
                                                try{ if (hot) p.insertBefore(hl, hot); else p.appendChild(hl); }catch(e){}
                                            }
                                        }
                                    }catch(e){}
                                }catch(e){}
                                try{ requestAnimationFrame(()=>{ _reorderingHighlights = false; }); }catch(e){ _reorderingHighlights = false; }
                            }
                        }
                    }catch(e){}
                }
                if (m.type === 'attributes' && m.attributeName === 'class') {
                    if (m.target && m.target.classList && m.target.classList.contains('state--active')) needRefresh = true;
                    else needRefresh = true; // attribute changed; refresh to be safe
                }
                if (m.type === 'childList') {
                    needRaise = true;
                }
            }
            if (needRefresh) {
                if (!refreshActiveHighlights._scheduled){
                    refreshActiveHighlights._scheduled = true;
                    try{ requestAnimationFrame(()=>{ refreshActiveHighlights._scheduled = false; refreshActiveHighlights(); }); }catch(e){ refreshActiveHighlights._scheduled = false; refreshActiveHighlights(); }
                }
            }
            if (needRaise) {
                if (!raiseHighlightsLayerLast._scheduled){
                    raiseHighlightsLayerLast._scheduled = true;
                    try{ requestAnimationFrame(()=>{ raiseHighlightsLayerLast._scheduled = false; raiseHighlightsLayerLast(); }); }catch(e){ raiseHighlightsLayerLast._scheduled = false; raiseHighlightsLayerLast(); }
                }
            }
        });
        mo.observe(svgNode, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
    }
}catch(e){}

function _stripIdsRec(n){
    try{
        if (n && n.removeAttribute && n.hasAttribute && n.hasAttribute('id')) n.removeAttribute('id');
        const children = n && n.childNodes;
        if (!children) return;
        for (let i=0;i<children.length;i++) _stripIdsRec(children[i]);
    }catch(e){}
}

// Recursively store original stroke attributes and hide them to avoid doubled borders
function _storeAndHideStroke(node){
    try{
        if (!node || !node.setAttribute) return;
        // walk the node and its descendants
        const stack = [node];
        while (stack.length) {
            const n = stack.pop();
            try{
                if (!n || !n.setAttribute) continue;
                if (n.__origStrokeStored) {
                    // already processed
                } else {
                    const s = n.getAttribute && n.getAttribute('stroke');
                    const sw = n.getAttribute && n.getAttribute('stroke-width');
                    if (s !== null && s !== undefined) n.setAttribute('data-orig-stroke', s);
                    if (sw !== null && sw !== undefined) n.setAttribute('data-orig-stroke-width', sw);
                    // apply inline hide which overrides CSS
                    n.setAttribute('stroke', 'none');
                    n.setAttribute('stroke-width', '0');
                    n.__origStrokeStored = true;
                }
                const children = n.childNodes;
                if (children && children.length) for (let i=0;i<children.length;i++) stack.push(children[i]);
            }catch(e){}
        }
    }catch(e){}
}

// Recursively restore previously stored stroke attributes
function _restoreStroke(node){
    try{
        if (!node || !node.setAttribute) return;
        const stack = [node];
        while (stack.length) {
            const n = stack.pop();
            try{
                if (!n || !n.setAttribute) continue;
                if (n.__origStrokeStored) {
                    const s = n.getAttribute && n.getAttribute('data-orig-stroke');
                    const sw = n.getAttribute && n.getAttribute('data-orig-stroke-width');
                    if (s !== null && s !== undefined) n.setAttribute('stroke', s);
                    else n.removeAttribute && n.removeAttribute('stroke');
                    if (sw !== null && sw !== undefined) n.setAttribute('stroke-width', sw);
                    else n.removeAttribute && n.removeAttribute('stroke-width');
                    n.removeAttribute && n.removeAttribute('data-orig-stroke');
                    n.removeAttribute && n.removeAttribute('data-orig-stroke-width');
                    n.__origStrokeStored = false;
                }
                const children = n.childNodes;
                if (children && children.length) for (let i=0;i<children.length;i++) stack.push(children[i]);
            }catch(e){}
        }
    }catch(e){}
}

function addHighlightFor(node){
    try{
        if (!node) return;
        ensureHighlightsLayer();
        const key = node.id || (node.__highlightKey = node.__highlightKey || ('h_'+Math.random().toString(36).slice(2,9)));
        // no timers: rely on RAF batching for add/remove
        // if a highlight already exists for this key, do nothing
        try{
            const existing = svg.node().querySelector('[data-orig-key="'+key+'"]');
            if (existing) { return; }
        }catch(e){}

        // perform the append in RAF to batch DOM writes
        try{
            requestAnimationFrame(()=>{
                try{
                    // double-check existence
                    try{ if (svg.node().querySelector('[data-orig-key="'+key+'"]')) return; }catch(e){}
                    const clone = node.cloneNode(true);
                    _stripIdsRec(clone);
                    if (clone.setAttribute) {
                        clone.setAttribute('data-orig-key', key);
                        clone.setAttribute('fill', 'none');
                        clone.setAttribute('stroke', '#000');
                        clone.setAttribute('stroke-width', '2.4');
                        clone.setAttribute('vector-effect', 'non-scaling-stroke');
                        clone.setAttribute('stroke-linejoin', 'round');
                        clone.setAttribute('stroke-linecap', 'round');
                        clone.style.pointerEvents = 'none';
                        clone.style.shapeRendering = 'geometricPrecision';
                        clone.classList.add('highlight-clone');
                    }
                    const root = svg.node();
                    if (root) {
                        try{
                            const isActive = node.classList && node.classList.contains && node.classList.contains('state--active');
                            const firstActive = root.querySelector('[data-active-highlight]');
                            const hot = root.querySelector && root.querySelector('#hotspots-layer');
                            // find last top-level child that is a .state or contains .state
                            let insertBeforeNode = hot || null;
                            try{
                                const children = Array.prototype.slice.call(root.childNodes || []);
                                let lastChildWithState = null;
                                for (let i=0;i<children.length;i++){
                                    const c = children[i];
                                    if (!c || c === clone) continue;
                                    try{
                                        if (c.classList && c.classList.contains && c.classList.contains('state')) { lastChildWithState = c; continue; }
                                        if (c.querySelector && c.querySelector('.state')) { lastChildWithState = c; }
                                    }catch(e){}
                                }
                                if (lastChildWithState) insertBeforeNode = lastChildWithState.nextSibling || insertBeforeNode;
                            }catch(e){}
                            if (!isActive && firstActive) insertBeforeNode = firstActive;
                            if (root) {
                                if (hot) root.insertBefore(clone, hot);
                                else root.appendChild(clone);
                                
                            }
                        }catch(e){ root.appendChild(clone); }
                        try{ raiseHotspotsLayerLast(); }catch(e){}
                    }
                }catch(e){}
            });
        }catch(e){}
    }catch(e){}
}

function removeHighlightFor(node){
    try{
        if (!node) return;
        const key = node.id || node.__highlightKey;
        if (!key) return;
        // remove highlight in RAF to batch DOM writes (no timers)
        try{
            try{ requestAnimationFrame(()=>{ svg.selectAll('[data-orig-key="'+key+'"]').remove(); }); }catch(e){ svg.selectAll('[data-orig-key="'+key+'"]').remove(); }
        }catch(e){}
    }catch(e){}
}

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
// canonical initial view size (use original SVG viewBox as the reference)
const INITIAL_VIEW_W = vbArr[2] || vbW || 1;
const INITIAL_VIEW_H = vbArr[3] || vbH || 1;
// Maximum zoom-in factor (times the initial view). Adjust as needed.
const MAX_ZOOM_SCALE = 10;
// shared viewBox array used by pan/zoom and external focus operations
let sharedViewBox = vbArr.slice();

// canonical full viewBox (use the SVG's original viewBox to avoid
// clamping discrepancies introduced by recomputing bounds from DOM bboxes)
let fullViewBox = vbArr.slice();

// Compute a conservative full viewBox based on the union of all visible state bboxes.
function computeFullViewBox(){
    try{
        const nodes = svg.selectAll('path, polygon, g[id]').nodes().filter(n=>n && typeof n.getBBox === 'function');
        if (!nodes.length) return vbArr.slice();
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        nodes.forEach(n => {
            try{
                const bb = n.getBBox();
                if (bb && isFinite(bb.x) && isFinite(bb.y) && isFinite(bb.width) && isFinite(bb.height)){
                    minX = Math.min(minX, bb.x);
                    minY = Math.min(minY, bb.y);
                    maxX = Math.max(maxX, bb.x + bb.width);
                    maxY = Math.max(maxY, bb.y + bb.height);
                }
            }catch(e){ }
        });
        if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) return vbArr.slice();
        const pad = Math.max((maxX - minX), (maxY - minY)) * 0.02; // small 2% pad
        minX -= pad; minY -= pad; maxX += pad; maxY += pad;
        return [minX, minY, Math.max(1, maxX - minX), Math.max(1, maxY - minY)];
    }catch(e){ return vbArr.slice(); }
}
let geo = null;
if (geoAttr) {
    const parts = geoAttr.trim().split(/\s+/).map(Number);
    if (parts.length === 4 && parts.every(n => !Number.isNaN(n))) {
        geo = { minLon: parts[0], maxLat: parts[1], maxLon: parts[2], minLat: parts[3] };
        geo.latSpan = geo.maxLat - geo.minLat;
    }
}


// Ensure highlights layer exists before attaching state event handlers
ensureHighlightsLayer();

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
    // compute a shade for each state – use geographic latitude as a simple elevation proxy
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
        // cancel any pending mouseout restore for this element
        try{ if (this.__mouseoutTimer) { clearTimeout(this.__mouseoutTimer); this.__mouseoutTimer = null; } }catch(e){}
        
        tooltip.style('opacity', 1).html(name);
        el.style('opacity', 0.8);
        
        // Add highlight clone to dedicated layer (renders on top)
        try{
            _storeAndHideStroke(this);
            addHighlightFor(this);
        }catch(e){}
    })
    .on('mousemove', function(event) {
        tooltip.style('left', (event.pageX + 10) + 'px').style('top', (event.pageY - 10) + 'px');
    })
    .on('mouseout', function(event) {
        // quick guard: if pointer moved into the state or hotspots, ignore
        try{
            const related = event && (event.relatedTarget || event.toElement);
            if (related) {
                if (this.contains(related)) return;
                try{ const hnode = svg.select('#hotspots-layer').node(); if (hnode && hnode.contains(related)) return; } catch(e){}
            }
        }catch(e){}

        tooltip.style('opacity', 0);

        // debounce the restore
        try{
            const node = this;
            if (node.__mouseoutTimer) { clearTimeout(node.__mouseoutTimer); node.__mouseoutTimer = null; }
            node.__mouseoutTimer = setTimeout(()=>{
                try{
                    const el = d3.select(node);
                    el.style('opacity', null);
                    removeHighlightFor(node);
                    // restore stroke unless state is active
                    if (!(node.classList && node.classList.contains && node.classList.contains('state--active'))) {
                        _restoreStroke(node);
                    }
                }catch(e){}
                node.__mouseoutTimer = null;
            }, 90);
        }catch(e){}
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
// Desired on-screen hotspot radius in pixels used at creation time.
const HOTSPOT_DESIRED_PX = 6.5;
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

    // desired on-screen radius in pixels at original scale (fixed)
    const desiredPx = HOTSPOT_DESIRED_PX;
    // convert desired px at original scale into viewBox units (constant)
    const baseRadiusVB = desiredPx * (initialVBWidth / dispWidth);

    // stroke width in screen pixels (adjust for desired border thickness)
    const strokePx = 0.7;
    const baseStrokeVB = strokePx * (initialVBWidth / dispWidth);

    // radii are set in viewBox units so circles scale with viewBox.
    // stroke is applied in screen pixels so it remains visually consistent while radii scale.

    // store base values (we do not dynamically resize hotspots after creation)
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
            .style('vector-effect', 'non-scaling-stroke')
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
    try { raiseHotspotsLayerLast(); } catch (e) {}
}

// recompute hotspots sizes on window resize so the base VB radius is accurate
window.addEventListener('resize', () => { createHotspots(null); scheduleAdjustHotspots(); });


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
    // When zooming in, curVBWidth becomes smaller; use cur/full so state
    // border stroke can be adjusted. Hotspot radii are fixed at creation
    // time (we don't change them dynamically) to keep behavior predictable.
    const scaleFactor = curVBWidth / hotspotFullVBWidth;
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

// Coalesce repeated calls to `adjustHotspots` using requestAnimationFrame.
// Calling `scheduleAdjustHotspots()` schedules a single invocation per frame
// which prevents heavy work from running on every mousemove/wheel tick.
function scheduleAdjustHotspots(){
    try{
        // if user is actively panning, defer running until pan ends
        if (window._map_is_panning) { scheduleAdjustHotspots._pendingAfterPan = true; return; }
        if (scheduleAdjustHotspots._raf) return; // already scheduled for next frame
        if (typeof requestAnimationFrame === 'function'){
            scheduleAdjustHotspots._raf = requestAnimationFrame(() => {
                scheduleAdjustHotspots._raf = null;
                try{ adjustHotspots(); }catch(e){}
            });
        } else {
            // fallback
            setTimeout(() => { try{ adjustHotspots(); }catch(e){} }, 16);
        }
    }catch(e){ try{ adjustHotspots(); }catch(err){} }
}

// Create hotspots after layout so the displayed SVG size is available
// (compute radii in viewBox units from the current display width)
setTimeout(() => { createHotspots(null); scheduleAdjustHotspots();
    // compute base state stroke in viewBox units if not set
        if (stateBaseStrokeVB === null) {
        const dispWidth = svg.node().getBoundingClientRect().width || 1;
        const initialVBWidth = vbW || 1;
        const desiredStateStrokePx = 0.9; // desired on-screen stroke in px at original scale
        stateBaseStrokeVB = desiredStateStrokePx * (initialVBWidth / dispWidth);
    }
}, 50);
// re-create on full load too (ensures correct sizing when CSS/layout finishes)
window.addEventListener('load', () => setTimeout(() => { createHotspots(null); scheduleAdjustHotspots();
    if (stateBaseStrokeVB === null) {
        const dispWidth = svg.node().getBoundingClientRect().width || 1;
        const initialVBWidth = vbW || 1;
        const desiredStateStrokePx = 0.9; // standardized to match initial desired thickness
        stateBaseStrokeVB = desiredStateStrokePx * (initialVBWidth / dispWidth);
    }
}, 50));

// sanity check: ensure adjustHotspots runs after load
setTimeout(() => { try { scheduleAdjustHotspots(); } catch(e){} }, 200);

// Ctrl+Wheel zoom (hold Ctrl/Meta) — update the SVG viewBox centered at the pointer
(function(){
    const svgEl = svg.node();
    if (!svgEl) return;
    // use the shared viewBox so external code (focusStateById) and this
    // pan/zoom logic operate on the same in-memory array reference
    let vb = sharedViewBox;
    const initial = { w: vb[2], h: vb[3] };
    // compute full bounds early so the wheel handler can reference them
    let fullVB = computeFullViewBox();
    let minScale = 1; // computed below based on the full content extents
    const maxScale = MAX_ZOOM_SCALE;  // maximum zoom-in

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
        let newW = vw * factor;
        let newH = vh * factor;
        // compute scale relative to the initial viewBox
        let newScale = INITIAL_VIEW_W / newW;

        // If the requested new width would exceed the computed full bounds,
        // step part-way toward the full width instead of snapping immediately.
        // This makes zooming out feel gradual when the initial view was a
        // cropped/`cover` presentation. Repeated wheel events will continue
        // moving toward the full extent until reached.
        try{
            const eps = 1e-9;
            if (fullVB && newW > (fullVB[2] + eps)) {
                // fraction of the remaining distance to cover per wheel tick
                const stepFraction = 0.45;
                const remaining = fullVB[2] - vw;
                if (remaining > 0) {
                    // move part-way toward the full width
                    const step = Math.max(1e-6, remaining * stepFraction);
                    newW = Math.min(fullVB[2], vw + step);
                    // preserve aspect ratio for height
                    newH = vh * (newW / vw);
                } else {
                    // fallback: clamp
                    newW = Math.min(newW, fullVB[2]);
                    newH = Math.min(newH, fullVB[3]);
                }
            }
        }catch(e){}
        // recompute scale after any step adjustments
        newScale = INITIAL_VIEW_W / newW;
        if (newScale > maxScale) return;

        // enforce minimum zoom-out (don't let user zoom out beyond full content)
        if (fullVB && fullVB[2]) {
            // compute minScale if not computed yet
            try{ minScale = Math.min(1, INITIAL_VIEW_W / fullVB[2]); }catch(e){}
            if (newScale < minScale) {
                newScale = minScale;
                newW = INITIAL_VIEW_W / newScale;
                newH = initial.h / newScale;
            }
        }

        const newX = p.x - (p.x - vx) * factor;
        const newY = p.y - (p.y - vy) * factor;

        // mutate shared vb in-place so other code observes the change
        vb[0] = newX; vb[1] = newY; vb[2] = newW; vb[3] = newH;
        // clamp to full bounds so we don't keep offsets when at near-original scale
        const _clamped = clampToFull([vb[0], vb[1], vb[2], vb[3]]);
        vb[0] = _clamped[0]; vb[1] = _clamped[1]; vb[2] = _clamped[2]; vb[3] = _clamped[3];
        try { const n = svg.node(); if (n && n.setAttribute) n.setAttribute('viewBox', vb.join(' ')); else svg.attr('viewBox', vb.join(' ')); } catch(e){ try{ svg.attr('viewBox', vb.join(' ')); }catch(err){} }
        scheduleAdjustHotspots();
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

    // full viewBox used for clamping: compute from content union so panning
    // can reach true map edges even when the container size is fixed.
    // (declaration moved earlier to allow wheel handler to reference it)
    

    // Helper to mimic `object-fit: cover|contain` for SVG by choosing an
    // initial viewBox that either covers the container (crop) or contains
    // the full content (letterbox). This keeps pan/zoom clamping based on
    // the true `fullVB` while presenting a denser initial view.
    function fitFullViewBox(mode = 'cover'){
        try{
            // recompute full bounds to be safe
            const full = computeFullViewBox();
            if (!Array.isArray(full) || full.length < 4) return;
            fullVB = full.slice();
            const fw = fullVB[2] || 1;
            const fh = fullVB[3] || 1;
            const rect = svg.node().getBoundingClientRect();
            if (!rect.width || !rect.height) return;

            const contA = rect.width / rect.height;
            const fullA = fw / fh || 1;

            let targetW = fw, targetH = fh;
            if (mode === 'cover') {
                // choose the smaller axis such that the viewBox when rendered
                // will fill the container and overflow the other axis (crop)
                if (fullA > contA) { targetH = fh; targetW = fh * contA; }
                else { targetW = fw; targetH = fw / contA; }
            } else {
                // 'contain' behaviour (letterbox)
                if (fullA > contA) { targetW = fw; targetH = fw / contA; }
                else { targetH = fh; targetW = fh * contA; }
            }

            // never exceed full extents
            targetW = Math.min(targetW, fw);
            targetH = Math.min(targetH, fh);

            const tx = fullVB[0] + (fw - targetW) / 2;
            const ty = fullVB[1] + (fh - targetH) / 2;

            // apply to the shared viewBox (mutate in-place for other code)
            sharedViewBox[0] = tx; sharedViewBox[1] = ty;
            sharedViewBox[2] = targetW; sharedViewBox[3] = targetH;
            try { const nn = svg.node(); if (nn && nn.setAttribute) nn.setAttribute('viewBox', sharedViewBox.join(' ')); else svg.attr('viewBox', sharedViewBox.join(' ')); }catch(e){ try{ svg.attr('viewBox', sharedViewBox.join(' ')); }catch(err){} }
            scheduleAdjustHotspots();
        }catch(e){}
    }

    // refresh computed full bounds after layout/load and when the window resizes
    try{
        window.addEventListener('load', function(){ try{ fullVB = computeFullViewBox(); minScale = Math.min(1, INITIAL_VIEW_W / (fullVB[2] || INITIAL_VIEW_W)); fitFullViewBox('cover'); }catch(e){} }, { passive: true });
        window.addEventListener('resize', function(){ try{ fullVB = computeFullViewBox(); minScale = Math.min(1, INITIAL_VIEW_W / (fullVB[2] || INITIAL_VIEW_W)); fitFullViewBox('cover'); }catch(e){} }, { passive: true });
    }catch(e){}

    // refresh computed full bounds after layout/load and when the window resizes
    // (no dynamic recompute here — keep clamping consistent with the SVG viewBox)

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
        try{ window._map_is_panning = true; }catch(e){}
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
        // mutate the shared viewBox in-place
        vb[0] = clamped[0]; vb[1] = clamped[1]; vb[2] = clamped[2]; vb[3] = clamped[3];
        try { const n = svg.node(); if (n && n.setAttribute) n.setAttribute('viewBox', vb.join(' ')); else svg.attr('viewBox', vb.join(' ')); }catch(e){ try{ svg.attr('viewBox', vb.join(' ')); }catch(err){} }
        scheduleAdjustHotspots();
    });

    window.addEventListener('mouseup', function(e){
        if (!isPanning) return;
        isPanning = false;
        try{ window._map_is_panning = false; }catch(e){}
        startClient = null;
        vbStart = null;
        setCursorDragging(false);
        // if adjustments were deferred while panning, run one now
        try{ if (scheduleAdjustHotspots._pendingAfterPan) { scheduleAdjustHotspots._pendingAfterPan = false; scheduleAdjustHotspots(); } }catch(e){}
    });

    // set initial cursor
    setCursorDragging(false);

})();

// Populate the left-hand state list and wire click-to-focus behavior
function populateStateList(){
    try{
        const container = document.querySelector('.states');
        if (!container) return;
        container.innerHTML = '';
        // collect state elements that have ids and data-name
        const nodes = svg.selectAll('path, polygon, g[id]').nodes().filter(n => n.id && (n.getAttribute('data-name') || n.id));
        // build tuples and sort by name
        const items = nodes.map(n => ({ id: n.id, name: n.getAttribute('data-name') || n.id }));
        items.sort((a,b) => a.name.localeCompare(b.name));
        items.forEach(it => {
            const li = document.createElement('li');
            li.textContent = it.name;
            li.dataset.id = it.id;
            li.addEventListener('click', () => { focusStateById(it.id); });
            container.appendChild(li);
        });
    }catch(e){ console.error('populateStateList', e); }
}

function focusStateById(id){
    try{
        const el = document.getElementById(id);
        if (!el) return;
        // update list active state
        document.querySelectorAll('.states li').forEach(li=> li.classList.remove('active'));
        const li = document.querySelector('.states li[data-id="'+id+'"]');
        if (li) li.classList.add('active');

        // update map highlight
        svg.selectAll('.state').classed('state--active', false);
        // mark active state and refresh highlights (avoid reordering DOM nodes)
        d3.select(el).classed('state--active', true);
        try{ refreshActiveHighlights(); }catch(e){}
        try{ raiseHighlightsLayerLast(); }catch(e){}
        try{ raiseHotspotsLayerLast(); }catch(e){}

        // compute bbox and set viewBox to include the state (with padding)
        let bb = null;
        try { bb = el.getBBox(); } catch(e) { bb = null; }
        if (!bb) return;

        // padding around the state's bbox (in viewBox units)
        const padRatio = 0.22; // 22% padding relative to larger dimension
        const padX = Math.max(8, Math.max(bb.width, bb.height) * padRatio);
        const padY = padX;

        // desired box that contains the state's bbox + padding
        let desiredW = bb.width + padX * 2;
        let desiredH = bb.height + padY * 2;

        // full viewBox: prefer computed content bounds so clamping matches pan/zoom
        const full = (typeof computeFullViewBox === 'function') ? computeFullViewBox() : ((Array.isArray(vbArr) && vbArr.length >= 4) ? vbArr.slice() : [0,0,svg.node().viewBox.baseVal.width, svg.node().viewBox.baseVal.height]);
        const fullW = full[2] || 1;
        const fullH = full[3] || 1;

        // preserve SVG aspect ratio (use full aspect)
        const svgAspect = (fullW / fullH) || 1;
        const desiredAspect = desiredW / desiredH;
        if (desiredAspect > svgAspect) {
            // wider than svg -> increase height to match aspect
            desiredH = desiredW / svgAspect;
        } else {
            // taller than svg -> increase width to match aspect
            desiredW = desiredH * svgAspect;
        }

        // clamp to full extent
        desiredW = Math.min(desiredW, fullW);
        desiredH = Math.min(desiredH, fullH);

        // enforce maximum zoom-in so programmatic focus doesn't exceed limits
        try{
            const initialW = INITIAL_VIEW_W;
            if (initialW && MAX_ZOOM_SCALE > 0) {
                const minAllowedW = initialW / MAX_ZOOM_SCALE;
                if (desiredW < minAllowedW) {
                    desiredW = minAllowedW;
                    // preserve svg aspect
                    desiredH = desiredW / svgAspect;
                }
            }
        }catch(e){}

        // center target on the bbox center, then clamp so the desired box fits inside full
        const centerX = bb.x + bb.width / 2;
        const centerY = bb.y + bb.height / 2;
        let tx = centerX - desiredW / 2;
        let ty = centerY - desiredH / 2;
        tx = Math.max(full[0], Math.min(tx, full[0] + fullW - desiredW));
        ty = Math.max(full[1], Math.min(ty, full[1] + fullH - desiredH));

        // animate the viewBox change for a smoother transition and to keep sharedViewBox in sync
        animateViewBox(sharedViewBox.slice(), [tx, ty, desiredW, desiredH], 320);
    }catch(e){ console.error('focusStateById', e); }
}

// Initialize state list when DOM and SVG are ready
window.addEventListener('load', function(){ setTimeout(populateStateList, 80); });
setTimeout(populateStateList, 300);

// Smoothly animate the SVG viewBox from `from` to `to` (arrays of 4 numbers)
function animateViewBox(from, to, duration){
    try{
        const start = performance.now();
        const a = from.slice();
        const b = to.slice();
        function step(now){
            const t = Math.min(1, (now - start) / duration);
            // easeOutCubic
            const e = 1 - Math.pow(1 - t, 3);
            for (let i=0;i<4;i++) sharedViewBox[i] = a[i] + (b[i] - a[i]) * e;
            try { const n = svg.node(); if (n && n.setAttribute) n.setAttribute('viewBox', sharedViewBox.join(' ')); else svg.attr('viewBox', sharedViewBox.join(' ')); }catch(e){ try{ svg.attr('viewBox', sharedViewBox.join(' ')); }catch(err){} }
            if (t < 1) requestAnimationFrame(step);
            else scheduleAdjustHotspots();
        }
        requestAnimationFrame(step);
    }catch(e){
        // fallback: immediate set
        sharedViewBox[0]=to[0]; sharedViewBox[1]=to[1]; sharedViewBox[2]=to[2]; sharedViewBox[3]=to[3];
        try { const n = svg.node(); if (n && n.setAttribute) n.setAttribute('viewBox', sharedViewBox.join(' ')); else svg.attr('viewBox', sharedViewBox.join(' ')); }catch(e){ try{ svg.attr('viewBox', sharedViewBox.join(' ')); }catch(err){} }
        scheduleAdjustHotspots();
    }
}
