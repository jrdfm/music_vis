// Billboards Visualization Mode - implementation of three.js particles billboards example with audio reactivity
import * as THREE from 'three';
import { addToScene } from './threeManager.js';

// State variables
let particles = null;
let particles2 = null; // Second particle system for continuous effect
let mouseX = 0, mouseY = 0;
let windowHalfX = window.innerWidth / 2;
let windowHalfY = window.innerHeight / 2;
let lastBeat = 0;
let cameraTarget = new THREE.Vector3();
let forwardSpeed = 5; // Start with a small base speed
let rotationAngle = 0;
let hueOffset = 0;

// Warm vibrant color ranges
const warmHues = [
    [0.95, 0.05],    // Red (wrapping around 0-1)
    [0.05, 0.15],    // Orange
    [0.15, 0.2],     // Yellow-orange
    [0.2, 0.3],      // Yellow
    [0.7, 0.85],     // Purple-pink
    [0.85, 0.95]     // Pink-red
];

// Helper to create a particle system with individual particle colors
function createParticleSystem(zOffset) {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const colors = [];

    // More particles, in a tube-like arrangement for better flight effect
    for (let i = 0; i < 10000; i++) {
        // Spread more along axis we're flying in (z)
        const radius = 1500;
        const phi = Math.random() * Math.PI * 2;
        const r = radius * Math.sqrt(Math.random()); // Distribute evenly in disc
        
        const x = r * Math.cos(phi);
        const y = r * Math.sin(phi);
        // z is distributed across a longer range to create a tunnel effect
        const z = 4000 * Math.random() - 2000 + zOffset;
        
        vertices.push(x, y, z);
        
        // Assign each particle a warm vibrant color
        // Select one of the warm hue ranges
        const hueRange = warmHues[Math.floor(Math.random() * warmHues.length)];
        const h = hueRange[0] + Math.random() * (hueRange[1] - hueRange[0]);
        
        // Higher saturation and lightness for vibrant colors
        const s = 0.7 + Math.random() * 0.3; // 0.7-1.0 for rich saturation
        const l = 0.5 + Math.random() * 0.3; // 0.5-0.8 for vibrant but not blinding
        
        const color = new THREE.Color();
        color.setHSL(h, s, l);
        
        // Add to colors array
        colors.push(color.r, color.g, color.b);
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    // Add colors as a buffer attribute
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    // Load disc texture
    const textureLoader = new THREE.TextureLoader();
    const sprite = textureLoader.load('src/visualization/textures/sprites/disc.png');
    sprite.colorSpace = THREE.SRGBColorSpace;
    
    // Create material - using vertex colors with more glow
    const pointMaterial = new THREE.PointsMaterial({ 
        size: 45, // Slightly larger
        sizeAttenuation: true, 
        map: sprite, 
        alphaTest: 0.15, // Lower for better glow
        transparent: true,
        blending: THREE.AdditiveBlending,
        opacity: 0.9, // Higher opacity
        vertexColors: true // Use individual colors from vertices
    });
    
    // Create particle system
    const particleSystem = new THREE.Points(geometry, pointMaterial);
    
    // Store references
    if (zOffset === 0) {
        particles = particleSystem;
    } else {
        particles2 = particleSystem;
    }
    
    return particleSystem;
}

// Initialize billboards visualization
function initBillboards() {
    // We'll keep the mouse event listeners for now as a fallback when no audio is playing
    document.body.style.touchAction = 'none';
    document.body.addEventListener('pointermove', onPointerMove);
    window.addEventListener('resize', onWindowResize);
    
    // Create particles with double density - first set
    createParticleSystem(0);
    
    // Create a second set offset from the first for continuous effect
    createParticleSystem(1500);
    
    // Add both particle systems to scene
    addToScene(particles);
    addToScene(particles2);
    
    return particles; // Return the primary particles for the visualizer system
}

// Resize handler
function onWindowResize() {
    windowHalfX = window.innerWidth / 2;
    windowHalfY = window.innerHeight / 2;
}

// Pointer handler (as fallback)
function onPointerMove(event) {
    if (event.isPrimary === false) return;
    mouseX = event.clientX - windowHalfX;
    mouseY = event.clientY - windowHalfY;
}

// Update colors for a particle system based on audio features
function updateParticleColors(particleSystem, features, dt, isSecondary = false) {
    if (!particleSystem || !particleSystem.geometry) return;
    
    const colors = particleSystem.geometry.attributes.color.array;
    
    // Calculate color shift based on audio features - more dramatic
    let hueShift = features ? features.bass * 0.2 : 0.01; // Double bass influence
    let saturationBoost = features ? features.mid * 0.3 : 0; // Triple mid influence
    let brightnessBoost = features ? features.volume * 0.2 : 0; // Double volume influence
    
    // On beat, make bigger color changes
    if (features && features.isBeat) {
        hueShift += 0.3; // Larger hue jump on beat
        brightnessBoost += 0.3; // Brighter flash on beat
        hueOffset += features.bass * 0.8; // More dramatic global hue changes
    }
    
    // Apply different offsets to create variety
    if (isSecondary) {
        hueShift = -hueShift * 1.2; // Inverse and stronger shift for second system
        hueOffset += 0.33; // Offset by 1/3 instead of 1/2 for more variation
    }
    
    // Update all particle colors
    for (let i = 0; i < colors.length; i += 3) {
        // Convert RGB to HSL
        const tempColor = new THREE.Color(colors[i], colors[i+1], colors[i+2]);
        let hsl = {};
        tempColor.getHSL(hsl);
        
        // Apply shifts and variations that depend on particle position
        // Each particle gets its own unique shifting pattern
        const particleIndex = i / 3;
        const uniqueOffset = (Math.sin(particleIndex * 0.1) * 0.5 + 0.5) * 0.15; // Increased unique offset
        
        // More dramatic hue shifting
        hsl.h = (hsl.h + hueShift * dt + uniqueOffset + hueOffset) % 1.0;
        
        // Keep colors warm and vibrant by constraining to warm ranges
        // Only apply if we have enough audio input to avoid color stagnation during silence
        if (features && features.volume > 0.1) {
            // Find the closest warm range to current hue and pull towards it
            let closestRange = warmHues[0];
            let minDist = 1.0;
            
            for (const range of warmHues) {
                // Check distance to range center
                const rangeCenter = (range[0] + range[1]) / 2;
                let dist = Math.abs(hsl.h - rangeCenter);
                // Account for wrap-around at 1.0
                if (dist > 0.5) dist = 1.0 - dist;
                
                if (dist < minDist) {
                    minDist = dist;
                    closestRange = range;
                }
            }
            
            // Pull hue toward closest range
            const targetHue = (closestRange[0] + closestRange[1]) / 2;
            hsl.h = hsl.h + (targetHue - hsl.h) * 0.05;
        }
        
        // Boost saturation - ensure colors stay vibrant
        hsl.s = Math.min(1.0, Math.max(0.7, hsl.s + saturationBoost));
        
        // Adjust lightness - more responsive to volume
        hsl.l = Math.min(0.9, Math.max(0.4, hsl.l + brightnessBoost));
        
        // If a beat is detected, make more particles flash strongly
        if (features && features.isBeat && Math.random() > 0.5) { // 50% chance instead of 30%
            const beatIntensity = features.bass * features.volume;
            hsl.s = Math.min(1.0, 0.8 + beatIntensity * 0.2); // More saturated flash
            hsl.l = Math.min(1.0, 0.7 + beatIntensity * 0.3); // Brighter flash
        }
        
        // Apply the new color
        tempColor.setHSL(hsl.h, hsl.s, hsl.l);
        colors[i] = tempColor.r;
        colors[i+1] = tempColor.g;
        colors[i+2] = tempColor.b;
    }
    
    // Update the color buffer
    particleSystem.geometry.attributes.color.needsUpdate = true;
}

// Update function - creates a smooth fly-through effect driven by audio
function updateBillboards(features, deltaTime) {
    if (!particles || !particles2) return false;
    
    // Get camera and verify it exists
    const camera = window.threeJSCamera;
    if (!camera) return false;
    
    const scene = particles.parent;
    if (!scene) return false;
    
    // Smooth deltaTime to prevent jerky movement at low framerates
    const dt = Math.min(deltaTime / 1000, 0.1);
    
    // Update particle colors based on audio
    updateParticleColors(particles, features, dt, false);
    updateParticleColors(particles2, features, dt, true);
    
    // AUDIO-DRIVEN MOVEMENT:
    if (features && features.volume > 0.05) {
        // -----------------------------------
        // CAMERA MOVEMENT
        // -----------------------------------
        // Detect beats for special effects
        if (features.isBeat) {
            lastBeat = Date.now();
            
            // Pulse forward speed on beat
            forwardSpeed += features.volume * 100;
        }
        
        // Calculate smooth forward movement speed based on volume
        const baseSpeed = 200; // Higher base speed
        const targetSpeed = baseSpeed + features.volume * 500;
        
        // More slowly approach target speed for smoother acceleration
        forwardSpeed += (targetSpeed - forwardSpeed) * 0.05;
        
        // Time since last beat affects movement
        const timeSinceBeat = Date.now() - lastBeat;
        const beatFactor = Math.max(0, 1 - timeSinceBeat / 800);
        
        // Calculate rotation based on bass but smoothed
        // This creates a gentle swaying rather than jerky motion
        const targetTurnAmount = (features.bass - 0.5) * 1.5;
        const smoothedTurn = targetTurnAmount * 0.03; // Very gentle rotation
        
        // Apply rotation with additional rotational effect on beat
        rotationAngle += smoothedTurn + (beatFactor * features.bass * 0.05);
        
        // Move camera forward along Z-axis (simpler and less disorienting)
        // This is the main movement direction for the flight effect
        camera.position.z -= forwardSpeed * dt;
        
        // Apply gentle side-to-side motion based on rotation angle
        // This creates a swaying flight path without disorienting camera rotation
        camera.position.x = Math.sin(rotationAngle) * 100;
        camera.position.y = Math.sin(rotationAngle * 0.5) * 50 + (features.mid - 0.5) * 70;
        
        // Look ahead with subtle variation on where we're looking
        const lookAhead = 300; // Look further ahead for smoother turns
        cameraTarget.set(
            camera.position.x + Math.sin(rotationAngle * 1.2) * 50,
            camera.position.y + Math.sin(rotationAngle * 0.7) * 30,
            camera.position.z - lookAhead
        );
        
        // Gradually slow down with a very gentle deceleration
        forwardSpeed *= 0.995;
        
    } else {
        // Fallback to simple gentle motion when no audio is playing
        // Maintain a steady slow forward speed
        forwardSpeed = 100;
        camera.position.z -= forwardSpeed * dt;
        
        // Gentle rotation continues even without audio
        rotationAngle += 0.05 * dt;
        
        // Simple circular path
        camera.position.x = Math.sin(rotationAngle) * 100;
        camera.position.y = Math.cos(rotationAngle) * 80;
        
        // Look ahead in direction of travel
        cameraTarget.set(
            camera.position.x + Math.sin(rotationAngle) * 20,
            camera.position.y + Math.cos(rotationAngle) * 20,
            camera.position.z - 300
        );
    }
    
    // Constantly look ahead in direction of travel
    camera.lookAt(cameraTarget);
    
    // Check if we need to move particle systems to maintain the infinite tunnel
    checkAndRepositionParticles(camera);
    
    return true;
}

// Helper to reposition particles for infinite effect
function checkAndRepositionParticles(camera) {
    // When camera passes a certain Z threshold, reposition the particle system that's behind us
    const threshold = -2000;
    
    // Check first particle system
    if (particles.position.z - camera.position.z > 1000) {
        // This system is now far behind us, move it ahead
        particles.position.z = camera.position.z - 4000;
        
        // Optionally refresh colors when repositioning for constant variation
        const colors = particles.geometry.attributes.color.array;
        for (let i = 0; i < colors.length; i += 3) {
            // Choose a warm hue range
            const hueRange = warmHues[Math.floor(Math.random() * warmHues.length)];
            const h = hueRange[0] + Math.random() * (hueRange[1] - hueRange[0]);
            
            // Rich vibrant colors
            const s = 0.7 + Math.random() * 0.3;
            const l = 0.5 + Math.random() * 0.3;
            
            const color = new THREE.Color();
            color.setHSL(h, s, l);
            
            colors[i] = color.r;
            colors[i+1] = color.g;
            colors[i+2] = color.b;
        }
        particles.geometry.attributes.color.needsUpdate = true;
    }
    
    // Check second particle system
    if (particles2.position.z - camera.position.z > 1000) {
        // This system is now far behind us, move it ahead
        particles2.position.z = camera.position.z - 4000;
        
        // Refresh colors for second system too
        const colors = particles2.geometry.attributes.color.array;
        for (let i = 0; i < colors.length; i += 3) {
            const hueRange = warmHues[Math.floor(Math.random() * warmHues.length)];
            const h = hueRange[0] + Math.random() * (hueRange[1] - hueRange[0]);
            const s = 0.7 + Math.random() * 0.3;
            const l = 0.5 + Math.random() * 0.3;
            
            const color = new THREE.Color();
            color.setHSL(h, s, l);
            
            colors[i] = color.r;
            colors[i+1] = color.g;
            colors[i+2] = color.b;
        }
        particles2.geometry.attributes.color.needsUpdate = true;
    }
    
    // If camera's gone too far negative, reset both systems
    if (camera.position.z < threshold) {
        // Reset camera Z position but maintain X and Y
        const tempX = camera.position.x;
        const tempY = camera.position.y;
        
        camera.position.set(tempX, tempY, 0);
        
        // Reposition particle systems relative to new camera position
        particles.position.z = -2000;
        particles2.position.z = -500;
        
        // Update camera target
        cameraTarget.z = camera.position.z - 300;
    }
}

// Cleanup
function cleanupBillboards() {
    if (document.body) {
        document.body.removeEventListener('pointermove', onPointerMove);
    }
    
    window.removeEventListener('resize', onWindowResize);
    
    particles = null;
    particles2 = null;
    mouseX = 0;
    mouseY = 0;
    forwardSpeed = 5;
    rotationAngle = 0;
}

export { initBillboards, updateBillboards, cleanupBillboards }; 