// Lines Visualization Mode
import * as THREE from 'three';
import { addToScene } from './threeManager.js';

// Constants
const segments = 600; // Keep reduced count for performance
const r = 800;

// State
let line = null;
let morphInfluence = 0;
let rotationX = 0;
let rotationY = 0;
let rotationZ = 0;
let lastBeatTime = 0;
let originalPositions = null; // Store original positions once at initialization
let frameCount = 0;
let expansionFactor = 1.0; // Track expansion as music progresses

// Precompute sin/cos tables (huge performance boost by avoiding trig calculations)
const SIN_TABLE_SIZE = 1000;
const sinTable = new Float32Array(SIN_TABLE_SIZE);
const cosTable = new Float32Array(SIN_TABLE_SIZE);
(function initTables() {
    for (let i = 0; i < SIN_TABLE_SIZE; i++) {
        const angle = (i / SIN_TABLE_SIZE) * Math.PI * 2;
        sinTable[i] = Math.sin(angle);
        cosTable[i] = Math.cos(angle);
    }
})();

// Fast sin/cos lookup (much faster than Math.sin/cos)
function fastSin(angle) {
    const index = ((angle % (Math.PI * 2)) / (Math.PI * 2) * SIN_TABLE_SIZE) | 0;
    return sinTable[index >= 0 ? index : index + SIN_TABLE_SIZE];
}

function fastCos(angle) {
    const index = ((angle % (Math.PI * 2)) / (Math.PI * 2) * SIN_TABLE_SIZE) | 0;
    return cosTable[index >= 0 ? index : index + SIN_TABLE_SIZE];
}

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
    
    // Store original positions once for later use
    originalPositions = new Float32Array(positions);
    
    // Generate morph targets for animation
    generateMorphTargets(geometry);
    geometry.computeBoundingSphere();

    line = new THREE.Line(geometry, material);
    
    // Scale down the initial size to be more subtle at start
    line.scale.set(0.07, 0.07, 0.07); // Reduced from 0.12
    
    // Reset expansion when initialized
    expansionFactor = 0.7; // Start smaller than 1.0
    
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

// Update lines based on audio features - heavily optimized for performance
function updateLines(features, deltaTime) {
    if (!line) return false;
    
    // Increment frame counter
    frameCount++;
    
    const dtSeconds = deltaTime / 1000;
    const now = performance.now();
    
    // Audio-reactive behavior - optimize calculations
    if (features.volume > 0.05) {
        // Update expansion factor based on audio features - FASTER expansion
        // This makes the visualization fill more of the screen as music progresses
        const targetExpansion = 1.0 + features.volume * 6.0; // Increased range to compensate for smaller start
        expansionFactor += (targetExpansion - expansionFactor) * 0.04; // Slightly slower than before
        expansionFactor = Math.min(5.5, expansionFactor); // Allow slightly larger max expansion
        
        // Direct mapping of audio features to rotation with vectorized calculation
        rotationX = features.bass * 5.0; 
        rotationY = features.mid * 4.0;  
        rotationZ = features.treble * 2.0;
        
        // Add position-based rotation to create more dynamic motion
        // Use fast trig functions
        line.position.y = fastSin(now * 0.001) * features.volume * 20; // Doubled movement
        
        // Immediate response to beats with large movements
        if (features.isBeat) {
            lastBeatTime = now;
            
            // Create dramatic movement on beat - use simpler calculations
            const beatIntensity = 1.0 + features.volume * 3; // Increased intensity
            
            // Apply dramatic rotation based on dominant frequency
            if (features.bass > features.mid && features.bass > features.treble) {
                rotationX += beatIntensity * 3.0; // More rotation
                line.position.y += beatIntensity * 10; // More displacement
                // Add extra expansion on bass beats
                expansionFactor += 0.3; // 3x more expansion on beats
            } else if (features.mid > features.treble) {
                rotationY += beatIntensity * 3.0; // More rotation
                line.position.x = (Math.random() > 0.5 ? 1 : -1) * beatIntensity * 6; // More displacement
            } else {
                rotationZ += beatIntensity * 2.5; // More rotation
                line.position.z = beatIntensity * 6; // More displacement
            }
            
            // Direct strong morph on beat
            morphInfluence = 0.9 + (features.volume * 0.5); // More morphing
        } else {
            // Even without beats, keep morphing based on bass
            morphInfluence = features.bass;
            
            // Slower return to center for more visible movement
            line.position.x *= 0.95; // Slower decay
            line.position.z *= 0.95; // Slower decay
        }
        
        // Apply rotations directly for immediate response
        line.rotation.x = rotationX;
        line.rotation.y = rotationY;
        line.rotation.z = rotationZ;
        
        // Always update ALL vertex positions for fluid movement of all lines
        updateAllVertexPositions(features, now);
        
        // Update colors EVERY FRAME to be more responsive
        updateAllColors(features);
        
    } else {
        // No audio playing - gentle continuous rotation
        rotationX = fastSin(now * 0.0005) * 0.5; // More ambient rotation
        rotationY = fastCos(now * 0.0004) * 0.5; // More ambient rotation
        rotationZ = fastSin(now * 0.0003) * 0.3; // Added Z rotation
        
        line.rotation.x = rotationX;
        line.rotation.y = rotationY;
        line.rotation.z = rotationZ;
        
        // Reset position when no audio
        line.position.set(0, 0, 0);
        
        // Gradually reduce expansion when no music - return to smaller base size
        expansionFactor *= 0.98; // Faster reduction
        if (expansionFactor < 0.7) expansionFactor = 0.7; // Match initial smaller size
        
        // Still update all vertices for silent mode
        updateAllVertexPositions(null, now);
        
        // Update colors in silent mode too
        updateAllColors({bass: 0.1, mid: 0.1, treble: 0.1, volume: 0.1, isBeat: false});
        
        // Quickly decrease morph influence when audio stops
        morphInfluence *= 0.95;
    }
    
    // Apply morph influence directly
    if (line.morphTargetInfluences && line.morphTargetInfluences.length > 0) {
        line.morphTargetInfluences[0] = Math.min(1.0, Math.abs(morphInfluence));
    }
    
    return true;
}

// Updated to ensure ALL vertices move and expand with music
function updateAllVertexPositions(features, now) {
    if (!line || !line.geometry || !originalPositions) return;
    
    const positions = line.geometry.attributes.position.array;
    
    // Pre-calculate common values outside the loop for performance
    const bassDisp = features ? features.bass * 30.0 : 1.0; // Doubled displacement
    const midDisp = features ? features.mid * 20.0 : 0.8;   // Doubled displacement
    const trbDisp = features ? features.treble * 10.0 : 0.5; // Doubled displacement
    const isBeat = features && features.isBeat;
    const beatFactor = isBeat ? features.volume * 40 : 0; // Doubled beat effect
    
    // Time factors (calculate once)
    const t1 = now * 0.001;
    const t2 = now * 0.0011;
    const t3 = now * 0.0009;
    
    // Update ALL vertices for fluid movement
    for (let i = 0; i < segments; i++) {
        const i3 = i * 3;
        
        // Get original position (faster direct array access)
        const x = originalPositions[i3] * expansionFactor; // Apply expansion
        const y = originalPositions[i3 + 1] * expansionFactor; // Apply expansion
        const z = originalPositions[i3 + 2] * expansionFactor; // Apply expansion
        
        // Faster distance approximation (Manhattan distance)
        const dist = (Math.abs(x) + Math.abs(y) + Math.abs(z)) / r; 
        
        if (features && features.volume > 0.05) {
            // Use lookup tables for sin/cos with simplified phase calc
            const px = t1 + i * 0.01;
            const py = t2 + i * 0.013;
            const pz = t3 + i * 0.017;
            
            // MORE DRAMATIC noise displacement
            const xNoise = fastSin(px) * bassDisp * dist;
            const yNoise = fastCos(py) * midDisp * dist;
            const zNoise = fastSin(pz) * trbDisp * dist;
            
            if (isBeat) {
                // Fast direction calculation
                const dirX = x > 0 ? 1 : -1;
                const dirY = y > 0 ? 1 : -1;
                const dirZ = z > 0 ? 1 : -1;
                
                // Apply movement - enhanced by expansion factor
                const localBeat = beatFactor * dist;
                positions[i3] = x + dirX * localBeat + xNoise;
                positions[i3 + 1] = y + dirY * localBeat + yNoise;
                positions[i3 + 2] = z + dirZ * localBeat + zNoise;
            } else {
                // Normal audio-reactive movement
                positions[i3] = x + xNoise;
                positions[i3 + 1] = y + yNoise;
                positions[i3 + 2] = z + zNoise;
            }
        } else {
            // More noticeable ambient movement when silent
            positions[i3] = x + fastSin(t1 * 0.5 + i * 0.05) * dist * 2.0;
            positions[i3 + 1] = y + fastCos(t2 * 0.5 + i * 0.06) * dist * 2.0;
            positions[i3 + 2] = z + fastSin(t3 * 0.5 + i * 0.07) * dist * 2.0;
        }
    }
    
    // Flag the positions as needing an update
    line.geometry.attributes.position.needsUpdate = true;
}

// Update ALL colors for better responsiveness - ENHANCED COLOR CHANGES
function updateAllColors(features) {
    if (!line || !line.geometry) return;
    
    const colors = line.geometry.attributes.color.array;
    const positions = line.geometry.attributes.position.array;
    
    // Precalculate base color values - MUCH MORE DRAMATIC COLOR CHANGES
    const bassColor = 0.3 + features.bass * 3.0;      // More range
    const midColor = 0.3 + features.mid * 3.0;        // More range
    const trebleColor = 0.3 + features.treble * 3.0;  // More range
    
    // Determine dominant frequency once
    const bassDominant = features.bass > features.mid && features.bass > features.treble;
    const midDominant = !bassDominant && features.mid > features.treble;
    
    // Beat flash calculation - STRONGER FLASH
    const beatBoost = features.isBeat ? (1.5 + features.volume * 1.5) : 0;
    
    // Update ALL colors for consistent effect
    for (let i = 0; i < segments; i++) {
        const i3 = i * 3;
        
        // Get position for intensity calculation
        const x = positions[i3];
        const y = positions[i3 + 1];
        const z = positions[i3 + 2];
        
        // Fast distance approximation
        const dist = (Math.abs(x) + Math.abs(y) + Math.abs(z)) / (r * 1.5);
        
        // Base colors - dynamic with music
        let red = bassColor;
        let green = midColor;
        let blue = trebleColor;
        
        // Apply STRONGER color emphasis based on dominant frequency
        if (bassDominant) {
            red *= 2.0;       // Was 1.5
            green *= 0.3;     // Was 0.5 - More contrast
            blue *= 0.3;      // Was 0.7 - More contrast
        } else if (midDominant) {
            green *= 2.0;     // Was 1.5
            red *= 0.3;       // Was 0.7 - More contrast
            blue *= 0.3;      // Was 0.5 - More contrast
        } else {
            blue *= 2.0;      // Was 1.5
            red *= 0.3;       // Was 0.5 - More contrast
            green *= 0.3;     // Was 0.7 - More contrast
        }
        
        // Apply intensity based on distance and expansion - MORE DRAMATIC
        const intensityFactor = 0.5 + dist * expansionFactor; // More variation
        red *= intensityFactor;
        green *= intensityFactor;
        blue *= intensityFactor;
        
        // Add beat flash - STRONGER FLASH
        if (beatBoost > 0) {
            red += beatBoost * 1.5;
            green += beatBoost * 1.5;
            blue += beatBoost * 1.5;
        }
        
        // Add some pulsing even without beats - based on frame count
        const pulse = 0.15 * fastSin(frameCount * 0.05);
        red += pulse;
        green += pulse;
        blue += pulse;
        
        // Fast clamping
        colors[i3] = red > 1 ? 1 : red;
        colors[i3 + 1] = green > 1 ? 1 : green;
        colors[i3 + 2] = blue > 1 ? 1 : blue;
    }
    
    // Flag colors for update
    line.geometry.attributes.color.needsUpdate = true;
}

// Clean up lines
function cleanupLines() {
    line = null;
    originalPositions = null;
    morphInfluence = 0;
    rotationX = 0;
    rotationY = 0;
    rotationZ = 0;
    lastBeatTime = 0;
    frameCount = 0;
    expansionFactor = 1.0;
}

export { initLines, updateLines, cleanupLines }; 