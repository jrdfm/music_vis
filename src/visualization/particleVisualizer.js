// Particle Visualization Mode
import * as THREE from 'three';
import { addToScene } from './threeManager.js';

// Constants
const numParticles = 10000; // Increased for better effect

// State
let particles = null;
let particleVelocities = [];
let hueOffset = 0;

// Warm vibrant color ranges (similar to billboards for consistency)
const warmHues = [
    [0.95, 0.05],    // Red (wrapping around 0-1)
    [0.05, 0.15],    // Orange
    [0.15, 0.2],     // Yellow-orange
    [0.2, 0.3],      // Yellow
    [0.7, 0.85],     // Purple-pink
    [0.85, 0.95]     // Pink-red
];

// Initialize particles visualization
function initParticles(currentSphereColor) {
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(numParticles * 3);
    const colors = new Float32Array(numParticles * 3);
    particleVelocities = [];

    for (let i = 0; i < numParticles; i++) {
        const i3 = i * 3;
        const radius = 10; // Larger spread
        positions[i3] = (Math.random() - 0.5) * radius;
        positions[i3 + 1] = (Math.random() - 0.5) * radius;
        positions[i3 + 2] = (Math.random() - 0.5) * radius;
        particleVelocities.push(new THREE.Vector3((Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1));

        // Assign each particle its own warm vibrant color initially
        const hueRange = warmHues[Math.floor(Math.random() * warmHues.length)];
        const h = hueRange[0] + Math.random() * (hueRange[1] - hueRange[0]);
        const s = 0.7 + Math.random() * 0.3; // 0.7-1.0 for rich saturation
        const l = 0.5 + Math.random() * 0.3; // 0.5-0.8 for vibrant but not blinding
        
        const color = new THREE.Color();
        color.setHSL(h, s, l);
        
        colors[i3] = color.r;
        colors[i3 + 1] = color.g;
        colors[i3 + 2] = color.b;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const particleMaterial = new THREE.PointsMaterial({
        size: 0.4, // Even larger particles for better visibility
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
    });
    
    particles = new THREE.Points(particleGeometry, particleMaterial);
    addToScene(particles);
    
    return particles;
}

// Update particle colors based on audio features
function updateParticleColors(features, dt) {
    if (!particles || !particles.geometry) return;
    
    const colors = particles.geometry.attributes.color.array;
    
    // Calculate color shift based on audio features - more dramatic
    let hueShift = features ? features.bass * 0.3 : 0.01; // Increased bass influence
    let saturationBoost = features ? features.mid * 0.4 : 0; // Increased mid influence
    let brightnessBoost = features ? features.volume * 0.3 : 0; // Increased volume influence
    
    // On beat, make bigger color changes
    if (features && features.isBeat) {
        hueShift += 0.3; // Larger hue jump on beat
        brightnessBoost += 0.3; // Brighter flash on beat
        hueOffset += features.bass * 0.8; // Global hue changes
    }
    
    // Update all particle colors
    for (let i = 0; i < colors.length; i += 3) {
        // Convert RGB to HSL
        const tempColor = new THREE.Color(colors[i], colors[i+1], colors[i+2]);
        let hsl = {};
        tempColor.getHSL(hsl);
        
        // Apply shifts and variations - each particle gets a unique shift
        const particleIndex = i / 3;
        const uniqueOffset = (Math.sin(particleIndex * 0.1) * 0.5 + 0.5) * 0.15;
        
        // Dramatic hue shifting
        hsl.h = (hsl.h + hueShift * dt + uniqueOffset + hueOffset) % 1.0;
        
        // Keep colors warm and vibrant
        if (features && features.volume > 0.05) { // Lower threshold for responsiveness
            // Find the closest warm range
            let closestRange = warmHues[0];
            let minDist = 1.0;
            
            for (const range of warmHues) {
                const rangeCenter = (range[0] + range[1]) / 2;
                let dist = Math.abs(hsl.h - rangeCenter);
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
        
        // Boost saturation for vibrant colors
        hsl.s = Math.min(1.0, Math.max(0.7, hsl.s + saturationBoost));
        
        // Adjust lightness based on volume
        hsl.l = Math.min(0.9, Math.max(0.4, hsl.l + brightnessBoost));
        
        // If a beat is detected, make some particles flash
        if (features && features.isBeat && Math.random() > 0.5) {
            const beatIntensity = features.bass * features.volume;
            hsl.s = Math.min(1.0, 0.8 + beatIntensity * 0.2);
            hsl.l = Math.min(1.0, 0.7 + beatIntensity * 0.3);
        }
        
        // Apply the new color
        tempColor.setHSL(hsl.h, hsl.s, hsl.l);
        colors[i] = tempColor.r;
        colors[i+1] = tempColor.g;
        colors[i+2] = tempColor.b;
    }
    
    // Update the color buffer
    particles.geometry.attributes.color.needsUpdate = true;
}

// Update particles based on audio features
function updateParticles(features, deltaTime, currentSphereColor) {
    if (!particles || !features || !particleVelocities.length) return false;

    const positions = particles.geometry.attributes.position.array;
    if (!positions) return false;

    const beatEffect = features.isBeat ? 2.5 : 1.0; // Increased beat effect
    const dtSeconds = deltaTime / 1000;

    // Update particle colors based on audio
    updateParticleColors(features, dtSeconds);

    // Calculate overall audio energy for minimum movement during silence
    const audioEnergy = features.volume > 0.05 ? features.volume : 0.05;

    for (let i = 0; i < numParticles; i++) {
        const i3 = i * 3;
        if (i >= particleVelocities.length) continue;
        const velocity = particleVelocities[i];

        // Position/velocity updates - make more responsive to audio
        const forceMagnitude = features.volume * 0.04 * beatEffect; // Quadruple force for more responsiveness
        const currentPos = new THREE.Vector3(positions[i3], positions[i3 + 1], positions[i3 + 2]);
        
        // Add forces based on audio features - always apply some force proportional to audio
        if (currentPos.lengthSq() > 1e-6) {
            // Base push/pull force affected by volume - always applied
            const forceDir = currentPos.clone().normalize();
            velocity.add(forceDir.multiplyScalar(forceMagnitude));
            
            // Add bass-driven pulse (lower threshold to 0.3 from 0.6)
            if (features.bass > 0.3) {
                const bassPulse = features.bass * 0.04; // Double the bass influence
                velocity.add(forceDir.multiplyScalar(bassPulse));
            }
            
            // Add mid-frequency swirling (lower threshold to 0.3 from 0.5)
            if (features.mid > 0.3) {
                const swirlStrength = features.mid * 0.02; // Double the swirl strength
                const swirl = new THREE.Vector3(
                    currentPos.z * swirlStrength,
                    currentPos.x * swirlStrength,
                    -currentPos.y * swirlStrength
                );
                velocity.add(swirl);
            }
            
            // Add treble-based effects (new)
            if (features.treble > 0.3) {
                const trebleStrength = features.treble * 0.03;
                const trembleEffect = new THREE.Vector3(
                    Math.sin(currentPos.y * 0.1) * trebleStrength,
                    Math.sin(currentPos.z * 0.1) * trebleStrength,
                    Math.sin(currentPos.x * 0.1) * trebleStrength
                );
                velocity.add(trembleEffect);
            }
        }
        
        // Reduce random movement - make it proportional to audio energy
        // This ensures particles mostly move with the music
        const randomAmount = 0.003 * audioEnergy;
        velocity.x += (Math.random() - 0.5) * randomAmount;
        velocity.y += (Math.random() - 0.5) * randomAmount;
        velocity.z += (Math.random() - 0.5) * randomAmount;
        
        // Add beat effects - stronger burst on beat
        if (features.isBeat) {
            const beatDir = new THREE.Vector3(
                (Math.random() - 0.5) * 0.2,  // Doubled for more noticeable effect
                (Math.random() - 0.5) * 0.2,
                (Math.random() - 0.5) * 0.2
            );
            // Multiply by bass for stronger beats with more bass
            beatDir.multiplyScalar(features.bass * 2.0);
            velocity.add(beatDir);
        }
        
        // Apply audio-responsive damping - less damping for higher volume
        const dampingFactor = Math.pow(0.97 - (features.volume * 0.02), dtSeconds * 60);
        velocity.multiplyScalar(dampingFactor);
        
        // Update positions
        positions[i3] += velocity.x * dtSeconds * 60;
        positions[i3 + 1] += velocity.y * dtSeconds * 60;
        positions[i3 + 2] += velocity.z * dtSeconds * 60;
        
        // Reset particles that go too far - gradually pull back particles at varying rates based on position
        if (!isNaN(currentPos.x)) {
            if (currentPos.lengthSq() > 100 * 100) {
                positions[i3] = (Math.random() - 0.5) * 10;
                positions[i3 + 1] = (Math.random() - 0.5) * 10;
                positions[i3 + 2] = (Math.random() - 0.5) * 10;
                velocity.set(0,0,0);
            } else if (currentPos.lengthSq() > 50 * 50) {
                // For particles that are far but not too far, gently pull them back toward center
                const pullFactor = 0.01 * features.volume;
                velocity.sub(currentPos.clone().normalize().multiplyScalar(pullFactor));
            }
        }
    }

    // Update position buffer
    particles.geometry.attributes.position.needsUpdate = true;
    return true;
}

// Clean up particles
function cleanupParticles() {
    particles = null;
    particleVelocities = [];
    hueOffset = 0;
}

export { initParticles, updateParticles, cleanupParticles }; 