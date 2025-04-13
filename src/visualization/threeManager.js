// Three.js visualization manager

import * as THREE from 'three';

// Three.js core objects
let scene, camera, renderer;
let isInitialized = false;

// Make camera globally accessible for visualizations
window.threeJSCamera = null;

// Initialize Three.js environment
function init(canvas) {
    if (isInitialized) return true;
    
    console.log("Initializing Three.js...");
    
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.FogExp2(0x000000, 0.0015);
    
    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.z = 50;
    
    // Make camera accessible globally
    window.threeJSCamera = camera;
    
    // Ensure canvas exists before creating renderer
    if (!canvas) {
        console.error("Canvas element not found!");
        return false;
    }
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    // Basic Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    
    const pointLight = new THREE.PointLight(0xffffff, 2, 200);
    pointLight.position.set(10, 10, 50);
    scene.add(pointLight);
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize, false);
    
    // Do an initial render
    renderer.render(scene, camera);
    
    isInitialized = true;
    console.log("Three.js initialized successfully");
    return true;
}

// Handle window resize
function onWindowResize() {
    if (!camera || !renderer) return;
    
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Add object to scene
function addToScene(object) {
    if (!scene) {
        console.error("Scene not initialized. Call init() first.");
        return false;
    }
    scene.add(object);
    return true;
}

// Remove object from scene
function removeFromScene(object) {
    if (!scene) return false;
    scene.remove(object);
    return true;
}

// Properly dispose of Three.js objects to prevent memory leaks
function disposeObject(object) {
    if (!object) return false;
    
    // Remove from scene first
    removeFromScene(object);
    
    // Dispose of geometry
    if (object.geometry) {
        object.geometry.dispose();
    }
    
    // Dispose of materials
    if (object.material) {
        if (Array.isArray(object.material)) {
            object.material.forEach(material => disposeMaterial(material));
        } else {
            disposeMaterial(object.material);
        }
    }
    
    // Special handling for different object types
    if (object instanceof THREE.InstancedMesh) {
        if (object.instanceMatrix) object.instanceMatrix.dispose();
        if (object.instanceColor) object.instanceColor.dispose();
    }
    
    // Dispose of children recursively
    if (object.children && object.children.length > 0) {
        while (object.children.length > 0) {
            disposeObject(object.children[0]);
        }
    }
    
    return true;
}

// Helper to dispose materials properly
function disposeMaterial(material) {
    if (!material) return;
    
    // Dispose textures
    for (const prop in material) {
        const value = material[prop];
        if (value && typeof value === 'object' && 'dispose' in value) {
            value.dispose();
        }
    }
    
    material.dispose();
}

// Update camera position based on mouse or touch input
function updateCamera(mouseX, mouseY) {
    if (!camera) return false;
    
    // Calculate target positions with smooth easing
    const targetX = mouseX * 0.05;
    const targetY = -mouseY * 0.05;
    
    // Smoothly move camera
    camera.position.x += (targetX - camera.position.x) * 0.1;
    camera.position.y += (targetY - camera.position.y) * 0.1;
    
    // Always look at scene center
    camera.lookAt(scene.position);
    
    return true;
}

// Render the scene
function render() {
    if (!isInitialized || !renderer || !scene || !camera) return false;
    renderer.render(scene, camera);
    return true;
}

// Clean up resources
function dispose() {
    if (renderer) {
        renderer.dispose();
    }
    
    // Clean up scene objects if needed
    if (scene) {
        scene.traverse(object => {
            disposeObject(object);
        });
    }
    
    // Remove event listener
    window.removeEventListener('resize', onWindowResize);
}

// Export module functions and objects
export {
    init,
    addToScene,
    removeFromScene,
    disposeObject,
    updateCamera,
    render,
    dispose
}; 