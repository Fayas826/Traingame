/**
 * SceneryZoneManager — Route-accurate zone system for Kollam → TVC
 *
 * The 65 km corridor is divided into 10 distinct environment zones.
 * Each zone returns the correct set of scenery assets, density, and
 * characteristic elements matching the REAL Kerala landscape.
 *
 * C# handles simulation logic; this handles rendering-zone decisions.
 */
export const ZONES = [
    {
        id: 'kollam_city',
        name: 'Kollam City',
        startKm: 0,
        endKm: 5,
        bg: 'kollam_bg',
        assets: ['cityBuilding', 'cityBuilding', 'shop_row', 'palm', 'auto', 'coconut_cluster', 'kollam_port'],
        buildingDensity: 0.8,
        treeDensity: 0.2,
        hasWater: false,
        hasMountains: false,
        spawnInterval: 130,
        skyTint: null,
    },
    {
        id: 'suburban',
        name: 'Eravipuram Suburban',
        startKm: 5,
        endKm: 10,
        bg: null,
        assets: ['kerala_house', 'kerala_house', 'palm', 'compound_wall', 'tree', 'banana_plant', 'rubber_tree'],
        buildingDensity: 0.5,
        treeDensity: 0.5,
        hasWater: false,
        hasMountains: false,
        spawnInterval: 180,
        skyTint: null,
    },
    {
        id: 'paravur_backwaters',
        name: 'Paravur Backwaters & Coastal',
        startKm: 10,
        endKm: 19,
        bg: null,
        assets: ['palm', 'palm', 'coconut_cluster', 'boat', 'wetland', 'compound_wall', 'kerala_house', 'banana_plant'],
        buildingDensity: 0.15,
        treeDensity: 0.6,
        hasWater: true,
        waterColor: 0x4a90d9,
        hasMountains: false,
        spawnInterval: 200,
        skyTint: 0xd4e8ff,
    },
    {
        id: 'edava_wetlands',
        name: 'Edavai Wetlands & Kappil',
        startKm: 19,
        endKm: 23,
        bg: null,
        assets: ['palm', 'palm', 'boat', 'wetland', 'wetland', 'kerala_house', 'banana_plant'],
        buildingDensity: 0.1,
        treeDensity: 0.65,
        hasWater: true,
        waterColor: 0x5a90a0,
        hasMountains: false,
        spawnInterval: 230,
        skyTint: 0xdcefff,
    },
    {
        id: 'varkala',
        name: 'Varkala Town',
        startKm: 23,
        endKm: 30,
        bg: null,
        assets: ['kerala_house', 'shop_row', 'palm', 'coconut_cluster', 'compound_wall', 'varkala_cliff', 'banana_plant'],
        buildingDensity: 0.55,
        treeDensity: 0.35,
        hasWater: false,
        hasMountains: false,
        spawnInterval: 160,
        skyTint: null,
        landmark: 'varkala_cliff',
    },
    {
        id: 'paddy_fields',
        name: 'Paddy Fields & Villages',
        startKm: 30,
        endKm: 50,
        bg: null,
        assets: ['palm', 'tree', 'kerala_house', 'compound_wall', 'paddy_field', 'banana_plant', 'rubber_tree', 'coconut_cluster', 'local_road'],
        buildingDensity: 0.3,
        treeDensity: 0.6,
        hasWater: false,
        paddyFields: true,
        hasMountains: false,
        spawnInterval: 200,
        skyTint: null,
    },
    {
        id: 'kazhakuttam_it',
        name: 'Kazhakkuttam IT Zone',
        startKm: 50,
        endKm: 55,
        bg: null,
        assets: ['it_building', 'it_corridor', 'it_building', 'cityBuilding', 'palm', 'ksrtc_bus', 'it_corridor'],
        buildingDensity: 0.85,
        treeDensity: 0.15,
        hasWater: false,
        hasMountains: false,
        spawnInterval: 120,
        skyTint: null,
    },
    {
        id: 'veli_lake',
        name: 'Veli Lagoon',
        startKm: 55,
        endKm: 58,
        bg: null,
        assets: ['palm', 'coconut_cluster', 'boat', 'wetland', 'veli_lagoon'],
        buildingDensity: 0.1,
        treeDensity: 0.5,
        hasWater: true,
        waterColor: 0x2d7dd2,
        hasMountains: false,
        spawnInterval: 260,
        skyTint: 0xc8e6ff,
    },
    {
        id: 'pettah',
        name: 'Pettah City',
        startKm: 58,
        endKm: 63,
        bg: null,
        assets: ['cityBuilding', 'cityBuilding', 'kerala_house', 'shop_row', 'auto'],
        buildingDensity: 0.8,
        treeDensity: 0.15,
        hasWater: false,
        hasMountains: false,
        spawnInterval: 130,
        skyTint: null,
    },
    {
        id: 'tvc_urban',
        name: 'Thiruvananthapuram Urban',
        startKm: 63,
        endKm: 66,
        bg: null,
        assets: ['it_building', 'cityBuilding', 'cityBuilding', 'shop_row'],
        buildingDensity: 0.9,
        treeDensity: 0.1,
        hasWater: false,
        hasMountains: false,
        spawnInterval: 110,
        skyTint: null,
    },
];

/**
 * Returns the zone config for a given km position.
 * Falls back to 'village_fields' if no zone matched.
 */
export function getZoneAt(km) {
    return ZONES.find(z => km >= z.startKm && km < z.endKm) || ZONES[3];
}

/**
 * Returns a random weighted asset key from the zone's asset list.
 * Assets listed multiple times have higher spawn probability.
 */
export function pickZoneAsset(zone) {
    const r = Math.floor(Math.random() * zone.assets.length);
    return zone.assets[r];
}

/**
 * Bridge type definitions per position.
 * Used by GameScene to render the correct bridge visual.
 */
export const BRIDGE_TYPES = [
    { km: 10.5, type: 'backwater', texKey: 'bridge_backwater', name: 'Paravur Lake (Ashtamudi) Bridge', waterColor: 0x4a8fca, length: 1.8 },
    { km: 16.8, type: 'canal',     texKey: 'bridge_canal',     name: 'Kallada Canal Bridge',            waterColor: 0x5a7a3a, length: 0.2 },
    { km: 17.2, type: 'backwater', texKey: 'bridge_backwater', name: 'Kappil Beach Causeway',           waterColor: 0x4a90a0, length: 1.2 },
    { km: 28.0, type: 'steel',     texKey: 'bridge_steel',     name: 'Akathumuri Steel Truss Bridge',   waterColor: 0x6b4a2a, length: 0.8 },
    { km: 34.6, type: 'canal',     texKey: 'bridge_canal',     name: 'Kadakkavur Canal Bridge',         waterColor: 0x4a7a5a, length: 0.1 },
    { km: 42.0, type: 'concrete',  texKey: 'bridge_concrete',  name: 'Murukkampuzha Bridge',            waterColor: 0x5a6a3a, length: 0.6 },
    { km: 56.5, type: 'concrete',  texKey: 'bridge_concrete',  name: 'Veli Creek Bridge',               waterColor: 0x2d7dd2, length: 0.5 },
];

/**
 * Road Over Bridge (ROB) positions — train passes UNDER these.
 */
export const ROB_POSITIONS = [
    { km: 4.2,  name: 'Kollam Bypass ROB' },
    { km: 11.0, name: 'Paravur ROB' },
    { km: 27.5, name: 'Haripad ROB' },
    { km: 51.8, name: 'Kazhakuttam Flyover' },
    { km: 57.2, name: 'Veli ROB' },
    { km: 62.0, name: 'Pettah Flyover' },
];
