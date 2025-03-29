import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as Config from './config.js';
import { createPortal, animatePortalParticles } from './portalUtils.js'; // Import portal functions

let scene, camera, renderer, controls;
let player, playerBox; // Player object and its bounding box
let entryPortalGroup, entryPortalBox, entryPortalRefUrl; // For the entry portal if needed
let exitPortalGroup, exitPortalBox; // For the exit portal
let currentSpeed = Config.DEFAULT_SPEED; // Example speed, update this based on your game
let selfUsername = Config.DEFAULT_USERNAME; // Example username
let playerColor = Config.DEFAULT_COLOR; // Example color
const clock = new THREE.Clock(); // Clock for delta time

// Movement state
const keysPressed = {
    w: false, a: false, s: false, d: false,
    arrowup: false, arrowleft: false, arrowdown: false, arrowright: false
};

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

    // --- Player Setup (Example: Simple Cube) ---
    const playerGeometry = new THREE.BoxGeometry(1, 2, 1); // Example dimensions
    const playerMaterial = new THREE.MeshStandardMaterial({ color: playerColor }); // Use color from params
    player = new THREE.Mesh(playerGeometry, playerMaterial);
    player.position.set(Config.SPAWN_POINT_X, Config.SPAWN_POINT_Y + 1, Config.SPAWN_POINT_Z); // Position slightly above ground (Y=height/2 + ground offset)
    player.castShadow = true;
    scene.add(player);
    // Initialize player bounding box
    playerBox = new THREE.Box3().setFromObject(player);
    // --- End Player Setup ---

    // Camera initial look at player
    camera.lookAt(player.position);

    // --- Portal Creation ---
    if (cameFromPortal && refUrlParam) {
        // Create an entry portal if the user arrived via a portal
        entryPortalRefUrl = refUrlParam; // Store the return URL
        const portalLabel = `Return to ${getDomainFromUrl(entryPortalRefUrl)}`;
        // Position entry portal slightly behind spawn point
        const entryPortalPosition = new THREE.Vector3(
            Config.SPAWN_POINT_X,
            Config.SPAWN_POINT_Y + Config.PORTAL_RADIUS,
            Config.SPAWN_POINT_Z - Config.PORTAL_RADIUS * 1.5 // Behind player start
        );
        entryPortalGroup = createPortal(
            entryPortalPosition,
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

    // --- Event Listeners for Movement ---
    window.addEventListener('keydown', handleKeyDown, false);
    window.addEventListener('keyup', handleKeyUp, false);
    // --- End Event Listeners ---

    // Handle window resize
    window.addEventListener('resize', onWindowResize, false);

    // Start animation loop
    animate();
}

// --- Event Handlers ---
function handleKeyDown(event) {
    const key = event.key.toLowerCase();
    if (key in keysPressed) {
        keysPressed[key] = true;
    }
}

function handleKeyUp(event) {
    const key = event.key.toLowerCase();
    if (key in keysPressed) {
        keysPressed[key] = false;
    }
}
// --- End Event Handlers ---

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

    const delta = clock.getDelta(); // Get time since last frame

    // --- Player Movement Update ---
    if (player) {
        const moveDirection = new THREE.Vector3();
        if (keysPressed.w || keysPressed.arrowup) moveDirection.z -= 1;
        if (keysPressed.s || keysPressed.arrowdown) moveDirection.z += 1;
        if (keysPressed.a || keysPressed.arrowleft) moveDirection.x -= 1;
        if (keysPressed.d || keysPressed.arrowright) moveDirection.x += 1;

        // Normalize diagonal movement
        if (moveDirection.length() > 0) {
             moveDirection.normalize();
        }

        // Apply movement
        player.position.x += moveDirection.x * currentSpeed * delta;
        player.position.z += moveDirection.z * currentSpeed * delta;

        // Basic ground clamp (adjust based on player origin point)
        // Assuming player origin is at its base
        // if (player.position.y < Config.SPAWN_POINT_Y) {
        //     player.position.y = Config.SPAWN_POINT_Y;
        // }
        // If player origin is center, adjust y based on geometry height
        const playerHeight = player.geometry.parameters.height || 2; // Get height or default
         if (player.position.y < playerHeight / 2) {
             player.position.y = playerHeight / 2;
         }


        // Update player bounding box *after* moving
        playerBox.setFromObject(player);

        // --- Basic Camera Follow ---
        const cameraOffset = new THREE.Vector3(0, 10, 15); // Relative offset from player
        const targetPosition = player.position.clone().add(cameraOffset);
        // Smooth camera movement (lerp)
        camera.position.lerp(targetPosition, 0.1); // Adjust lerp factor for smoothness
        camera.lookAt(player.position); // Always look at the player
        // --- End Camera Follow ---

        // Optional: Visualize player bounding box for debugging
        // if (!scene.getObjectByName("playerHelper")) {
        //     const helper = new THREE.Box3Helper(playerBox, 0xffff00);
        //     helper.name = "playerHelper";
        //     scene.add(helper);
        // } else {
        //     scene.getObjectByName("playerHelper").box.copy(playerBox);
        // }
    }
    // --- End Player Movement Update ---


    // --- Portal Collision Check ---
    if (player && !enteredEntryPortal && entryPortalGroup && entryPortalBox && entryPortalRefUrl) {
        // Check Entry Portal (Return Portal)
        const playerCenter = playerBox.getCenter(new THREE.Vector3());
        const entryPortalCenter = entryPortalBox.getCenter(new THREE.Vector3());
        const distanceToEntry = playerCenter.distanceTo(entryPortalCenter);

        if (distanceToEntry < Config.PORTAL_COLLISION_THRESHOLD) {
             // console.log("Near entry portal..."); // Less spammy logs
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
             // console.log("Near exit portal..."); // Less spammy logs
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