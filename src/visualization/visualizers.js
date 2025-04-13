// Visualization modes management
import * as THREE from 'three';
import { disposeObject } from './threeManager.js';

// Import visualization modes
import { initSpheres, updateSpheres, cleanupSpheres } from './sphereVisualizer.js';
import { initParticles, updateParticles, cleanupParticles } from './particleVisualizer.js';
import { initFrequencyBars, updateFrequencyBars, cleanupFrequencyBars } from './frequencyBarsVisualizer.js';
import { initWaveform, updateWaveform, cleanupWaveform } from './waveformVisualizer.js';
import { initSnowflakes, updateSnowflakes, cleanupSnowflakes } from './snowflakeVisualizer.js';
import { initBillboards, updateBillboards, cleanupBillboards } from './billboardsVisualizer.js';

// Constants for visualization
const numInstances = 2000; // For sphere mode
const numParticles = 5000; // For particle mode
const numSnowflakes = 10000; // For snowflake mode

// Current state
let currentVisMode = 'spheresAndParticles'; // Default mode
let visElements = {}; // Store references to mode-specific elements
let currentSphereColor = new THREE.Color(0x00ff00); // Default to green

// Set the current visualization mode
function setVisualizationMode(mode) {
    currentVisMode = mode;
}

// Get the current visualization mode
function getVisualizationMode() {
    return currentVisMode;
}

// Set the sphere color
function setSphereColor(colorValue) {
    currentSphereColor.set(colorValue);
}

// Get the sphere color
function getSphereColor() {
    return currentSphereColor;
}

// Clean up all visualization elements
function cleanupVisuals() {
    for (const key in visElements) {
        const element = visElements[key];
        if (element) {
            disposeObject(element);
        }
    }
    
    // Call specific cleanup functions based on current mode
    switch (currentVisMode) {
        case 'spheresAndParticles':
            // Remove cleanup for spheres, only cleanup particles
            cleanupParticles();
            break;
        case 'frequencyBars':
            cleanupFrequencyBars();
            break;
        case 'waveform':
            cleanupWaveform();
            break;
        case 'snowflakes':
            cleanupSnowflakes();
            break;
        case 'billboards':
            cleanupBillboards();
            break;
    }
    
    visElements = {}; // Clear the references
    return true;
}

// Switch between visualization modes
function switchVisualMode(newMode) {
    if (newMode === currentVisMode && Object.keys(visElements).length > 0) {
        return false; // No change needed
    }

    cleanupVisuals(); // Remove old elements from scene and dispose
    currentVisMode = newMode; // Set the new mode
    initVisualsForMode(newMode); // Initialize elements for the new mode
    return true;
}

// Initialize visuals for a specific mode
function initVisualsForMode(mode) {
    switch (mode) {
        case 'spheresAndParticles':
            // Remove initSpheres, only initialize particles
            visElements.particles = initParticles(currentSphereColor);
            break;
        case 'frequencyBars':
            visElements.frequencyBars = initFrequencyBars();
            break;
        case 'waveform':
            visElements.waveformLine = initWaveform();
            break;
        case 'snowflakes':
            const snowflakeElements = initSnowflakes();
            visElements.snowflakes = snowflakeElements;
            break;
        case 'billboards':
            visElements.billboards = initBillboards();
            break;
        default:
            console.warn(`Unknown visualization mode: ${mode}`);
            return false;
    }
    return true;
}

// Update the current visualization based on audio features
function updateVisualization(features, deltaTime) {
    if (!features) return false;

    switch (currentVisMode) {
        case 'spheresAndParticles':
            // Remove spheres update, only update particles
            return visElements.particles ? updateParticles(features, deltaTime, currentSphereColor) : false;
        case 'frequencyBars':
            return visElements.frequencyBars ? updateFrequencyBars(features, deltaTime) : false;
        case 'waveform':
            return visElements.waveformLine ? updateWaveform(features, deltaTime) : false;
        case 'snowflakes':
            return updateSnowflakes(features, deltaTime);
        case 'billboards':
            return visElements.billboards ? updateBillboards(features, deltaTime) : false;
        default:
            return false;
    }
}

export {
    setVisualizationMode,
    getVisualizationMode,
    setSphereColor,
    getSphereColor,
    cleanupVisuals,
    switchVisualMode,
    initVisualsForMode,
    updateVisualization
}; 