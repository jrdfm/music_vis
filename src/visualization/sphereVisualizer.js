// Sphere Visualization Mode
import * as THREE from 'three';
import { addToScene } from './threeManager.js';

// Constants
const numInstances = 2000;

// State
let spheres = null;

// Initialize spheres visualization
function initSpheres(currentSphereColor) {
    const baseGeometry = new THREE.IcosahedronGeometry(0.5, 1);
    const baseMaterial = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        emissive: 0x222222,
        specular: 0x777777,
        shininess: 30,
        transparent: true,
        opacity: 0.7
    });

    spheres = new THREE.InstancedMesh(baseGeometry, baseMaterial, numInstances);
    spheres.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const dummy = new THREE.Object3D();
    const originalPositions = [];
    const originalScales = [];
    
    for (let i = 0; i < numInstances; i++) {
        const radius = 30;
        const position = new THREE.Vector3(
            (Math.random() - 0.5) * 2 * radius,
            (Math.random() - 0.5) * 2 * radius,
            (Math.random() - 0.5) * 2 * radius
        );
        
        originalPositions.push(position.clone());
        
        dummy.position.copy(position);
        dummy.rotation.set(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);
        
        const scale = 0.5 + Math.random() * 1.5;
        dummy.scale.set(scale, scale, scale);
        originalScales.push(scale);
        
        dummy.updateMatrix();
        spheres.setMatrixAt(i, dummy.matrix);
    }

    spheres.userData = {
        originalPositions,
        originalScales
    };
    
    spheres.instanceMatrix.needsUpdate = true;

    addToScene(spheres);
    return spheres;
}

// Update spheres based on audio features
function updateSpheres(features, deltaTime, currentSphereColor) {
    if (!spheres || !(spheres instanceof THREE.InstancedMesh)) return false;

    const originalPositions = spheres.userData.originalPositions;
    const originalScales = spheres.userData.originalScales;
    
    if (spheres.material) {
        spheres.material.color = currentSphereColor;
        spheres.material.emissive.set(
            currentSphereColor.r * 0.2, 
            currentSphereColor.g * 0.2, 
            currentSphereColor.b * 0.2
        );
    }

    const bassImpact = features.bass * 2;
    const midImpact = features.mid;
    const trebleImpact = features.treble * 0.5;
    const beatBoost = features.isBeat ? 2.0 : 1.0;
    
    const dummy = new THREE.Object3D();
    
    for (let i = 0; i < spheres.count; i++) {
        const origPos = originalPositions[i];
        const origScale = originalScales[i];
        
        const freqIndex = i % 3;
        let freqImpact;
        
        switch(freqIndex) {
            case 0: freqImpact = bassImpact; break;
            case 1: freqImpact = midImpact; break;
            case 2: freqImpact = trebleImpact; break;
        }
        
        const time = performance.now() * 0.001;
        const uniqueOffset = i * 0.05;
        const pulseFactor = Math.sin(time + uniqueOffset) * 0.2 + 0.8;
        
        dummy.position.copy(origPos);
        
        dummy.position.multiplyScalar(1.0 + (freqImpact * 0.1 * pulseFactor));
        
        const targetScale = origScale * (1.0 + (freqImpact * beatBoost * 0.5));
        dummy.scale.set(targetScale, targetScale, targetScale);
        
        const rotationSpeed = 0.2 + (i % 10) * 0.01;
        dummy.rotation.x = time * rotationSpeed;
        dummy.rotation.y = time * rotationSpeed * 0.7;
        
        dummy.updateMatrix();
        spheres.setMatrixAt(i, dummy.matrix);
    }

    spheres.instanceMatrix.needsUpdate = true;
    return true;
}

// Clean up spheres
function cleanupSpheres() {
    spheres = null;
}

export { initSpheres, updateSpheres, cleanupSpheres }; 