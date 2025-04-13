// Waveform Visualization Mode
import * as THREE from 'three';
import { addToScene } from './threeManager.js';

// State
let line = null;

// Initialize waveform visualization
function initWaveform() {
    // Create a placeholder with approx numPoints
    const numPoints = 512; // Default if analyser isn't available yet
    const lineGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(numPoints * 3); // x, y, z for each point
    
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 });
    
    line = new THREE.Line(lineGeometry, lineMaterial);
    addToScene(line);
    
    return line;
}

// Update waveform based on audio features
function updateWaveform(features, deltaTime) {
    if (!line || !features) return false;
    
    const timeData = features.rawTimeDomainData;
    if (!timeData) return false;
    
    const bufferLength = timeData.length;
    const positions = line.geometry.attributes.position.array;

    const width = 50; // Width of the waveform display
    const height = 10; // Max height deviation

    for (let i = 0; i < bufferLength && i < positions.length / 3; i++) {
        const i3 = i * 3;
        const x = (i / (bufferLength - 1) - 0.5) * width;
        const y = ((timeData[i] / 128.0) - 1.0) * height;
        const z = 0;

        positions[i3] = x;
        positions[i3 + 1] = y;
        positions[i3 + 2] = z;
    }

    line.geometry.attributes.position.needsUpdate = true;
    return true;
}

// Clean up waveform
function cleanupWaveform() {
    line = null;
}

export { initWaveform, updateWaveform, cleanupWaveform }; 