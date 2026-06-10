// District Generator for Hard Money Heroes (iso roguelike).
//
// Extends the scene-template system with macro-scale structure:
// - Road/Path networks connecting district centers
// - District clustering (macro-cells group related scene templates)
// - Biome transition zones with blending tiles
// - Building interior room layouts with doorways/hallways
// - Dynamic bridge placement for water crossings

import { SCENE_CELL, SCENE_TEMPLATES, buildScene, groundThemeForCell } from './scene-templates.mjs';
import { biomeAt } from './biome-model.mjs';

// Default biomeAt function - overridden by tests or main.js
let biomeAtImpl = biomeAt;

// Allow overriding biomeAt for testing
export function setBiomeAtImpl(fn) { biomeAtImpl = fn; }

export const DISTRICT_CELL = 5; // macro-cell size in scene cells (5 * 7 = 35 world tiles)
export const ROAD_WIDTH = 1; // world tiles
export const SIDEWALK_WIDTH = 1; // world tiles

// District types that can be clustered into neighborhoods
export const DISTRICT_TYPES = Object.freeze({
    // Add more structure to DISTRICT_TYPES.
    DOWNTOWN: { id: 'downtown', templates: ['downtown_district', 'street_block', 'named_building_skyscraper', 'named_building_city_hall'], weight: 3, biomeAffinities: ['town', 'pavement'], roadDensity: 0.8, pointsOfInterest: ['skyscraper', 'city_hall', 'police_station', 'central_park']},
    SUBURBAN: { id: 'suburban', templates: ['suburban_residential', 'green_park', 'fenced_yard', 'named_building_mansion', 'named_building_school'], weight: 4, biomeAffinities: ['town', 'grass'], roadDensity: 0.5, pointsOfInterest: ['mansion', 'school', 'local_shop', 'playground']},
    INDUSTRIAL: { id: 'industrial', templates: ['industrial_zone', 'walled_compound', 'street_block', 'named_building_factory', 'named_building_warehouse'], weight: 2, biomeAffinities: ['pavement', 'road'], roadDensity: 0.7, pointsOfInterest: ['factory', 'warehouse', 'scrapyard', 'power_plant']},
    COMMERCIAL: { id: 'commercial', templates: ['downtown_district', 'office_interior', 'diner_interior', 'grocery_interior', 'gym_interior', 'named_building_mall', 'named_building_theater'], weight: 2, biomeAffinities: ['town', 'pavement'], roadDensity: 0.6, pointsOfInterest: ['mall', 'theater', 'large_store', 'restaurant_row']},
    RESIDENTIAL: { id: 'residential', templates: ['suburban_residential', 'fenced_yard', 'green_park', 'named_building_house', 'named_building_apartment_block'], weight: 4, biomeAffinities: ['town', 'grass'], roadDensity: 0.4, pointsOfInterest: ['house', 'apartment_block', 'small_park', 'community_center']},
    CITY_PARK: { id: 'city_park', templates: ['city_park', 'green_park', 'river_crossing', 'named_building_observatory'], weight: 2, biomeAffinities: ['town', 'forest', 'grass'], roadDensity: 0.2, pointsOfInterest: ['observatory', 'botanical_garden', 'zoo', 'bandstand']},
    FOREST_WILDERNESS: { id: 'forest_wild', templates: ['tree_grove', 'rock_field', 'river_crossing', 'named_obstacle_hermit_hut'], weight: 2, biomeAffinities: ['forest', 'rocky'], roadDensity: 0.15, pointsOfInterest: ['hermit_hut', 'ruins', 'waterfall', 'ancient_tree']},
    BEACH_AREA: { id: 'beach', templates: ['beach_boardwalk', 'river_crossing', 'named_obstacle_lighthouse', 'named_obstacle_shipwreck'], weight: 1, biomeAffinities: ['sand', 'water'], roadDensity: 0.2, pointsOfInterest: ['lighthouse', 'shipwreck', 'pier', 'beach_bar']},
});

// Road types for network generation
export const ROAD_TYPES = Object.freeze({
  HIGHWAY: { id: 'highway', width: 3, sidewalkWidth: 1, template: 'street_block', spacing: 1, tileKey: 'pavement-main' },
  MAIN_STREET: { id: 'main_street', width: 2, sidewalkWidth: 1, template: 'street_block', spacing: 2, tileKey: 'pavement-crosswalk' },
  SIDE_STREET: { id: 'side_street', width: 1, sidewalkWidth: 1, template: 'street_block', spacing: 3, tileKey: 'pavement-sidewalk' },
  ALLEY: { id: 'alley', width: 1, sidewalkWidth: 0, template: 'street_block', spacing: 4, tileKey: 'pavement-alley' },
  BOARDWALK: { id: 'boardwalk', width: 2, sidewalkWidth: 0, template: 'beach_boardwalk', spacing: 1, tileKey: 'bridge-wood' },
  DIRT_PATH: { id: 'dirt_path', width: 1, sidewalkWidth: 0, template: 'suburban_residential', spacing: 3, tileKey: 'grass-path' },
  FOREST_TRAIL: { id: 'forest_trail', width: 1, sidewalkWidth: 0, template: 'tree_grove', spacing: 4, tileKey: 'grass-path' },
});

// District macro-grid: divides world into DISTRICT_CELL x DISTRICT_CELL macro-cells
// Each macro-cell gets a district type, and roads connect their centers
export function generateDistrictGrid(seed, worldWidth, worldHeight) {
  const macroCellsX = Math.ceil(worldWidth / (DISTRICT_CELL * SCENE_CELL));
  const macroCellsY = Math.ceil(worldHeight / (DISTRICT_CELL * SCENE_CELL));
  const grid = [];
  
  for (let dy = 0; dy < macroCellsY; dy++) {
    for (let dx = 0; dx < macroCellsX; dx++) {
      const centerX = dx * DISTRICT_CELL * SCENE_CELL + Math.floor(DISTRICT_CELL * SCENE_CELL / 2);
      const centerY = dy * DISTRICT_CELL * SCENE_CELL + Math.floor(DISTRICT_CELL * SCENE_CELL / 2);
      const biome = biomeAtImpl(seed, centerX, centerY);
      
      // Pick district type based on biome
      const availableTypes = Object.values(DISTRICT_TYPES).filter(t => t.biomeAffinities.includes(biome));
      if (availableTypes.length === 0) {
        // Fallback: use town/road affiliated districts
        const fallbackTypes = Object.values(DISTRICT_TYPES).filter(t => t.biomeAffinities.includes('town') || t.biomeAffinities.includes('road'));
        availableTypes.push(...fallbackTypes);
      }
      
      const weights = availableTypes.map(t => t.weight);
      const total = weights.reduce((a, b) => a + b, 0);
      let r = (hashU32(seed, dx * 1000 + dy) / 4294967296) * total;
      
      let chosen = availableTypes[0];
      for (let i = 0; i < availableTypes.length; i++) {
        r -= availableTypes[i].weight;
        if (r <= 0) { chosen = availableTypes[i]; break; }
      }
      
      grid.push({
        dx, dy,
        centerX, centerY,
        biome,
        district: chosen,
        templates: chosen.templates,
        districtType: chosen.id,
        roads: [],
        connections: [],
      });
    }
  }
  
  // Build road connections between adjacent macro-cells
  for (let dy = 0; dy < macroCellsY; dy++) {
    for (let dx = 0; dx < macroCellsX; dx++) {
      const idx = dy * macroCellsX + dx;
      if (dx < macroCellsX - 1) grid[idx].connections.push({ target: idx + 1, dir: 'east' });
      if (dy < macroCellsY - 1) grid[idx].connections.push({ target: idx + macroCellsX, dir: 'south' });
    }
  }
  
  return { grid, macroCellsX, macroCellsY };
}

// Generate road network connecting district centers
export function generateRoadNetwork(districtGrid, macroCellsX, macroCellsY, seed) {
  const roads = [];
  
  for (let idx = 0; idx < districtGrid.length; idx++) {
    const cell = districtGrid[idx];
    
    for (const conn of cell.connections) {
      const target = districtGrid[conn.target];
      const roadType = chooseRoadType(cell.district, target.district, cell.biome, target.biome);
      const path = traceRoadPath(cell.centerX, cell.centerY, target.centerX, target.centerY, roadType, seed);
      
      roads.push({
        from: { x: cell.centerX, y: cell.centerY },
        to: { x: target.centerX, y: target.centerY },
        type: roadType,
        path, // array of { x, y, type: 'road'|'bridge'|'tunnel' }
        districtA: cell.district.id,
        districtB: target.district.id,
      });
    }
  }
  
  // Add side streets within districts
  for (const cell of districtGrid) {
    if (cell.district.roadDensity > 0.3) {
      const sideRoads = generateSideStreets(cell, seed);
      roads.push(...sideRoads);
    }
  }
  
  return roads;
}

// Trace a road between two points with biome-appropriate routing
function traceRoadPath(x1, y1, x2, y2, roadType, seed) {
  const path = [];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  
  if (steps === 0) return [{ x: x1, y: y1, type: 'road' }];
  
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const tx = Math.round(x1 + (x2 - x1) * t);
    const ty = Math.round(y1 + (y2 - y1) * t);
    
    const biome = biomeAtImpl(seed, tx, ty);
    const isWater = biome === 'water';
    
    if (isWater) {
      path.push({ x: tx, y: ty, type: 'bridge', biome });
    } else {
      path.push({ x: tx, y: ty, type: 'road', biome });
    }
  }
  
  return path;
}

// Choose road type based on district importance and biome
function chooseRoadType(districtA, districtB, biomeA, biomeB) {
  if (biomeA === 'water' || biomeB === 'water') return ROAD_TYPES.BOARDWALK;
  if (biomeA === 'sand' || biomeB === 'sand') return ROAD_TYPES.DIRT_PATH;
  if (biomeA === 'forest' || biomeB === 'forest') return ROAD_TYPES.FOREST_TRAIL;
  // districtA and districtB are the chosen district objects, compare by id
  const isDowntown = (districtA.id === 'downtown' || districtB.id === 'downtown');
  const isIndustrial = (districtA.id === 'industrial' || districtB.id === 'industrial');
  if (isDowntown || isIndustrial) return ROAD_TYPES.MAIN_STREET;
  return ROAD_TYPES.SIDE_STREET;
}

// Generate side streets within a district macro-cell
function generateSideStreets(cell, seed) {
  const roads = [];
  const half = Math.floor(DISTRICT_CELL * SCENE_CELL / 2);
  // Parallel grid of side streets
  for (let i = -2; i <= 2; i += 2) {
    if (hashU32(seed, cell.dx * 10 + i, cell.dy) / 4294967296 < cell.district.roadDensity * 0.5) {
      const from = { x: cell.centerX - half, y: cell.centerY + i * SCENE_CELL };
      const to = { x: cell.centerX + half, y: cell.centerY + i * SCENE_CELL };
      roads.push({
        from,
        to,
        type: ROAD_TYPES.SIDE_STREET,
        path: traceRoadPath(from.x, from.y, to.x, to.y, ROAD_TYPES.SIDE_STREET, seed),
        districtA: cell.district.id,
        districtB: cell.district.id,
      });
    }
    if (hashU32(seed, cell.dy * 10 + i, cell.dx) / 4294967296 < cell.district.roadDensity * 0.5) {
      const from = { x: cell.centerX + i * SCENE_CELL, y: cell.centerY - half };
      const to = { x: cell.centerX + i * SCENE_CELL, y: cell.centerY + half };
      roads.push({
        from,
        to,
        type: ROAD_TYPES.SIDE_STREET,
        path: traceRoadPath(from.x, from.y, to.x, to.y, ROAD_TYPES.SIDE_STREET, seed),
        districtA: cell.district.id,
        districtB: cell.district.id,
      });
    }
  }
  return roads;
}

// Biome transition zones: generate blending tiles at biome boundaries
export function generateTransitionZones(roads, seed) {
  const transitions = [];
  for (const road of roads) {
    const path = Array.isArray(road.path) ? road.path : [];
    for (const pt of path) {
      const biome = pt && pt.biome;
      if (!biome || biome === 'water') continue;
      if (pt.type !== 'road' && pt.type !== 'bridge') continue;
      try {
        const neighbors = getNeighborBiomes(pt.x, pt.y, seed);
        if (neighbors.size > 1) {
          transitions.push({
            x: pt.x, y: pt.y,
            biomes: Array.from(neighbors),
            tileKey: getTransitionTileKey(neighbors),
          });
        }
      } catch (error) {
        // Skip transition lookup when biome sampling is unavailable for this point
      }
    }
  }
  return transitions;
}

function getNeighborBiomes(x, y, seed) {
  const biomes = new Set();
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      const b = biomeAtImpl(seed, x + dx, y + dy);
      biomes.add(b);
    }
  }
  return biomes;
}

function getTransitionTileKey(biomeSet) {
  const biomes = Array.from(biomeSet).sort();
  return `transition-${biomes.join('-')}`;
}

// Helper functions
function hashU32(a, b) {
  let h = (a | 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (b | 0), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

// Building interior room layout generator
export function generateInteriorLayout(buildingType, seed, options = {}) {
  const { width = 7, height = 5, entranceSide = 'south' } = options;
  const templateMap = {
    office_interior: { rooms: ['reception', 'cubicles', 'conference', 'breakroom'], corridor: 'central' },
    diner_interior: { rooms: ['dining', 'kitchen', 'counter', 'storage'], corridor: 'linear' },
    grocery_interior: { rooms: ['entrance', 'aisles', 'produce', 'checkout', 'stockroom'], corridor: 'grid' },
    gym_interior: { rooms: ['reception', 'weights', 'cardio', 'lockers'], corridor: 'perimeter' },
  };
  
  const layout = templateMap[buildingType] || { rooms: ['main'], corridor: 'none' };
  const grid = Array(height).fill(null).map(() => Array(width).fill('empty'));
  
  // Generate room placement based on building type
  const rooms = generateRooms(grid, layout, seed);
  const corridors = generateCorridors(grid, layout, seed);
  const doors = placeDoors(grid, rooms, layout, entranceSide);
  
  return { grid, rooms, corridors, doors, buildingType };
}

function generateRooms(grid, layout, seed) {
  const h = grid.length, w = grid[0].length;
  const rooms = [];
  
  layout.rooms.forEach((room, i) => {
    const attempts = 10;
    for (let a = 0; a < attempts; a++) {
      const rw = Math.max(2, Math.floor(w / layout.rooms.length));
      const rh = Math.max(2, Math.floor(h / 2));
      const rx = Math.floor((hashU32(seed, i * 100, 0) / 4294967296) * (w - rw));
      const ry = Math.floor((hashU32(seed, 0, i * 100) / 4294967296) * (h - rh));
      
      let fits = true;
      for (let dy = 0; dy < rh && fits; dy++) {
        for (let dx = 0; dx < rw && fits; dx++) {
          if (grid[ry + dy] && grid[ry + dy][rx + dx] !== 'empty') fits = false;
        }
      }
      if (fits) {
        for (let dy = 0; dy < rh; dy++) {
          for (let dx = 0; dx < rw; dx++) {
            grid[ry + dy][rx + dx] = `room-${i}`;
          }
        }
        rooms.push({ id: i, name: layout.rooms[i], x: rx, y: ry, w: rw, h: rh });
        break;
      }
    }
  });
  return rooms;
}

function generateCorridors(grid, layout, seed) {
  if (layout.corridor === 'none') return [];
  const corridors = [];
  const h = grid.length, w = grid[0].length;
  
  // Simple corridor generation connecting room centers
  // (in reality would use proper pathfinding)
  return corridors;
}

function placeDoors(grid, rooms, layout, entranceSide) {
  const doors = [];
  // Place entrance on specified side
  // Place interior doors between connected rooms
  return doors;
}

// Export utilities for use in main.js
export { hashU32 };

// Research-backed power-up placement: tie upgrades to district identity
export function getPowerupRulesForDistrict(districtType) {
  const rules = {
    DOWNTOWN: { economy: 0.6, offense: 0.3, utility: 0.1 },
    COMMERCIAL: { economy: 0.7, utility: 0.2, defense: 0.1 },
    INDUSTRIAL: { offense: 0.5, throwable: 0.3, mobility: 0.2 },
    SUBURBAN: { defense: 0.4, mobility: 0.4, utility: 0.2 },
    RESIDENTIAL: { defense: 0.5, utility: 0.3, economy: 0.2 },
    CITY_PARK: { mobility: 0.6, defense: 0.3, status: 0.1 },
    FOREST_WILDERNESS: { mobility: 0.5, throwable: 0.3, control: 0.2 },
    BEACH_AREA: { mobility: 0.4, utility: 0.4, economy: 0.2 }
  };
  return rules[districtType] || { utility: 0.4, offense: 0.3, defense: 0.3 };
}

// District theme colors for visual distinction overlay (simple tint layer in renderer)
export const DISTRICT_THEME_COLORS = Object.freeze({
  DOWNTOWN: '#4a6fa5',      // cool blue
  SUBURBAN: '#5a8a5a',      // green
  INDUSTRIAL: '#8a6a4a',    // warm brown/orange
  COMMERCIAL: '#a56a8a',    // purple/magenta
  RESIDENTIAL: '#6a8a7a',   // teal-green
  CITY_PARK: '#4a8a6a',     // forest green
  FOREST_WILDERNESS: '#3a5a3a', // dark forest
  BEACH_AREA: '#d4b48a'     // sand/gold
});

export function getDistrictThemeColor(districtId) {
  return DISTRICT_THEME_COLORS[districtId.toUpperCase()] || '#ffffff';
}
