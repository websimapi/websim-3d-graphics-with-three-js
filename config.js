export const SPAWN_POINT_X = 0;
export const SPAWN_POINT_Y = 5; // Slightly above ground
export const SPAWN_POINT_Z = 0;

export const EXIT_PORTAL_POSITION = { x: -50, y: 20, z: -80 };
export const EXIT_PORTAL_COLOR = 0x00ff00; // Green
export const EXIT_PORTAL_LABEL = 'VIBEVERSE PORTAL';
export const EXIT_PORTAL_URL = 'https://portal.on.websim.ai'; // Updated portal redirector URL

export const ENTRY_PORTAL_COLOR = 0xff0000; // Red

export const PORTAL_RADIUS = 15;
export const PORTAL_TUBE_RADIUS = 2;
export const PORTAL_INNER_RADIUS = PORTAL_RADIUS - PORTAL_TUBE_RADIUS;
export const PORTAL_PARTICLE_COUNT = 500;
export const PORTAL_PARTICLE_SIZE = 0.2;
export const PORTAL_COLLISION_THRESHOLD = PORTAL_RADIUS; // Distance threshold for preloading/interaction
export const PORTAL_LABEL_HEIGHT = 5;
export const PORTAL_LABEL_WIDTH_SCALE = 1.5; // Scale width based on radius
export const PORTAL_LABEL_Y_OFFSET = PORTAL_RADIUS + PORTAL_LABEL_HEIGHT;

// Player defaults (can be overridden by URL params)
export const DEFAULT_USERNAME = 'Player';
export const DEFAULT_COLOR = 'white';
export const DEFAULT_SPEED = 5; // Assuming a default speed if not provided