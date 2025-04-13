// Snowflake Visualization Mode
import * as THREE from 'three';
import { addToScene } from './threeManager.js';

// Constants
const numSnowflakes = 10000;

// State
let activeParticleSystems = [];
let backgroundParticleSystems = [];
let activeMaterials = [];
let backgroundMaterials = [];
let parameters = [];
let originalSizes = [];

// Initialize snowflakes visualization
function initSnowflakes() {
    // Create two separate geometries - one for active snowflakes, one for background
    const activeGeometry = new THREE.BufferGeometry();
    const backgroundGeometry = new THREE.BufferGeometry();
    
    const activeVertices = [];
    const backgroundVertices = [];

    // Create random positions for active snowflakes in a smaller, more visible volume
    for (let i = 0; i < numSnowflakes * 0.6; i++) {
        const x = Math.random() * 1500 - 750;
        const y = Math.random() * 1500 - 750;
        const z = Math.random() * 1500 - 750;
        activeVertices.push(x, y, z);
    }
    
    // Create random positions for background snowflakes in a larger volume
    for (let i = 0; i < numSnowflakes * 0.4; i++) {
        const x = Math.random() * 2500 - 1250;
        const y = Math.random() * 2500 - 1250;
        const z = Math.random() * 2500 - 1250;
        backgroundVertices.push(x, y, z);
    }

    activeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(activeVertices, 3));
    backgroundGeometry.setAttribute('position', new THREE.Float32BufferAttribute(backgroundVertices, 3));
    
    // Create the texture loader
    const textureLoader = new THREE.TextureLoader();
    
    // Function to set correct color space
    const assignSRGB = (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
    };

    // Load snowflake textures
    const sprite1 = textureLoader.load('src/visualization/textures/sprites/snowflake1.png', assignSRGB);
    const sprite2 = textureLoader.load('src/visualization/textures/sprites/snowflake2.png', assignSRGB);
    const sprite3 = textureLoader.load('src/visualization/textures/sprites/snowflake3.png', assignSRGB);
    const sprite4 = textureLoader.load('src/visualization/textures/sprites/snowflake4.png', assignSRGB);
    const sprite5 = textureLoader.load('src/visualization/textures/sprites/snowflake5.png', assignSRGB);
    
    // Parameters for different snowflake types [hue, saturation, lightness, texture, size]
    parameters = [
        [[1.0, 0.2, 0.5], sprite2, 20],
        [[0.95, 0.1, 0.5], sprite3, 15],
        [[0.90, 0.05, 0.5], sprite1, 10],
        [[0.85, 0, 0.5], sprite5, 8],
        [[0.80, 0, 0.5], sprite4, 5]
    ];
    
    // Reset arrays
    activeMaterials = [];
    backgroundMaterials = [];
    activeParticleSystems = [];
    backgroundParticleSystems = [];
    
    for (let i = 0; i < parameters.length; i++) {
        const color = parameters[i][0];
        const sprite = parameters[i][1];
        const size = parameters[i][2];
        
        // Create materials for active snowflakes
        const activeMaterial = new THREE.PointsMaterial({
            size: size,
            map: sprite,
            blending: THREE.AdditiveBlending,
            depthTest: false,
            transparent: true
        });
        
        // Set color with HSL
        activeMaterial.color.setHSL(color[0], color[1], color[2], THREE.SRGBColorSpace);
        activeMaterials.push(activeMaterial);
        
        // Create a particle system for this active material
        const activeParticles = new THREE.Points(activeGeometry, activeMaterial);
        
        // Apply initial random rotation
        activeParticles.rotation.x = Math.random() * 6;
        activeParticles.rotation.y = Math.random() * 6;
        activeParticles.rotation.z = Math.random() * 6;
        
        activeParticleSystems.push(activeParticles);
        addToScene(activeParticles);
        
        // Create materials for background snowflakes (slightly different)
        const backgroundMaterial = new THREE.PointsMaterial({
            size: size * 0.8, // Slightly smaller
            map: sprite,
            blending: THREE.AdditiveBlending,
            depthTest: false,
            transparent: true,
            opacity: 0.7 // More transparent
        });
        
        // Set color with HSL (slightly different hue)
        backgroundMaterial.color.setHSL(
            (color[0] + 0.1) % 1.0, 
            color[1] * 0.8, 
            color[2] * 0.9, 
            THREE.SRGBColorSpace
        );
        backgroundMaterials.push(backgroundMaterial);
        
        // Create a particle system for background material
        const backgroundParticles = new THREE.Points(backgroundGeometry, backgroundMaterial);
        
        // Apply initial random rotation
        backgroundParticles.rotation.x = Math.random() * 6;
        backgroundParticles.rotation.y = Math.random() * 6;
        backgroundParticles.rotation.z = Math.random() * 6;
        
        backgroundParticleSystems.push(backgroundParticles);
        addToScene(backgroundParticles);
    }
    
    // Store original sizes for size animation
    originalSizes = parameters.map(param => param[2]);
    
    return { 
        activeParticleSystems, 
        backgroundParticleSystems, 
        activeMaterials,
        backgroundMaterials,
        parameters,
        originalSizes
    };
}

// Update snowflakes based on audio features
function updateSnowflakes(features, deltaTime) {
    if (!activeParticleSystems.length || !backgroundParticleSystems.length) {
        return false;
    }
    
    // Calculate time factor for animation
    const time = performance.now() * 0.00005;
    
    // Check if audio is playing and meaningful
    const hasAudio = features.volume > 0.05; // Only consider audio meaningful above this threshold
    
    // Audio reactivity factors
    const bassImpact = features.bass * 5;
    const midImpact = features.mid * 4;
    const trebleImpact = features.treble * 3;
    const beatBoost = features.isBeat ? 4.0 : 1.0;
    
    // Volume-based scaling factor
    const volumeScale = hasAudio ? (0.2 + features.volume * 2) : 0.05;
    
    // Update active particle systems - these react strongly to music
    for (let i = 0; i < activeParticleSystems.length; i++) {
        const particles = activeParticleSystems[i];
        
        // CONSISTENT BASE MOVEMENT regardless of audio
        const baseRotationSpeed = 0.002 * (i + 1);
        particles.rotation.y += baseRotationSpeed;
        
        // Add additional base movement with unique patterns for each system
        particles.rotation.x += 0.001 * Math.sin(time * (i + 1) * 0.2);
        particles.rotation.z += 0.001 * Math.cos(time * (i + 0.5) * 0.2);
        
        // Add extra audio-reactive movement on top of base movement
        if (hasAudio) {
            particles.rotation.y += features.bass * 0.1 * (i + 1) * beatBoost;
            particles.rotation.x += features.bass * 0.03 * Math.sin(time);
            particles.rotation.z += features.mid * 0.02 * Math.cos(time);
        }
        
        // PULSE on beats - only when audio is playing
        if (hasAudio && features.isBeat) {
            // Create a dramatic "pulse" effect on beats
            particles.scale.set(
                1.0 + bassImpact * 0.3,
                1.0 + bassImpact * 0.3,
                1.0 + bassImpact * 0.3
            );
        } else {
            // Add subtle pulsing effect even without beats
            const pulseFactor = 1.0 + Math.sin(time * 5 * (i % 3 + 1)) * 0.05;
            // Smoothly interpolate toward pulse factor
            particles.scale.x += (pulseFactor - particles.scale.x) * 0.1;
            particles.scale.y += (pulseFactor - particles.scale.y) * 0.1;
            particles.scale.z += (pulseFactor - particles.scale.z) * 0.1;
        }
        
        // Update material colors and sizes with time and AUDIO
        if (activeMaterials[i]) {
            const color = parameters[i][0];
            
            let h, s, l;
            
            // Always have some color movement regardless of audio
            const baseHueShift = time * 0.2 * (i % 3 + 1);
            
            if (hasAudio) {
                // Audio-reactive color changes
                const hueShift = midImpact * 0.5 + baseHueShift;
                h = (360 * (color[0] + time * volumeScale + hueShift) % 360) / 360;
                s = Math.min(1.0, color[1] + bassImpact * 0.2);
                l = Math.min(1.0, color[2] * (1 + (features.isBeat ? 0.5 : 0)));
            } else {
                // Always have gentle color changes when no audio
                h = (360 * (color[0] + baseHueShift) % 360) / 360;
                s = color[1] + Math.sin(time * 2) * 0.05;
                l = color[2] + Math.cos(time * 1.5) * 0.05;
            }
            
            // Set HSL color
            activeMaterials[i].color.setHSL(h, s, l, THREE.SRGBColorSpace);
            
            // Continuously change size based on audio - not just on beats
            const originalSize = originalSizes[i];
            
            // Calculate target size
            let targetSize;
            if (hasAudio) {
                // Different size modulation based on frequency for different particles
                if (i % 3 === 0) {
                    // Bass-reactive particles
                    targetSize = originalSize * (1 + bassImpact * 0.4);
                } else if (i % 3 === 1) {
                    // Mid-reactive particles
                    targetSize = originalSize * (1 + midImpact * 0.4);
                } else {
                    // Treble-reactive particles
                    targetSize = originalSize * (1 + trebleImpact * 0.3);
                }
                
                // Add extra size on beats
                if (features.isBeat) {
                    targetSize *= 1.2;
                }
            } else {
                // Always have size changes even without audio
                const sizePulse = Math.sin(time * 3 * (i % 4 + 1)) * 0.1 + 1.0;
                targetSize = originalSize * sizePulse;
            }
            
            // Smoothly interpolate current size toward target size
            activeMaterials[i].size += (targetSize - activeMaterials[i].size) * 0.1;
        }
    }
    
    // Update background particle systems - these change more slowly but still visibly
    for (let i = 0; i < backgroundParticleSystems.length; i++) {
        const particles = backgroundParticleSystems[i];
        
        // Only move when there's audio playing
        if (hasAudio) {
            // Apply a much stronger rotation to make movement visible
            const rotationSpeed = 0.01 * (i + 1) * volumeScale;
            particles.rotation.y += (i % 2 === 0) ? rotationSpeed : -rotationSpeed;
            
            // Apply stronger audio-reactive movement
            particles.rotation.x += 0.005 * Math.sin(time) * features.bass;
            particles.rotation.z += 0.005 * Math.cos(time) * features.mid;
            
            // Apply audio-reactive position changes (incremental instead of absolute)
            if (i % 3 === 0) {
                // Bass-reactive horizontal movement
                particles.position.x += Math.sin(time * 5) * features.bass * 0.1;
                particles.position.z += Math.cos(time * 5) * features.bass * 0.1;
            } else if (i % 3 === 1) {
                // Mid-reactive vertical movement
                particles.position.y += Math.sin(time * 4) * features.mid * 0.1;
            } else {
                // Treble-reactive spiral movement
                particles.position.x += Math.sin(time * 3) * features.treble * 0.1;
                particles.position.z += Math.cos(time * 3) * features.treble * 0.1;
            }
            
            // Strong outward pulse on beats
            if (features.isBeat) {
                const direction = new THREE.Vector3(
                    particles.position.x, 
                    particles.position.y, 
                    particles.position.z
                );
                
                if (direction.length() > 0.1) {
                    direction.normalize().multiplyScalar(0.5 * bassImpact);
                    particles.position.add(direction);
                }
            }
        }
        
        // Update background material colors with subtle changes
        if (backgroundMaterials[i]) {
            const color = parameters[i][0];
            
            // Apply audio reactivity if present
            if (hasAudio) {
                const h = (360 * (color[0] + time * 0.2 * (i % 3 + 1)) % 360) / 360;
                const s = color[1] * 0.6 + features.bass * 0.2;
                const l = color[2] * 0.7 + features.volume * 0.2;
                
                backgroundMaterials[i].color.setHSL(h, s, l, THREE.SRGBColorSpace);
                
                // Size change with volume - make more dramatic
                const originalSize = originalSizes[i] * 0.8; // Larger base size
                const targetSize = originalSize * (1 + features.volume * 0.4 + (features.isBeat ? 0.4 : 0));
                backgroundMaterials[i].size += (targetSize - backgroundMaterials[i].size) * 0.2; // Faster response
            } else {
                // Default colors when no audio
                const h = (360 * color[0] % 360) / 360;
                const s = color[1] * 0.6;
                const l = color[2] * 0.7;
                backgroundMaterials[i].color.setHSL(h, s, l, THREE.SRGBColorSpace);
                
                // Return to original size very slowly
                const originalSize = originalSizes[i] * 0.6;
                backgroundMaterials[i].size += (originalSize - backgroundMaterials[i].size) * 0.01;
            }
        }
    }
    
    return true;
}

// Clean up snowflakes
function cleanupSnowflakes() {
    activeParticleSystems = [];
    backgroundParticleSystems = [];
    activeMaterials = [];
    backgroundMaterials = [];
    parameters = [];
    originalSizes = [];
}

export { initSnowflakes, updateSnowflakes, cleanupSnowflakes }; 