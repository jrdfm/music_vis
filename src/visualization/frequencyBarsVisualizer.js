// Frequency Bars Visualization Mode
import * as THREE from 'three';
import { addToScene } from './threeManager.js';

// State
let bars = null;

// Initialize frequency bars visualization
function initFrequencyBars() {
    const numBars = 128;
    const barGeometry = new THREE.BoxGeometry(0.5, 1, 0.5);
    const barMaterial = new THREE.MeshStandardMaterial({ color: 0x00ffff });
    
    bars = new THREE.InstancedMesh(barGeometry, barMaterial, numBars);
    bars.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const dummy = new THREE.Object3D();
    const totalWidth = numBars * 0.7; // Total width they'll occupy
    
    for(let i = 0; i < numBars; i++) {
        dummy.position.set(-totalWidth / 2 + i * 0.7, 0, 0);
        dummy.scale.set(1, 0.1, 1); // Start flat
        dummy.updateMatrix();
        bars.setMatrixAt(i, dummy.matrix);
    }
    
    bars.instanceMatrix.needsUpdate = true;
    addToScene(bars);
    
    return bars;
}

// Update frequency bars based on audio features
function updateFrequencyBars(features, deltaTime) {
    if (!bars || !features) return false;
    
    const freqData = features.rawFrequencyData;
    if (!freqData) return false;
    
    const numBars = bars.count;
    const binCount = freqData.length;
    const dummy = new THREE.Object3D();

    for (let i = 0; i < numBars; i++) {
        bars.getMatrixAt(i, dummy.matrix);
        dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);

        // Map bar index to frequency data index
        const freqIndex = Math.min(binCount - 1, Math.floor((i / numBars) * (binCount * 0.8))); // Use lower 80% of freq data
        const freqValueNormalized = (freqData && freqData[freqIndex] !== undefined) ? freqData[freqIndex] / 255 : 0;

        // Update bar scale (mostly height)
        const targetScaleY = Math.max(0.1, freqValueNormalized * 20);
        // Smoothly interpolate scale for less jitter
        dummy.scale.y += (targetScaleY - dummy.scale.y) * 0.2;

        dummy.updateMatrix();
        bars.setMatrixAt(i, dummy.matrix);
    }
    
    bars.instanceMatrix.needsUpdate = true;
    return true;
}

// Clean up frequency bars
function cleanupFrequencyBars() {
    bars = null;
}

export { initFrequencyBars, updateFrequencyBars, cleanupFrequencyBars }; 