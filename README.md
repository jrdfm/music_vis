# Audio Visualizer

A modern, feature-rich audio visualizer built with Three.js that renders real-time audio-reactive visualizations. This application analyzes the frequency and time-domain data from audio files to generate stunning visual effects that respond to music.

## Features

- Multiple visualization modes (Particles, Frequency Bars, Waveform, Snowflakes, Billboards, Lines)
- Beat detection for synchronized visual effects
- Audio frequency spectrum analysis
- Smooth playback controls with progress bar and seeking
- Interactive camera controls
- Color customization

## How to Run the Project

### Local Development Server

1. **Clone the repository:**
   ```bash
   git clone [repository-url]
   cd audio-visualizer
   ```

2. **Set up a local server:**
   Since the project uses ES modules and the Fetch API, you need to run it on a local server.

   Using Node.js and `http-server`:
   ```bash
   npm install -g http-server
   http-server -p 8000
   ```

   Using Python:
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Python 2
   python -m SimpleHTTPServer 8000
   ```

3. **Open in browser:**
   Navigate to `http://localhost:8000` in your web browser

### Running Without a Server

If you need to run the visualizer without setting up a server:
1. Open `index.html` directly in a browser that allows file access for ES modules (Firefox works best for this)
2. Alternatively, use a browser extension that enables CORS for local files

### Browser Compatibility

The visualizer requires a modern browser with support for:
- Web Audio API
- ES6 Modules
- WebGL

Tested on: Chrome 90+, Firefox 88+, Edge 90+, Safari 14+

## Data Flow Architecture

The application follows this data flow:

1. **Audio Input** → The user selects an audio file which is loaded via `FileReader`
2. **Audio Decoding** → `AudioContext.decodeAudioData()` processes the raw file into an audio buffer
3. **Audio Processing** → The `audioProcessor.js` module analyzes the audio using:
   - `AnalyserNode` with FFT for frequency and time domain data
   - Custom algorithms for beat detection and feature extraction
4. **Data Transformation** → Raw audio data is converted into normalized features:
   - Bass, mid, treble frequency bands
   - Overall volume
   - Beat detection (boolean)
   - Raw frequency and time domain data for advanced processing
5. **Visualization Update** → The active visualizer receives these features via the `visualizers.js` module
6. **Three.js Rendering** → The visualizer updates Three.js objects which are rendered to the canvas
7. **UI Updates** → Playback progress, time display, and controls are updated by `uiManager.js`

This entire process happens within each animation frame to ensure smooth visual feedback.

## Technical Implementation

### Core Architecture

The application follows a modular architecture with clear separation of concerns:

- `src/main.js` - Application entry point and orchestration
- `src/audio/audioProcessor.js` - Audio analysis and feature extraction
- `src/ui/uiManager.js` - UI controls and event handling
- `src/visualization/threeManager.js` - Three.js scene management
- `src/visualization/visualizers.js` - Visualization mode switching

Visualizations are implemented as independent modules:
- `particleVisualizer.js`
- `frequencyBarsVisualizer.js`
- `waveformVisualizer.js`
- `snowflakeVisualizer.js`
- `billboardsVisualizer.js`
- `linesVisualizer.js`

### Audio Processing

Audio analysis is performed using the Web Audio API. The application extracts frequency data and time-domain samples to calculate features like bass, mid, treble, volume, and beat detection.

```javascript
// Key audio features calculation
function calculateAudioFeatures() {
    let bass = 0, mid = 0, treble = 0, volume = 0;
    const bufferLength = analyser.frequencyBinCount;
    const bassEnd = Math.floor(bufferLength * 0.1);     // Low frequencies (0-10%)
    const midEnd = Math.floor(bufferLength * 0.5);      // Mid frequencies (10-50%)
    // Treble is the rest (50-100%)
    
    let currentEnergy = 0;

    // Calculate average values for each frequency range
    for (let i = 0; i < bufferLength; i++) {
        const freqValue = frequencyDataArray[i];
        volume += freqValue;
        currentEnergy += freqValue * freqValue;

        if (i < bassEnd) {
            bass += freqValue;
        } else if (i < midEnd) {
            mid += freqValue;
        } else {
            treble += freqValue;
        }
    }

    // Calculate beat detection by comparing current energy to recent history
    let isBeat = false;
    if (energyHistory.length > 0) {
        let avgEnergy = energyHistory.reduce((sum, val) => sum + val, 0) / energyHistory.length;
        if (currentEnergy > avgEnergy * beatThreshold && timeSinceLastBeat > beatCooldown) {
            isBeat = true;
            timeSinceLastBeat = 0;
        }
    }

    return {
        volume: normalizedVolume,
        bass: normalizedBass,
        mid: normalizedMid,
        treble: normalizedTreble,
        rawFrequencyData: frequencyDataArray,
        rawTimeDomainData: timeDomainDataArray,
        isBeat: isBeat
    };
}
```

### Three.js Visualizations

Each visualization mode implements three key functions:
- `initX()` - Creates the visual elements
- `updateX(features, deltaTime)` - Updates the visuals based on audio
- `cleanupX()` - Removes elements and cleans up resources

#### Standard Visualization Interface

Every visualizer must conform to this interface:

```javascript
/**
 * Initialize visualization elements and add them to the scene
 * @returns {THREE.Object3D} - The main object added to the scene
 */
function initVisualization() {
    // Create geometries, materials, and Three.js objects
    // Add objects to scene with addToScene()
    return mainObject; // Return the primary object for reference
}

/**
 * Update visualization based on audio features
 * @param {Object} features - Audio features object with properties:
 *     volume {Number} - Overall volume normalized 0-1
 *     bass {Number} - Bass frequency energy normalized 0-1
 *     mid {Number} - Mid frequency energy normalized 0-1
 *     treble {Number} - Treble frequency energy normalized 0-1
 *     isBeat {Boolean} - True when beat is detected
 *     rawFrequencyData {Uint8Array} - Raw frequency bin data
 *     rawTimeDomainData {Uint8Array} - Raw waveform data
 * @param {Number} deltaTime - Time in milliseconds since last update
 * @returns {Boolean} - True if update was successful
 */
function updateVisualization(features, deltaTime) {
    // Update positions, colors, and other properties
    // Respond to beats, frequency data, etc.
    return true; // Return success status
}

/**
 * Clean up resources used by this visualization
 * - Remove event listeners
 * - Dispose geometries, materials, textures
 * - Clear references to avoid memory leaks
 */
function cleanupVisualization() {
    // Remove and dispose of all created objects
    // Clear all state variables
}
```

#### Performance Optimization Techniques

##### Lookup Tables for Math Operations

The Lines visualization uses precomputed sin/cos lookup tables for significant performance gains:

```javascript
// Precompute sin/cos tables
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

// Fast lookups instead of Math.sin/cos
function fastSin(angle) {
    const index = ((angle % (Math.PI * 2)) / (Math.PI * 2) * SIN_TABLE_SIZE) | 0;
    return sinTable[index >= 0 ? index : index + SIN_TABLE_SIZE];
}
```

##### Dynamic Buffer Updates

For efficiency, visualizations use buffer geometry with dynamic attribute updates:

```javascript
// Update vertex positions with audio reactivity
function updateAllVertexPositions(features, now) {
    const positions = line.geometry.attributes.position.array;
    
    for (let i = 0; i < segments; i++) {
        const i3 = i * 3;
        
        // Apply audio-reactive displacement
        if (features && features.volume > 0.05) {
            positions[i3] = x + xNoise;
            positions[i3 + 1] = y + yNoise;
            positions[i3 + 2] = z + zNoise;
        } else {
            // Subtle ambient movement when silent
            positions[i3] = x + fastSin(t1 * 0.5 + i * 0.05) * dist * 2.0;
            positions[i3 + 1] = y + fastCos(t2 * 0.5 + i * 0.06) * dist * 2.0;
            positions[i3 + 2] = z + fastSin(t3 * 0.5 + i * 0.07) * dist * 2.0;
        }
    }
    
    // Flag the positions as needing an update
    line.geometry.attributes.position.needsUpdate = true;
}
```

### Snowflakes Visualization

The Snowflakes visualizer uses sprite textures and multiple particle systems for depth:

```javascript
function initSnowflakes() {
    // Create two separate geometries - one for active snowflakes, one for background
    const activeGeometry = new THREE.BufferGeometry();
    const backgroundGeometry = new THREE.BufferGeometry();
    
    // Load snowflake textures
    const sprite1 = textureLoader.load('src/visualization/textures/sprites/snowflake1.png', assignSRGB);
    const sprite2 = textureLoader.load('src/visualization/textures/sprites/snowflake2.png', assignSRGB);
    // ...
    
    // Parameters for different snowflake types [hue, saturation, lightness, texture, size]
    parameters = [
        [[1.0, 0.2, 0.5], sprite2, 20],
        [[0.95, 0.1, 0.5], sprite3, 15],
        // ...
    ];
    
    // Create multiple particle systems with different characteristics
    for (let i = 0; i < parameters.length; i++) {
        // Active particles that react strongly to music
        const activeParticles = new THREE.Points(activeGeometry, activeMaterial);
        
        // Background particles for depth
        const backgroundParticles = new THREE.Points(backgroundGeometry, backgroundMaterial);
        
        // ...
    }
}
```

### Billboards Visualization

The Billboards visualizer creates a tunnel-like effect with forward motion and audio-reactive colors:

```javascript
function updateBillboards(features, deltaTime) {
    const dt = deltaTime / 1000;
    const time = performance.now() * 0.0005;
    
    // Get camera for proper billboarding effect
    const camera = window.threeJSCamera;
    
    if (!camera) return false;
    
    // Determine if we have meaningful audio to respond to
    const hasAudio = features && features.volume > 0.05;
    
    // Create flight-through tunnel effect - speed increases with volume
    if (hasAudio) {
        forwardSpeed = 5 + features.volume * 20;
        if (features.isBeat) {
            forwardSpeed += features.bass * 30;
        }
    } else {
        forwardSpeed = 5; // Base speed when no audio
    }
    
    // Move camera forward continually to create tunnel effect
    camera.position.z -= forwardSpeed * dt;
    
    // Check and reposition particles as needed to create infinite tunnel
    checkAndRepositionParticles(camera);
    
    // Update colors based on audio features
    updateParticleColors(particles, features, dt);
    updateParticleColors(particles2, features, dt, true);
    
    return true;
}
```

### Lines Visualization

The Lines visualization creates morphing geometric patterns with audio-reactive animations:

```javascript
function updateAllColors(features) {
    const colors = line.geometry.attributes.color.array;
    const positions = line.geometry.attributes.position.array;
    
    // Precalculate color values from audio features
    const bassColor = 0.3 + features.bass * 3.0;
    const midColor = 0.3 + features.mid * 3.0;
    const trebleColor = 0.3 + features.treble * 3.0;
    
    // Determine dominant frequency
    const bassDominant = features.bass > features.mid && features.bass > features.treble;
    const midDominant = !bassDominant && features.mid > features.treble;
    
    // Beat flash calculation
    const beatBoost = features.isBeat ? (1.5 + features.volume * 1.5) : 0;
    
    for (let i = 0; i < segments; i++) {
        const i3 = i * 3;
        
        // Base colors - dynamic with music
        let red = bassColor;
        let green = midColor;
        let blue = trebleColor;
        
        // Apply color emphasis based on dominant frequency
        if (bassDominant) {
            red *= 2.0;
            green *= 0.3;
            blue *= 0.3;
        } else if (midDominant) {
            // ...
        }
        
        // Add beat flash effect
        if (beatBoost > 0) {
            red += beatBoost * 1.5;
            green += beatBoost * 1.5;
            blue += beatBoost * 1.5;
        }
        
        // Store colors
        colors[i3] = red > 1 ? 1 : red;
        colors[i3 + 1] = green > 1 ? 1 : green;
        colors[i3 + 2] = blue > 1 ? 1 : blue;
    }
    
    // Flag colors for update
    line.geometry.attributes.color.needsUpdate = true;
}
```

### UI Management

The UI manager handles all user interactions and provides smooth updates for playback controls:

```javascript
// Force update the progress bar with direct DOM manipulation
function forceProgressBarUpdate(percent) {
    if (!progressBar) return false;
    
    // Ensure percent is valid
    percent = Math.max(0, Math.min(100, percent));
    
    // Use multiple approaches to ensure update works
    try {
        // Direct attribute setting
        progressBar.setAttribute('style', `width: ${percent}% !important; transition: none !important;`);
        
        // Style property setting
        progressBar.style.width = `${percent}%`;
        progressBar.style.transition = 'none';
        
        // Force reflow/repaint
        void progressBar.offsetWidth;
        
        return true;
    } catch (e) {
        console.error("Error updating progress bar:", e);
        return false;
    }
}
```

## Memory Management

The application carefully manages memory by cleaning up resources:

```javascript
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
    
    // Special handling for instance meshes
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
```

## Developer Guide

### Adding a New Visualization Mode

To create a new visualization:

1. **Create a new file** in the `src/visualization` directory:
   ```javascript
   // myNewVisualizer.js
   import * as THREE from 'three';
   import { addToScene } from './threeManager.js';
   
   // State variables
   let myObject = null;
   
   function initMyVisualizer() {
       // Create Three.js objects
       const geometry = new THREE.BufferGeometry();
       // ...
       
       myObject = new THREE.Mesh(geometry, material);
       addToScene(myObject);
       
       return myObject;
   }
   
   function updateMyVisualizer(features, deltaTime) {
       if (!myObject) return false;
       
       // Update based on audio features
       // ...
       
       return true;
   }
   
   function cleanupMyVisualizer() {
       // Clean up resources
       myObject = null;
   }
   
   export { initMyVisualizer, updateMyVisualizer, cleanupMyVisualizer };
   ```

2. **Register your visualizer** in `visualizers.js`:
   ```javascript
   // Add import
   import { initMyVisualizer, updateMyVisualizer, cleanupMyVisualizer } from './myNewVisualizer.js';
   
   // Add to initVisualsForMode switch case
   function initVisualsForMode(mode) {
       switch (mode) {
           // ...
           case 'myNewVisualization':
               visElements.myVis = initMyVisualizer();
               break;
       }
   }
   
   // Add to updateVisualization switch case
   function updateVisualization(features, deltaTime) {
       switch (currentVisMode) {
           // ...
           case 'myNewVisualization':
               return visElements.myVis ? updateMyVisualizer(features, deltaTime) : false;
       }
   }
   
   // Add to cleanupVisuals switch case
   function cleanupVisuals() {
       switch (currentVisMode) {
           // ...
           case 'myNewVisualization':
               cleanupMyVisualizer();
               break;
       }
   }
   ```

3. **Add to the UI dropdown** in `index.html`:
   ```html
   <select id="visModeSelect">
       <!-- Add your option -->
       <option value="myNewVisualization">My New Visualization</option>
       <!-- ... -->
   </select>
   ```

### Configuration Reference

Key configuration values you might want to adjust:

| Variable | File Location | Purpose | Adjustment Effect |
|----------|---------------|---------|-------------------|
| `fftSize` | audioProcessor.js:12 | Frequency analysis resolution | Higher values give more frequency bins but consume more CPU |
| `beatHistorySize` | audioProcessor.js:15 | Frames to average for beat detection | Higher values create more stable but less responsive beat detection |
| `beatThreshold` | audioProcessor.js:16 | Energy multiplier to detect beats | Higher values require stronger beats to trigger |
| `beatCooldown` | audioProcessor.js:17 | Minimum time between beats (ms) | Higher values prevent rapid consecutive beats |
| `segments` | linesVisualizer.js:6 | Number of line segments | More segments = more detail but lower performance |
| `numParticles` | particleVisualizer.js:5 | Number of particles | More particles = richer effect but lower performance |
| `numSnowflakes` | snowflakeVisualizer.js:5 | Number of snowflake particles | More snowflakes = denser effect but lower performance |

### Architecture Principles

The codebase follows these core principles:

1. **Separation of Concerns**
   - Audio processing is isolated from visualization
   - UI logic is separated from rendering logic
   - Each visualization is self-contained with its own state

2. **Resource Management**
   - All Three.js resources must be properly disposed
   - Visualizations clean up their own resources
   - Event listeners are added and removed appropriately

3. **Performant Rendering**
   - Use buffer attributes with `needsUpdate = true` rather than recreating geometries
   - Pre-compute values where possible
   - Use caching and lookup tables for intensive calculations

4. **Graceful Degradation**
   - Fall back to simpler animations when no audio is playing
   - Handle errors gracefully without crashing
   - Visualizers should check for null references before accessing

### Debugging Tips

When developing visualizations, these approaches can help:

1. **Inspect Audio Features**
   ```javascript
   function updateMyVisualizer(features, deltaTime) {
       // Log features to see available data
       console.log("Volume:", features.volume, "Bass:", features.bass, "Beat:", features.isBeat);
       
       // Continue with visualization update
   }
   ```

2. **Monitor Performance**
   ```javascript
   // Add to your update function to monitor frame rate
   const fps = 1000 / deltaTime;
   if (frameCount % 60 === 0) {
       console.log(`FPS: ${fps.toFixed(1)}, Objects: ${renderer.info.render.triangles}`);
   }
   ```

3. **Common Issues and Solutions**
   - **Invisible objects**: Check material.transparent and material.opacity
   - **Objects not updating**: Ensure buffer attribute needsUpdate is set to true
   - **Memory leaks**: Make sure all geometries and materials are disposed
   - **Audio sync issues**: Verify that you're using deltaTime properly for animations

## Usage

1. Open `index.html` in a modern browser
2. Click "Select Audio File" and choose a music file
3. Use the controls to play/pause, seek, adjust volume, and switch visualization modes
4. The Color Picker changes the base color for particle visualizations

## Technologies Used

- Three.js for 3D rendering
- Web Audio API for audio analysis
- HTML5 Canvas for textures and UI
- ES6 JavaScript Modules for code organization

## To Do

### Future Improvements

- **Professional Audio Processing Library:** 
  - Replace custom audio analysis with a dedicated library like [Meyda.js](https://meyda.js.org/) or [Tone.js](https://tonejs.github.io/)
  - Implement more accurate beat detection algorithms
  - Add additional audio features: tempo estimation, key detection, onset detection

- **Performance Optimizations:**
  - Implement WebGL shaders for particle animations
  - Use Web Workers for audio analysis to prevent UI blocking
  - Add level-of-detail system for lower-end devices

- **Additional Visualizations:**
  - Circular audio spectrum analyzer
  - 3D terrain generation from frequency data
  - Audio-reactive VJ style effects 

- **User Experience:**
  - Save user preferences in localStorage
  - Add presets for different music genres
  - Allow users to create custom visualization combinations 