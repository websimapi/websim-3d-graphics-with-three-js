import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as Config from './config.js';

let scene, camera, renderer, controls;
let player, playerBox; // Player object and its bounding box
let entryPortalGroup, entryPortalBox, entryPortalRefUrl; // For the entry portal if needed
let exitPortalGroup, exitPortalBox; // For the exit portal
let currentSpeed = Config.DEFAULT_SPEED; // Example speed, update this based on your game
let selfUsername = Config.DEFAULT_USERNAME; // Example username
let playerColor = Config.DEFAULT_COLOR; // Example color

const urlParams = new URLSearchParams(window.location.search);
const cameFromPortal = urlParams.get('portal') === 'true';
const refUrlParam = urlParams.get('ref');
selfUsername = urlParams.get('username') || selfUsername;
playerColor = urlParams.get('color') || playerColor;
currentSpeed = parseFloat(urlParams.get('speed')) || currentSpeed;
// Add other params as needed: avatar_url, team, speed_x/y/z, rotation_x/y/z

function init() {
    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 100, 500);

    // Camera setup
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(Config.SPAWN_POINT_X, Config.SPAWN_POINT_Y + 10, Config.SPAWN_POINT_Z + 20); // Start slightly behind spawn

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    scene.add(directionalLight);

    // Ground
    const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x228b22, side: THREE.DoubleSide });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // OrbitControls for debugging/navigation if needed
    // controls = new OrbitControls(camera, renderer.domElement);
    // controls.target.set(Config.SPAWN_POINT_X, Config.SPAWN_POINT_Y, Config.SPAWN_POINT_Z);
    // controls.update();

    // --- Player Setup (Example: Simple Cube) ---
    // Replace this with your actual player object setup
    const playerGeometry = new THREE.BoxGeometry(1, 2, 1); // Example dimensions
    const playerMaterial = new THREE.MeshStandardMaterial({ color: playerColor }); // Use color from params
    player = new THREE.Mesh(playerGeometry, playerMaterial);
    player.position.set(Config.SPAWN_POINT_X, Config.SPAWN_POINT_Y + 1, Config.SPAWN_POINT_Z); // Position slightly above ground
    player.castShadow = true;
    scene.add(player);
    // Initialize player bounding box
    playerBox = new THREE.Box3().setFromObject(player);
    // --- End Player Setup ---


    // --- Portal Creation ---
    if (cameFromPortal && refUrlParam) {
        // Create an entry portal if the user arrived via a portal
        entryPortalRefUrl = refUrlParam; // Store the return URL
        const portalLabel = `Return to ${getDomainFromUrl(entryPortalRefUrl)}`;
        entryPortalGroup = createPortal(
            new THREE.Vector3(Config.SPAWN_POINT_X, Config.SPAWN_POINT_Y + Config.PORTAL_RADIUS, Config.SPAWN_POINT_Z), // Position centered at spawn
            Config.ENTRY_PORTAL_COLOR,
            portalLabel,
            0.35, // Initial rotation X
            0 // Initial rotation Y
        );
        scene.add(entryPortalGroup);
        entryPortalBox = new THREE.Box3().setFromObject(entryPortalGroup);
        animatePortalParticles(entryPortalGroup); // Start its particle animation
        console.log("Entry portal created, returning to:", entryPortalRefUrl);
    }

    // Always create an exit portal
    exitPortalGroup = createPortal(
        new THREE.Vector3(Config.EXIT_PORTAL_POSITION.x, Config.EXIT_PORTAL_POSITION.y, Config.EXIT_PORTAL_POSITION.z),
        Config.EXIT_PORTAL_COLOR,
        Config.EXIT_PORTAL_LABEL,
        0.35, // Initial rotation X
        Math.PI / 4 // Example Y rotation
    );
    scene.add(exitPortalGroup);
    exitPortalBox = new THREE.Box3().setFromObject(exitPortalGroup);
    animatePortalParticles(exitPortalGroup); // Start its particle animation
    console.log("Exit portal created, leading to:", Config.EXIT_PORTAL_URL);
    // --- End Portal Creation ---


    // Handle window resize
    window.addEventListener('resize', onWindowResize, false);

    // Start animation loop
    animate();
}

/**
 * Creates a complete portal group (torus, inner surface, particles, label).
 */
function createPortal(position, color, labelText, rotationX = 0, rotationY = 0) {
    const portalGroup = new THREE.Group();
    portalGroup.position.copy(position);
    portalGroup.rotation.x = rotationX;
    portalGroup.rotation.y = rotationY;

    const emissiveColor = new THREE.Color(color).multiplyScalar(0.8); // Make emissive slightly less bright

    // Torus Ring
    const torusGeometry = new THREE.TorusGeometry(Config.PORTAL_RADIUS, Config.PORTAL_TUBE_RADIUS, 16, 100);
    const torusMaterial = new THREE.MeshPhongMaterial({
        color: color,
        emissive: emissiveColor,
        transparent: true,
        opacity: 0.8,
        shininess: 80
    });
    const torus = new THREE.Mesh(torusGeometry, torusMaterial);
    portalGroup.add(torus);

    // Inner Surface (Swirl Effect - Placeholder, requires shader)
    const innerGeometry = new THREE.CircleGeometry(Config.PORTAL_INNER_RADIUS, 32);
    // TODO: Add a swirling shader material later if desired
    const innerMaterial = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide
    });
    const innerSurface = new THREE.Mesh(innerGeometry, innerMaterial);
    portalGroup.add(innerSurface);

    // Particle System
    const particleCount = Config.PORTAL_PARTICLE_COUNT;
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const baseColor = new THREE.Color(color);

    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        // Distribute particles in and around the torus ring volume
        const angle = Math.random() * Math.PI * 2;
        const radius = Config.PORTAL_INNER_RADIUS + Math.random() * (Config.PORTAL_RADIUS - Config.PORTAL_INNER_RADIUS + Config.PORTAL_TUBE_RADIUS * 2); // Spread within/around torus
        const depth = (Math.random() - 0.5) * Config.PORTAL_TUBE_RADIUS * 2.5; // Spread along thickness

        positions[i3] = Math.cos(angle) * radius; // x
        positions[i3 + 1] = Math.sin(angle) * radius; // y (local to the portal plane)
        positions[i3 + 2] = depth; // z (local depth)

        // Color variation
        colors[i3] = baseColor.r * (0.8 + Math.random() * 0.4); // Add variation
        colors[i3 + 1] = baseColor.g * (0.8 + Math.random() * 0.4);
        colors[i3 + 2] = baseColor.b * (0.8 + Math.random() * 0.4);
    }

    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const particleMaterial = new THREE.PointsMaterial({
        size: Config.PORTAL_PARTICLE_SIZE,
        vertexColors: true,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending, // Brighter particles
        depthWrite: false // Prevent particles obscuring portal parts
    });

    const particleSystem = new THREE.Points(particles, particleMaterial);
    portalGroup.add(particleSystem);
    portalGroup.userData.particles = particles; // Store reference for animation

    // Portal Label
    if (labelText) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const font = 'bold 32px Arial';
        context.font = font;
        const textWidth = context.measureText(labelText).width;

        // Adjust canvas size based on text
        canvas.width = textWidth + 40; // Add some padding
        canvas.height = 64; // Keep height fixed or calculate based on font

        // Re-apply font after resize
        context.font = font;
        context.fillStyle = `#${baseColor.getHexString()}`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(labelText, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;

        const labelWidth = Config.PORTAL_RADIUS * Config.PORTAL_LABEL_WIDTH_SCALE;
        const labelHeight = Config.PORTAL_LABEL_HEIGHT;
        const labelGeometry = new THREE.PlaneGeometry(labelWidth, labelHeight);
        const labelMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false // Prevent label hiding portal parts
        });
        const labelMesh = new THREE.Mesh(labelGeometry, labelMaterial);
        labelMesh.position.y = Config.PORTAL_LABEL_Y_OFFSET; // Position above the portal
        // Make label face forward relative to portal orientation
        labelMesh.rotation.x = -portalGroup.rotation.x;
        labelMesh.rotation.y = -portalGroup.rotation.y; // Counter-rotate if portal has y-rotation
        portalGroup.add(labelMesh);
    }


    return portalGroup;
}

/**
 * Animates the particles of a given portal group.
 */
function animatePortalParticles(portalGroup) {
    if (!portalGroup || !portalGroup.userData.particles) return;

    const particles = portalGroup.userData.particles;
    const positions = particles.attributes.position.array;
    const initialPositions = new Float32Array(positions); // Store initial state if needed for complex anim
    const particleCount = positions.length / 3;

    function animateLoop() {
        const time = Date.now() * 0.001;
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            // Example animation: gentle floating/swirling
            // Use local Y and Z for movement within the portal's plane/depth
            positions[i3 + 1] += Math.sin(time + i * 0.1) * 0.02; // Adjust vertical float
            positions[i3 + 2] += Math.cos(time + i * 0.05) * 0.015; // Adjust depth float

            // Optional: Keep particles within a certain range if they drift too far
            // Example: Check distance from center if needed
        }
        particles.attributes.position.needsUpdate = true;

        // Keep animating this specific portal
        portalGroup.userData.animationFrameId = requestAnimationFrame(animateLoop);
    }
    animateLoop(); // Start the animation loop for this portal
}

/**
 * Helper to extract domain from URL for display.
 */
function getDomainFromUrl(url) {
    try {
        const parsedUrl = new URL(url);
        return parsedUrl.hostname;
    } catch (e) {
        // If URL is invalid (e.g., just a domain name was passed)
        // Remove potential protocol and path for cleaner display
        return url.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "").split('/')[0];
    }
}


/**
 * Builds the query parameter string for portal redirection.
 */
function buildPortalQueryParams(targetRefUrl = null) {
    const params = new URLSearchParams();
    params.set('username', selfUsername);
    params.set('color', playerColor);
    params.set('speed', currentSpeed.toString());
    // Add other relevant parameters here
    // params.set('avatar_url', playerAvatarUrl);
    // params.set('team', playerTeam);
    // if (playerVelocity) { // Example if you track velocity vector
    //     params.set('speed_x', playerVelocity.x);
    //     params.set('speed_y', playerVelocity.y);
    //     params.set('speed_z', playerVelocity.z);
    // }
    // if (player.rotation) {
    //     params.set('rotation_x', player.rotation.x);
    //     params.set('rotation_y', player.rotation.y);
    //     params.set('rotation_z', player.rotation.z);
    // }

    // Add the 'ref' parameter pointing back to the current game
    // Use location.origin + location.pathname to get the base URL without query params
    const currentBaseUrl = window.location.origin + window.location.pathname;
    params.set('ref', currentBaseUrl);

    // The portal redirector adds 'portal=true' automatically,
    // but we add it when returning via an *entry* portal.
    if (targetRefUrl) {
         params.set('portal', 'true'); // Signal arrival via portal for the *receiving* game
    }


    // Forward existing non-conflicting params (optional)
     urlParams.forEach((value, key) => {
         if (!params.has(key) && key !== 'portal' && key !== 'ref') { // Avoid duplicates/conflicts
             params.append(key, value);
         }
     });


    return params.toString();
}


function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

let enteredExitPortal = false; // Flag to prevent multiple redirects
let enteredEntryPortal = false; // Flag for entry portal

function animate() {
    requestAnimationFrame(animate);

    const delta = 0.016; // Assume ~60fps, replace with proper clock delta if available

    // --- Player Movement/Update Example ---
    // Replace with your game's player update logic
    // Example: Simple forward movement
    // player.translateZ(-currentSpeed * delta);
    // Update camera to follow player
    // camera.position.x = player.position.x;
    // camera.position.z = player.position.z + 20;
    // camera.position.y = player.position.y + 10;
    // camera.lookAt(player.position);
    // controls.target.copy(player.position); // Update controls target if using OrbitControls
    // controls.update();

    // Update player bounding box
    if (player) {
        playerBox.setFromObject(player);
        // Optional: Visualize player bounding box for debugging
        // if (!scene.getObjectByName("playerHelper")) {
        //     const helper = new THREE.Box3Helper(playerBox, 0xffff00);
        //     helper.name = "playerHelper";
        //     scene.add(helper);
        // } else {
        //     scene.getObjectByName("playerHelper").box.copy(playerBox);
        // }
    }
    // --- End Player Update ---


    // --- Portal Collision Check ---
    if (player && !enteredEntryPortal && entryPortalGroup && entryPortalBox && entryPortalRefUrl) {
        // Check Entry Portal (Return Portal)
        const playerCenter = playerBox.getCenter(new THREE.Vector3());
        const entryPortalCenter = entryPortalBox.getCenter(new THREE.Vector3());
        const distanceToEntry = playerCenter.distanceTo(entryPortalCenter);

        if (distanceToEntry < Config.PORTAL_COLLISION_THRESHOLD) {
             console.log("Near entry portal...");
            // More precise check: Check if player actually intersects the portal's volume
            if (playerBox.intersectsBox(entryPortalBox)) {
                console.log("Entering entry portal! Redirecting back to:", entryPortalRefUrl);
                enteredEntryPortal = true; // Prevent multiple triggers

                // Construct the return URL
                let returnUrl = entryPortalRefUrl;
                // Ensure protocol
                if (!returnUrl.startsWith('http://') && !returnUrl.startsWith('https://')) {
                    returnUrl = 'https://' + returnUrl;
                }
                const queryParams = buildPortalQueryParams(returnUrl); // Pass target to signal adding portal=true

                 // Use replace to avoid back button issues if possible, but href works too
                 window.location.replace(`${returnUrl}?${queryParams}`);
                // window.location.href = `${returnUrl}?${queryParams}`;
            }
        }
    }


    if (player && !enteredExitPortal && exitPortalGroup && exitPortalBox) {
        // Check Exit Portal (Vibeverse Portal)
        const playerCenter = playerBox.getCenter(new THREE.Vector3());
        const exitPortalCenter = exitPortalBox.getCenter(new THREE.Vector3());
        const distanceToExit = playerCenter.distanceTo(exitPortalCenter);

        if (distanceToExit < Config.PORTAL_COLLISION_THRESHOLD) {
             console.log("Near exit portal...");
            // Optional: Preload iframe (might be blocked by browsers sometimes)
            if (!document.getElementById('preloadFrame')) {
                const nextPageUrl = `${Config.EXIT_PORTAL_URL}?${buildPortalQueryParams()}`;
                console.log("Preloading:", nextPageUrl);
                const iframe = document.createElement('iframe');
                iframe.id = 'preloadFrame';
                iframe.style.display = 'none';
                iframe.src = nextPageUrl; // Load portal redirector + params
                document.body.appendChild(iframe);
            }

             // More precise check: Check if player actually intersects the portal's volume
            if (playerBox.intersectsBox(exitPortalBox)) {
                console.log("Entering exit portal! Redirecting to:", Config.EXIT_PORTAL_URL);
                enteredExitPortal = true; // Prevent multiple triggers

                const queryParams = buildPortalQueryParams();
                const finalUrl = `${Config.EXIT_PORTAL_URL}?${queryParams}`;

                // Use replace to avoid back button issues if possible
                window.location.replace(finalUrl);
                // window.location.href = finalUrl;
            }
        }
    }
    // --- End Portal Collision Check ---


    renderer.render(scene, camera);
}

// --- Initialization ---
// Check if we came from a portal - if so, skip intro/loading screens
if (cameFromPortal) {
    console.log("Came from portal, starting game immediately.");
    // Add any logic needed to bypass intro screens here
} else {
    console.log("Starting game normally.");
    // Add normal game start logic (e.g., showing a start button)
}

// Start the Three.js setup
init();

