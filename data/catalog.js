// MAP_CATALOG — Central lookup table for all maps.
// Each key is a URL hash slug (e.g. #thailand → MAP_CATALOG['thailand']).
// Entries are loaded on demand (no preloading or hardcoded <img> tags).
// To add a map: create /images/<slug>/ with the SVG and images, then add an entry below.

const MAP_CATALOG = {

    thailand: {
        title: 'Hospital Projects in Thailand',
        svgUrl: 'images/thailand/thailand.svg',
        logoUrl: 'images/thailand/logo-02.png',
        logoAlt: 'Saikang Medical Logo',
        thumbnail: 'images/thailand/thailand.svg',   // used on landing card
        description: 'Saikang Medical hospital bed and equipment supply projects across Thailand.',

        // Geographic bounding box — must match the SVG's mapsvg:geoViewBox
        geoBounds: {
            minLon: 97.344728,
            maxLat: 20.463430,
            maxLon: 105.640023,
            minLat: 5.614417
        },

        // Per-map color scheme (HSL)
        colorConfig: {
            baseHue: 175,
            sat: '50%',
            minLight: 75,
            maxLight: 85
        },

        // Hotspots — coordinates are in SVG viewBox units
        hotspots: [
            {
                provinceId: 'TH-41',
                title: 'Kumphawapi Hospital',
                description: '180-bed hospital. Saikang supplied hospital beds, bedside tables and overbed tables for new wards.',
                x: 382.822,
                y: 231.766,
                imageUrl: 'images/thailand/udon_thani.jpg'
            },
            {
                provinceId: 'TH-36',
                title: 'Kaengkhro Hospital',
                description: 'Public hospital with 300 beds. Saikang electric beds provide safety and comfort for patients.',
                x: 331.438,
                y: 300.624,
                imageUrl: 'images/thailand/chaiyaphum.jpg'
            },
            {
                provinceId: 'TH-10',
                title: 'King Chulalongkorn Memorial Hospital',
                description: 'Public general and tertiary referral hospital with 1,435 beds. Saikang supplied medical trolleys to support clinical operations.',
                x: 215.263,
                y: 464.452,
                imageUrl: 'images/thailand/bangkok_chu.jpg'
            },
            {
                provinceId: 'TH-10',
                title: 'The Blessing Nursing Home & Rehab',
                description: 'Nursing home and rehabilitation center using Saikang electric beds to ensure daily safety and care for the elderly.',
                x: 225,
                y: 467,
                imageUrl: 'images/thailand/bangkok_bless.jpg'
            },
            {
                provinceId: 'TH-81',
                title: 'Khlong Thom Hospital',
                description: 'Multispecialty hospital using Saikang electric beds and accessories to support patient care.',
                x: 130,
                y: 870,
                imageUrl: 'images/thailand/krabi.jpg'
            }
        ]
    }
    // ── Add more maps here ──────────────────────────────────────────
    // vietnam: { title: '…', svgUrl: 'images/vietnam/vietnam.svg', … }
};
