// Lines Visualization Mode
import * as THREE from 'three';
import { addToScene } from './threeManager.js';

// Constants
const segments = 2000; // Reduced further for better performance
const r = 800;

// State
let line = null;
let morphInfluence = 0;
let rotationX = 0;
let rotationY = 0;
let rotationZ = 0;
let lastBeatTime = 0;

// Initialize the lines visualization
function initLines() {
    console.log("Initializing Lines visualization");
    
    const geometry = new THREE.BufferGeometry();
    const material = new THREE.LineBasicMaterial({ 
        vertexColors: true,
        linewidth: 1
    });

    const positions = [];
    const colors = [];

    // Create random points for the line vertices
    for (let i = 0; i < segments; i++) {
        const x = Math.random() * r - r / 2;
        const y = Math.random() * r - r / 2;
        const z = Math.random() * r - r / 2;

        // positions
        positions.push(x, y, z);

        // colors - initially based on position like the example
        colors.push((x / r) + 0.5);
        colors.push((y / r) + 0.5);
        colors.push((z / r) + 0.5);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    // Generate morph targets for animation
    generateMorphTargets(geometry);
    geometry.computeBoundingSphere();

    line = new THREE.Line(geometry, material);
    
    // Scale down to fit in our scene better
    line.scale.set(0.05, 0.05, 0.05);
    
    // Add to scene
    addToScene(line);
    
    return line;
}

// Generate morph targets for shape transition animation
function generateMorphTargets(geometry) {
    const data = new Float32Array(segments * 3);

    for (let i = 0, j = 0; i < segments; i++) {
        data[j++] = Math.random() * r - r / 2;
        data[j++] = Math.random() * r - r / 2;
        data[j++] = Math.random() * r - r / 2;
    }

    const morphTarget = new THREE.Float32BufferAttribute(data, 3);
    morphTarget.name = 'target1';

    geometry.morphAttributes.position = [morphTarget];
}

// Update lines based on audio features - optimized and more responsive
function updateLines(features, deltaTime) {
    if (!line) return false;
    
    const dtSeconds = deltaTime / 1000;
    const now = performance.now();
    
    // Audio-reactive behavior - much more direct and responsive
    if (features.volume > 0.05) {
        // Immediately apply audio features to rotation (no gradual interpolation)
        // Amplify all movements for more dramatic effect
        
        // Direct mapping of audio features to rotation - INCREASED MULTIPLIERS
        rotationX = features.bass * 5.0; // Much stronger bass influence
        rotationY = features.mid * 4.0;  // Stronger mid influence
        rotationZ = features.treble * 2.0; // Direct treble to Z axis
        
        // Add position-based rotation to create more dynamic motion
        // This ensures background elements also appear to move
        line.position.y = Math.sin(now * 0.001) * features.volume * 10;
        
        // Immediate response to beats with large movements
        if (features.isBeat) {
            lastBeatTime = now;
            
            // Create dramatic movement on beat
            const beatIntensity = 1.0 + features.volume * 2;
            
            // Apply dramatic rotation based on dominant frequency
            if (features.bass > features.mid && features.bass > features.treble) {
                // Bass beat - dramatic X rotation
                rotationX += beatIntensity * 2.0;
                // Add a jump effect
                line.position.y += beatIntensity * 5;
            } else if (features.mid > features.treble) {
                // Mid beat - dramatic Y rotation
                rotationY += beatIntensity * 2.0;
                // Add a sideways movement
                line.position.x = (Math.random() > 0.5 ? 1 : -1) * beatIntensity * 3;
            } else {
                // Treble beat - dramatic Z rotation
                rotationZ += beatIntensity * 1.5;
                // Add a forward movement
                line.position.z = beatIntensity * 3;
            }
            
            // Direct strong morph on beat
            morphInfluence = 0.8 + (features.volume * 0.5);
        } else {
            // Even without beats, keep morphing based on bass
            morphInfluence = features.bass * 0.9; // Higher baseline morph influence
            
            // Slowly return position to center when not on a beat
            line.position.x *= 0.9;
            line.position.z *= 0.9;
        }
        
        // Apply rotations directly - no interpolation for faster response
        line.rotation.x = rotationX;
        line.rotation.y = rotationY;
        line.rotation.z = rotationZ;
        
        // *** NEW: Directly modify vertex positions for more visible movement ***
        updateVertexPositions(features, now);
        
        // Update ALL colors for maximum impact
        updateAllColors(features);
        
    } else {
        // No audio playing - gentle continuous rotation
        rotationX = Math.sin(now * 0.0005) * 0.2;
        rotationY = Math.cos(now * 0.0004) * 0.2;
        rotationZ = 0;
        
        line.rotation.x = rotationX;
        line.rotation.y = rotationY;
        line.rotation.z = rotationZ;
        
        // Reset position when no audio
        line.position.set(0, 0, 0);
        
        // Directly modify vertex positions with gentle wobble
        updateVertexPositions(null, now);
        
        // Quickly decrease morph influence when audio stops
        morphInfluence *= 0.9;
    }
    
    // Apply morph influence directly
    if (line.morphTargetInfluences && line.morphTargetInfluences.length > 0) {
        line.morphTargetInfluences[0] = Math.min(1.0, Math.abs(morphInfluence));
    }
    
    return true;
}

// NEW FUNCTION: Update vertex positions directly to create internal movement
function updateVertexPositions(features, now) {
    if (!line || !line.geometry) return;
    
    const positions = line.geometry.attributes.position.array;
    const originalPositions = line.geometry.attributes.position.clone().array;
    
    // Calculate displacement factors based on audio
    const bassDisplacement = features ? features.bass * 15.0 : 0.5;
    const midDisplacement = features ? features.mid * 10.0 : 0.3;
    const trebleDisplacement = features ? features.treble * 5.0 : 0.2;
    
    // Each vertex moves independently based on its position and the audio
    for (let i = 0; i < segments; i++) {
        const i3 = i * 3;
        
        // Get the original position as the base
        const x = originalPositions[i3];
        const y = originalPositions[i3 + 1];
        const z = originalPositions[i3 + 2];
        
        // Distance from center influences movement amount (farther points move more)
        const distFromCenter = Math.sqrt(x*x + y*y + z*z) / (r/2);
        
        if (features && features.volume > 0.05) {
            // Audio-driven movement
            
            // Create unique, varying movements for each vertex based on position and time
            const xNoise = Math.sin(now * 0.001 + i * 0.1) * bassDisplacement * distFromCenter;
            const yNoise = Math.cos(now * 0.0011 + i * 0.13) * midDisplacement * distFromCenter;
            const zNoise = Math.sin(now * 0.0009 + i * 0.17) * trebleDisplacement * distFromCenter;
            
            // Add extra explosive movement on beat
            let beatFactor = 0;
            if (features.isBeat) {
                beatFactor = features.volume * 20 * distFromCenter;
                
                // Direction based on vertex position (create radial explosion)
                const dirX = x === 0 ? 0 : x / Math.abs(x);
                const dirY = y === 0 ? 0 : y / Math.abs(y);
                const dirZ = z === 0 ? 0 : z / Math.abs(z);
                
                positions[i3] = x + (dirX * beatFactor) + xNoise;
                positions[i3 + 1] = y + (dirY * beatFactor) + yNoise;
                positions[i3 + 2] = z + (dirZ * beatFactor) + zNoise;
            } else {
                // Normal audio-reactive movement
                positions[i3] = x + xNoise;
                positions[i3 + 1] = y + yNoise;
                positions[i3 + 2] = z + zNoise;
            }
        } else {
            // Gentle ambient movement when no audio is playing
            positions[i3] = x + Math.sin(now * 0.0005 + i * 0.05) * 2 * distFromCenter;
            positions[i3 + 1] = y + Math.cos(now * 0.0007 + i * 0.06) * 2 * distFromCenter;
            positions[i3 + 2] = z + Math.sin(now * 0.0006 + i * 0.07) * 2 * distFromCenter;
        }
    }
    
    // Flag the positions as needing an update
    line.geometry.attributes.position.needsUpdate = true;
}

// Update ALL colors every frame for maximum visual impact
function updateAllColors(features) {
    if (!line || !line.geometry) return;
    
    const colors = line.geometry.attributes.color.array;
    const positions = line.geometry.attributes.position.array;
    
    // Dramatic color effects based on audio
    const hueShift = features.volume * 3.0; // More aggressive hue shifting
    
    // Super-vibrant color values - exceeding 1.0 for more intensity
    const bassColor = 0.7 + (features.bass * 2.0);
    const midColor = 0.7 + (features.mid * 2.0);
    const trebleColor = 0.7 + (features.treble * 2.0);
    
    // Extra-vibrant beat effect
    const beatBoost = features.isBeat ? 1.0 : 0;
    
    // Update ALL colors for consistent effect
    for (let i = 0; i < segments; i++) {
        const i3 = i * 3;
        
        // Get position for spatial color variation
        const x = positions[i3];
        const y = positions[i3 + 1];
        const z = positions[i3 + 2];
        const dist = Math.sqrt(x*x + y*y + z*z) / (r/2);
        
        // Base colors from audio features
        let red = bassColor;
        let green = midColor;
        let blue = trebleColor;
        
        // Apply spatial variation based on position
        const positionFactor = (dist * 0.5) + 0.5; // 0.5-1.0 range
        
        // Dominant frequency determines color emphasis
        if (features.bass > features.mid && features.bass > features.treble) {
            // Bass dominant - red emphasis
            red *= 1.5 * positionFactor;
            green *= 0.5;
            blue *= 0.7;
        } else if (features.mid > features.treble) {
            // Mid dominant - green emphasis
            green *= 1.5 * positionFactor;
            red *= 0.7;
            blue *= 0.5;
        } else {
            // Treble dominant - blue emphasis
            blue *= 1.5 * positionFactor;
            red *= 0.5;
            green *= 0.7;
        }
        
        // Super intense beat flash
        if (features.isBeat) {
            const beatIntensity = 1.0 + features.volume;
            red += beatIntensity;
            green += beatIntensity;
            blue += beatIntensity;
        }
        
        // Apply aggressive colors, then clamp
        colors[i3] = Math.min(1.0, red);
        colors[i3 + 1] = Math.min(1.0, green);
        colors[i3 + 2] = Math.min(1.0, blue);
    }
    
    line.geometry.attributes.color.needsUpdate = true;
}

// Clean up lines
function cleanupLines() {
    line = null;
    morphInfluence = 0;
    rotationX = 0;
    rotationY = 0;
    rotationZ = 0;
    lastBeatTime = 0;
}

export { initLines, updateLines, cleanupLines }; 