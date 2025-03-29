import * as THREE from 'three';
import * as Config from './config.js';

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
 * Creates a complete portal group (torus, inner surface, particles, label).
 */
export function createPortal(position, color, labelText, rotationX = 0, rotationY = 0) {
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
export function animatePortalParticles(portalGroup) {
    if (!portalGroup || !portalGroup.userData.particles) return;

    const particles = portalGroup.userData.particles;
    const positions = particles.attributes.position.array;
    // const initialPositions = new Float32Array(positions); // Store initial state if needed for complex anim
    const particleCount = positions.length / 3;

    function animateLoop() {
        // Stop animation if the group has been removed or animation cancelled
        if (!portalGroup.userData.particles || portalGroup.userData.cancelAnimation) {
             console.log("Stopping particle animation for portal");
             return;
        }

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
        requestAnimationFrame(animateLoop);
    }
    portalGroup.userData.cancelAnimation = false; // Ensure animation starts/continues
    animateLoop(); // Start the animation loop for this portal
}