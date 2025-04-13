import * as THREE from 'three';
// Optional: Add OrbitControls for camera interaction
// import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

console.log("Visualizer script loaded.");

// --- Global Variables ---
let scene, camera, renderer;
let audioContext, analyser, sourceNode, gainNode;
let audioBuffer;
let frequencyDataArray, timeDomainDataArray;
let isPlaying = false;
let animationFrameId = null;
let startTime = 0; // To track playback time offset for pause/resume/seek
let startedAt = 0; // audioContext.currentTime when playback most recently started

// --- DOM Elements ---
let fileInput, fileLabel, playPauseButton, volumeSlider, canvas, progressBarContainer, progressBar, currentTimeDisplay, totalDurationDisplay, visModeSelect, sphereColorPicker;

// --- Visualization State ---
let currentVisMode = 'spheresAndParticles'; // Default mode
let visElements = {}; // Store references to mode-specific elements
let currentSphereColor = new THREE.Color(0x00ff00); // Default to green

// --- Audio Analysis Parameters ---
const fftSize = 1024;

// --- Beat Detection Parameters ---
const beatHistorySize = 60;
const beatThreshold = 1.3;
const beatCooldown = 150;
let energyHistory = [];
let timeSinceLastBeat = 0;
let lastFrameTime = performance.now();

// --- Visual Elements ---
const numInstances = 2000; // For sphere mode
const numParticles = 5000; // For particle mode

// Function to get DOM elements after DOMContentLoaded
function getDOMElements() {
    console.log("Attempting to get DOM elements...");
    fileInput = document.getElementById('audioFile');
    fileLabel = document.getElementById('fileLabel');
    playPauseButton = document.getElementById('playPauseButton');
    volumeSlider = document.getElementById('volumeSlider');
    canvas = document.getElementById('visualizerCanvas');
    progressBarContainer = document.getElementById('progressBarContainer');
    progressBar = document.getElementById('progressBar');
    currentTimeDisplay = document.getElementById('currentTime');
    totalDurationDisplay = document.getElementById('totalDuration');
    visModeSelect = document.getElementById('visModeSelect');
    sphereColorPicker = document.getElementById('sphereColorPicker');

    // Add checks
    if (!fileInput) console.warn("DOM Element not found: audioFile");
    if (!fileLabel) console.warn("DOM Element not found: fileLabel");
    if (!playPauseButton) console.warn("DOM Element not found: playPauseButton");
    if (!volumeSlider) console.warn("DOM Element not found: volumeSlider");
    if (!canvas) console.warn("DOM Element not found: visualizerCanvas");
    if (!progressBarContainer) console.warn("DOM Element not found: progressBarContainer");
    if (!progressBar) console.warn("DOM Element not found: progressBar");
    if (!currentTimeDisplay) console.warn("DOM Element not found: currentTime");
    if (!totalDurationDisplay) console.warn("DOM Element not found: totalDuration");
    if (!visModeSelect) console.warn("DOM Element not found: visModeSelect");
    if (!sphereColorPicker) console.warn("DOM Element not found: sphereColorPicker");
    else {
        // Initialize currentSphereColor from picker value
        currentSphereColor.set(sphereColorPicker.value);
    }

    console.log("Finished getting DOM elements.");
}

// --- Initialization Functions ---

function initThreeJS() {
    console.log("Initializing Three.js...");
    scene = new THREE.Scene();
    // scene.background = new THREE.Color(0x202020); // Keep black

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 50;

    // Ensure canvas exists before creating renderer
    if (!canvas) {
        console.error("Canvas element not found!");
        return;
    }
    renderer = new THREE.WebGLRenderer({ canvas: canvas });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Basic Lighting
    // Keep ambient light as is for now
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    // *** Increase PointLight intensity drastically ***
    const pointLight = new THREE.PointLight(0xffffff, 5, 200); // Increased intensity and range
    pointLight.position.set(10, 10, 50); // Maybe move closer along Z
    scene.add(pointLight);

    window.addEventListener('resize', onWindowResize, false);
    console.log("Three.js Initialized.");
    renderer.render(scene, camera); // Initial render
}

function initAudio() {
    console.log("Initializing Audio Context...");
    // Ensure necessary DOM elements are ready before proceeding
    if (!volumeSlider) {
        console.error("Volume slider not found for audio initialization!");
        return;
    }
    audioContext = new (window.AudioContext || window.webkitAudioContext)();

    analyser = audioContext.createAnalyser();
    analyser.fftSize = fftSize;
    analyser.smoothingTimeConstant = 0.8;
    const bufferLength = analyser.frequencyBinCount;
    frequencyDataArray = new Uint8Array(bufferLength);
    timeDomainDataArray = new Uint8Array(bufferLength);

    gainNode = audioContext.createGain();
    gainNode.gain.value = volumeSlider.value / 100;

    gainNode.connect(audioContext.destination);

    console.log("Audio Context Initialized. FFT Size:", fftSize, "Bin Count:", bufferLength);

    setupEventListeners();
}

function setupEventListeners() {
    if (!fileInput || !playPauseButton || !volumeSlider || !progressBarContainer || !visModeSelect || !sphereColorPicker) {
        console.error("One or more UI elements missing, cannot add listeners.");
        return;
    }
    fileInput.addEventListener('change', handleFileSelect, false);
    playPauseButton.addEventListener('click', handlePlayPause, false);
    volumeSlider.addEventListener('input', handleVolumeChange, false);
    progressBarContainer.addEventListener('click', handleSeek, false);
    visModeSelect.addEventListener('change', handleModeChange, false);
    sphereColorPicker.addEventListener('input', handleSphereColorChange, false);
    console.log("Event listeners added.");
}

// --- Utility Functions ---
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}

function updateProgressBar() {
    if (!audioBuffer || !isPlaying || !progressBar || !currentTimeDisplay) return; // Check elements exist
    // Use audioContext.currentTime for more accurate timing
    const elapsed = audioContext.currentTime - startedAt + startTime;
    const duration = audioBuffer.duration;
    const progress = duration > 0 ? (elapsed / duration) * 100 : 0;

    progressBar.style.width = `${Math.min(100, progress)}%`; // Clamp progress to 100%
    currentTimeDisplay.textContent = formatTime(Math.min(duration, elapsed)); // Don't exceed duration
}

// --- Window Resize Handler ---
function onWindowResize() {
    // Ensure camera and renderer are initialized
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Event Handlers ---

function handleFileSelect(event) {
    console.log("File selected.");
    if (isPlaying) {
        handlePlayPause(); // Stop current playback if any
    }
    resetPlaybackUI();

    const file = event.target.files[0];
    if (!file) {
        if (fileLabel) fileLabel.textContent = "Select Audio File";
        return;
    }
    if (fileLabel) fileLabel.textContent = `Loading: ${file.name}`;

    const reader = new FileReader();
    reader.onload = (e) => {
        console.log("File read complete. Decoding audio data...");
        if (audioContext.state === 'suspended') {
            audioContext.resume().catch(err => console.error("Error resuming context:", err));
        }
        audioContext.decodeAudioData(e.target.result,
            (buffer) => {
                console.log("Audio data decoded successfully.");
                audioBuffer = buffer;

                // Initialize visuals for the *current* mode if not already done
                if (Object.keys(visElements).length === 0) {
                    console.log(`Initializing visuals for default mode: ${currentVisMode}`);
                    initVisualsForMode(currentVisMode);
                }

                if (totalDurationDisplay) totalDurationDisplay.textContent = formatTime(audioBuffer.duration);
                if (playPauseButton) playPauseButton.disabled = false;
                if (volumeSlider) volumeSlider.disabled = false;
                if (progressBarContainer) progressBarContainer.style.cursor = 'pointer';
                if (fileLabel) fileLabel.textContent = file.name;
                console.log("Audio ready. Controls enabled.");
            },
            (error) => {
                console.error("Error decoding audio data:", error);
                alert('Error decoding audio file.');
                resetPlaybackUI();
                if (fileLabel) fileLabel.textContent = "Select Audio File";
            }
        );
    };
    reader.onerror = (e) => {
        console.error("FileReader error:", e);
        alert('Error reading file.');
        resetPlaybackUI();
        if (fileLabel) fileLabel.textContent = "Select Audio File";
    };
    reader.readAsArrayBuffer(file);
    console.log("Reading file as ArrayBuffer...");
}

function resetPlaybackUI() {
    console.log("Resetting playback UI.");
    audioBuffer = null;
    if (sourceNode) {
        try { sourceNode.disconnect(); } catch (e) { /* Ignore */ }
        sourceNode = null;
    }
    isPlaying = false;
    startTime = 0;
    startedAt = 0;
    if (progressBar) progressBar.style.width = '0%';
    if (currentTimeDisplay) currentTimeDisplay.textContent = '0:00';
    if (totalDurationDisplay) totalDurationDisplay.textContent = '0:00';
    if (playPauseButton) {
        playPauseButton.textContent = '▶️'; // Play Icon
        playPauseButton.disabled = true;
    }
    if (volumeSlider) volumeSlider.disabled = true;
    if (progressBarContainer) progressBarContainer.style.cursor = 'default'; // Disable seeking cursor
    // Don't reset visuals here, mode switching handles that
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

function handlePlayPause() {
    if (!audioBuffer || !playPauseButton) return; // No audio loaded or button missing

    if (isPlaying) {
        // --- Pause ---
        console.log("Pausing playback.");
        // Ensure context is running before calculating time elapsed
        if (audioContext.currentTime > 0) {
            startTime += audioContext.currentTime - startedAt; // Save elapsed time
        }
        if (sourceNode) {
            sourceNode.onended = null; // Prevent onended logic during pause
            try { sourceNode.stop(); } catch(e) { console.warn("Error stopping node on pause:", e)}
             // sourceNode is cleared in onended, but we might need it cleared here if stop fails
             sourceNode = null;
        }
        isPlaying = false; // Set state immediately
        playPauseButton.textContent = '▶️'; // Set icon immediately

        // Stop animation updates explicitly on pause
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
            console.log("Animation loop stopped on pause.");
        }
    } else {
        // --- Play ---
        console.log("Starting/Resuming playback.");
        // Ensure audio context is running
        if (audioContext.state === 'suspended') {
             console.log("AudioContext is suspended, attempting to resume...");
            audioContext.resume().then(() => {
                console.log("AudioContext resumed successfully.");
                startPlayback(startTime); // Start from saved time offset
            }).catch(e => {
                console.error("Error resuming context on play:", e);
                alert("Could not start audio. Please interact with the page (e.g. click) and try again.");
            });
        } else {
             console.log("AudioContext is running, starting playback.");
            startPlayback(startTime); // Start from saved time offset
        }
    }
}

function startPlayback(offset = 0) {
    // Check prerequisites
    if (!audioBuffer || !audioContext || !analyser || !gainNode || !playPauseButton) {
        console.error("Cannot start playback: missing audio buffer or core components.");
        resetPlaybackUI();
        return;
    }
     // Ensure offset is valid
    const validOffset = Math.max(0, offset) % audioBuffer.duration;
    console.log(`Starting playback from offset: ${validOffset.toFixed(2)}s`);

    // Clean up previous node if it exists (e.g., from a finished track)
    if (sourceNode) {
        try { sourceNode.disconnect(); } catch(e) {}
        sourceNode = null;
    }

    sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.connect(analyser);
    sourceNode.connect(gainNode);

    sourceNode.onended = () => {
        console.log("Audio sourceNode.onended triggered.");
        // isPlaying is checked to differentiate pause from natural end
        const naturallyEnded = isPlaying && (audioContext.currentTime - startedAt + startTime >= audioBuffer.duration - 0.1);

        isPlaying = false; // Update state *here*
        if (playPauseButton) playPauseButton.textContent = '▶️'; // Set icon to Play
        // Re-enable button only if buffer still exists (might have been cleared by new file select)
        if (playPauseButton && audioBuffer) playPauseButton.disabled = false;

        console.log("Playback ended/stopped.");

        if (naturallyEnded) {
             console.log("Playback finished naturally.");
             startTime = 0; // Reset start time
             // Ensure final UI update if needed
             if (progressBar) progressBar.style.width = '100%';
             if (currentTimeDisplay && totalDurationDisplay) currentTimeDisplay.textContent = totalDurationDisplay.textContent;
             // Optionally stop animation loop if it's still running?
             // if (animationFrameId) cancelAnimationFrame(animationFrameId); animationFrameId = null;
        } else {
             console.log("Playback stopped (paused, seeked, or new file).");
        }
        // Clear the source node reference AFTER checking state
         sourceNode = null;
    };

    try {
        startedAt = audioContext.currentTime; // Record the time playback *actually* starts now
        sourceNode.start(0, validOffset); // Start at the validated offset
        console.log("sourceNode.start called.");
        isPlaying = true;
        playPauseButton.textContent = '⏸️'; // Pause Icon
        playPauseButton.disabled = false; // Ensure enabled

        if (!animationFrameId) {
            console.log("Starting animation loop.");
            lastFrameTime = performance.now();
            animate();
        } else {
             console.log("Animation loop already running (resuming).");
        }
    } catch (e) {
        console.error("Error starting sourceNode:", e);
        alert("Error starting audio playback.");
        resetPlaybackUI(); // Reset UI on error
        if(fileLabel) fileLabel.textContent = "Select Audio File"; // Reset label too
    }
}


function handleVolumeChange(event) {
    if (!gainNode || !event.target) return;
    const volume = event.target.value / 100;
    gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.05); // Smoother volume change
    console.log("Volume changed to:", volume.toFixed(2));
}

function handleSeek(event) {
    if (!audioBuffer || !progressBarContainer) return;

    const bounds = progressBarContainer.getBoundingClientRect();
    const clickX = event.clientX - bounds.left;
    const width = bounds.width;
    const seekRatio = Math.max(0, Math.min(1, clickX / width)); // Clamp between 0 and 1
    const seekTime = seekRatio * audioBuffer.duration;

    console.log(`Seek requested to ${seekTime.toFixed(2)}s (ratio: ${seekRatio.toFixed(2)})`);

    startTime = seekTime; // Set the new start time offset

    if (isPlaying && sourceNode) {
        console.log("Seeking while playing: stopping current node and starting new one.");
        // Stop current playback gracefully but prevent onended logic
        sourceNode.onended = null;
        try { sourceNode.stop(); } catch(e) {}
        sourceNode = null; // Clear reference immediately
        // Immediately start playback from the new time
        startPlayback(startTime);
    } else {
        // If paused, just update the time display and progress bar visually
        console.log("Seeking while paused: updating UI.");
        if (currentTimeDisplay) currentTimeDisplay.textContent = formatTime(startTime);
        if (progressBar) progressBar.style.width = `${seekRatio * 100}%`;
        // Playback will resume from `startTime` when play is next clicked
        // Ensure isPlaying is false if we seek while paused
        isPlaying = false;
         if (playPauseButton) playPauseButton.textContent = '▶️';
    }
}

function handleModeChange(event) {
    const newMode = event.target.value;
    console.log(`Mode changed to: ${newMode}`);
    switchVisualMode(newMode);
}

function handleSphereColorChange(event) {
    currentSphereColor.set(event.target.value);
    console.log(`handleSphereColorChange: Picker value changed to ${event.target.value}, currentSphereColor updated.`);
}

// --- Visualization Switching Logic ---

function cleanupVisuals() {
    console.log("Cleaning up old visual elements...");
    for (const key in visElements) {
        const element = visElements[key];
        if (element) {
            if (element.geometry) element.geometry.dispose();
            if (element.material) {
                // Handle material arrays if necessary
                 if (Array.isArray(element.material)) {
                    element.material.forEach(m => m.dispose());
                } else {
                    element.material.dispose();
                }
            }
            if(element.parent) element.parent.remove(element);
        }
    }
    visElements = {}; // Clear the references
    // Reset any specific state if needed, e.g., particle velocities
    // particleVelocities = [];
}

function switchVisualMode(newMode) {
    if (newMode === currentVisMode && Object.keys(visElements).length > 0) {
        console.log(`Mode ${newMode} already active.`);
        return; // No change needed if mode is the same and initialized
    }

    cleanupVisuals(); // Remove old elements from scene and dispose
    currentVisMode = newMode; // Set the new mode
    initVisualsForMode(newMode); // Initialize elements for the new mode
    console.log(`Switched to mode: ${currentVisMode}`);

    // Ensure animation loop is running if needed (e.g., if switched while paused)
    // And restart it if it was stopped by cleanup? (depends on implementation)
     if (!animationFrameId && (isPlaying || audioBuffer)) { // Check if audio is ready/playing
         console.log("Restarting animation loop after mode switch.");
         lastFrameTime = performance.now();
         animate();
     }
}

function initVisualsForMode(mode) {
    console.log(`Initializing visuals for mode: ${mode}`);
    // Ensure scene is ready
     if (!scene) {
        console.error("Scene not ready for visual initialization.");
        return;
    }

    switch (mode) {
        case 'spheresAndParticles':
            // *** Re-enable sphere init ***
            initSpheres();
            // *** Keep particle init enabled ***
            initParticles();
            console.log("Spheres & Particles mode active"); // Updated log
            break;
        case 'frequencyBars':
            initFrequencyBars();
            break;
        case 'waveform':
            initWaveform();
            break;
        default:
            console.warn(`Unknown visualization mode: ${mode}`);
    }
    // Render one frame to show initial state
    if (renderer && camera) renderer.render(scene, camera);
}

// --- Specific Mode Initializers ---

function initSpheres() {
    console.log("Initializing Spheres (Instanced - Basic Material - Explicit Buffer)...");
    const baseGeometry = new THREE.IcosahedronGeometry(0.5, 1);
    // *** Use MeshBasicMaterial with vertexColors: true and explicitly opaque ***
    const baseMaterial = new THREE.MeshBasicMaterial({
        vertexColors: true, // Basic material ignores lighting
        opacity: 1.0,
        transparent: false
    });

    const spheres = new THREE.InstancedMesh(baseGeometry, baseMaterial, numInstances);
    spheres.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // *** Keep Explicit instanceColor BufferAttribute creation ***
    const colors = new Float32Array(numInstances * 3);
    spheres.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    spheres.instanceColor.setUsage(THREE.DynamicDrawUsage);

    const dummy = new THREE.Object3D();
    const initialColor = new THREE.Color();
    for (let i = 0; i < numInstances; i++) {
        const radius = 30;
        dummy.position.set(
            (Math.random() - 0.5) * 2 * radius,
            (Math.random() - 0.5) * 2 * radius,
            (Math.random() - 0.5) * 2 * radius
        );
        dummy.rotation.set( Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2 );
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        spheres.setMatrixAt(i, dummy.matrix);

        // Set initial instance color in the buffer
        initialColor.setHex(Math.random() * 0xffffff);
        spheres.setColorAt(i, initialColor);
    }
    spheres.instanceMatrix.needsUpdate = true;
    spheres.instanceColor.needsUpdate = true;

    scene.add(spheres);
    visElements.spheres = spheres;
    console.log("Instanced Spheres (Basic Material with Explicit Buffer) Initialized.");
}

function initParticles() {
    console.log("Initializing Particles (Using Picker Color)...");
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(numParticles * 3);
    const colors = new Float32Array(numParticles * 3);
    let particleVelocities = [];

    for (let i = 0; i < numParticles; i++) {
        const i3 = i * 3;
        // Keep original position spread and velocity init
        const radius = 5; // Use original radius
        positions[i3] = (Math.random() - 0.5) * radius;
        positions[i3 + 1] = (Math.random() - 0.5) * radius;
        positions[i3 + 2] = (Math.random() - 0.5) * radius;
        particleVelocities.push(new THREE.Vector3((Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1));

        // *** Set initial particle color using the picker's current value ***
        colors[i3] = currentSphereColor.r;
        colors[i3 + 1] = currentSphereColor.g;
        colors[i3 + 2] = currentSphereColor.b;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Use original material settings (transparent, blending)
    const particleMaterial = new THREE.PointsMaterial({
        size: 0.2,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
    });
    const points = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(points);
    visElements.particles = points;
    visElements.particleVelocities = particleVelocities;
    console.log("Particles initialized with picker color.");
}

function initFrequencyBars() {
    console.log("Initializing Frequency Bars (Placeholder)...");
    // TODO: Create bar geometry, material, mesh (likely InstancedMesh)
    // Example: Use BoxGeometry, MeshStandardMaterial
    const numBars = 128; // Example: number of bars
    const barGeometry = new THREE.BoxGeometry(0.5, 1, 0.5);
    const barMaterial = new THREE.MeshStandardMaterial({ color: 0x00ffff });
    const bars = new THREE.InstancedMesh(barGeometry, barMaterial, numBars);
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
    scene.add(bars);
    visElements.frequencyBars = bars;
    console.log("Frequency Bars Placeholder Initialized.");
}

function initWaveform() {
    console.log("Initializing Waveform (Placeholder)...");
    // TODO: Create line geometry, material, Line object
    // Example: Use BufferGeometry with positions, LineBasicMaterial
     const numPoints = analyser ? analyser.frequencyBinCount : 512;
     const lineGeometry = new THREE.BufferGeometry();
     const positions = new Float32Array(numPoints * 3); // x, y, z for each point
     lineGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
     const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 });
     const line = new THREE.Line(lineGeometry, lineMaterial);
     scene.add(line);
     visElements.waveformLine = line;
     console.log("Waveform Placeholder Initialized.");
}


// --- Specific Mode Updaters ---

function updateSpheres(features, deltaTime) {
     const spheres = visElements.spheres;
     if (!spheres || !(spheres instanceof THREE.InstancedMesh)) return;

     // *** Temporarily disable audio-based calculations ***
     /* ... */

     // *** Force update all instances to the picker color ***
     if (spheres.instanceColor) {
         // We need to loop to set color for all instances if the color changed
         // For efficiency, ideally only do this if color *actually* changed,
         // but for debugging, we do it every frame.
         for (let i = 0; i < numInstances; i++) {
              spheres.setColorAt(i, currentSphereColor);
         }
         spheres.instanceColor.needsUpdate = true;
     } else {
         // This shouldn't happen with explicit buffer creation, but log if it does
         console.warn("updateSpheres: instanceColor buffer missing?");
     }

     // Keep matrix update flag (though matrix isn't changing here)
     spheres.instanceMatrix.needsUpdate = true;
}

function updateParticles(features, deltaTime) {
    const particles = visElements.particles;
    const particleVelocities = visElements.particleVelocities;
    if (!particles || !features || !particleVelocities) return;

    const positions = particles.geometry.attributes.position.array;
    const colors = particles.geometry.attributes.color.array; // Get colors buffer
    if (!positions || !colors) return;

    const beatEffect = features.isBeat ? 2.0 : 1.0;
    const dtSeconds = deltaTime / 1000;

    for (let i = 0; i < numParticles; i++) {
        const i3 = i * 3;
        if (i >= particleVelocities.length) continue;
        const velocity = particleVelocities[i];

        // --- Keep position/velocity updates --- 
        const forceMagnitude = features.volume * 0.01 * beatEffect;
        const currentPos = new THREE.Vector3(positions[i3], positions[i3 + 1], positions[i3 + 2]);
        if (currentPos.lengthSq() > 1e-6) velocity.add(currentPos.clone().normalize().multiplyScalar(forceMagnitude));
        velocity.x += (Math.random() - 0.5) * 0.005;
        velocity.y += (Math.random() - 0.5) * 0.005;
        velocity.multiplyScalar(Math.pow(0.97, dtSeconds * 60));
        positions[i3] += velocity.x * dtSeconds * 60;
        positions[i3 + 1] += velocity.y * dtSeconds * 60;
        positions[i3 + 2] += velocity.z * dtSeconds * 60;
        if (!isNaN(currentPos.x) && currentPos.lengthSq() > 60 * 60) {
            positions[i3] = (Math.random() - 0.5) * 5;
            positions[i3 + 1] = (Math.random() - 0.5) * 5;
            positions[i3 + 2] = (Math.random() - 0.5) * 5;
            velocity.set(0,0,0);
        }
        // --- End position/velocity updates --- 

        // *** Force a static BRIGHT YELLOW color for testing ***
        colors[i3] = 1.0; // R
        colors[i3 + 1] = 1.0; // G
        colors[i3 + 2] = 0.0; // B
    }

    // Update both buffers
    particles.geometry.attributes.position.needsUpdate = true;
    particles.geometry.attributes.color.needsUpdate = true;
    // Keep log active
    console.log(`updateParticles: Forcing YELLOW particle color, needsUpdate=${particles.geometry.attributes.color.needsUpdate}`);
}

function updateFrequencyBars(features, deltaTime) {
    const bars = visElements.frequencyBars;
    if (!bars || !features || !analyser) return;

    const freqData = features.rawFrequencyData;
    const numBars = bars.count;
    const binCount = analyser.frequencyBinCount;
    const dummy = new THREE.Object3D();

    for (let i = 0; i < numBars; i++) {
        bars.getMatrixAt(i, dummy.matrix);
        dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);

        // Map bar index to frequency data index (adjust mapping as needed)
        const freqIndex = Math.min(binCount - 1, Math.floor((i / numBars) * (binCount * 0.8))); // Use lower 80% of freq data
        const freqValueNormalized = (freqData && freqData[freqIndex] !== undefined) ? freqData[freqIndex] / 255 : 0;

        // Update bar scale (mostly height)
        const targetScaleY = Math.max(0.1, freqValueNormalized * 20); // Adjust multiplier for height
        // Smoothly interpolate scale for less jitter
        dummy.scale.y += (targetScaleY - dummy.scale.y) * 0.2;

        dummy.updateMatrix();
        bars.setMatrixAt(i, dummy.matrix);

        // Optionally update color based on height/frequency etc.
        // bars.setColorAt(...)
    }
    bars.instanceMatrix.needsUpdate = true;
    // if (bars.instanceColor) bars.instanceColor.needsUpdate = true;
}

function updateWaveform(features, deltaTime) {
    const line = visElements.waveformLine;
    if (!line || !features || !analyser) return;

    const timeData = features.rawTimeDomainData;
    const bufferLength = analyser.frequencyBinCount; // timeDomainData has same length
    const positions = line.geometry.attributes.position.array;

    const width = 50; // Width of the waveform display
    const height = 10; // Max height deviation

    for (let i = 0; i < bufferLength; i++) {
        const i3 = i * 3;
        const x = (i / (bufferLength - 1) - 0.5) * width;
        const y = ((timeData[i] / 128.0) - 1.0) * height; // Normalize -1 to 1, scale by height
        const z = 0;

        positions[i3] = x;
        positions[i3 + 1] = y;
        positions[i3 + 2] = z;
    }

    line.geometry.attributes.position.needsUpdate = true;
    // Optional: Center the line or adjust camera
}


// --- Animation Loop ---
function animate() {
    animationFrameId = requestAnimationFrame(animate);

    const currentTime = performance.now();
    const validLastFrameTime = lastFrameTime > 0 ? lastFrameTime : currentTime - 16.67;
    const deltaTime = (currentTime - validLastFrameTime);
    lastFrameTime = currentTime;

    if (isPlaying) {
        updateProgressBar();
    }

    // Get Audio Data
    let features;
    if (isPlaying && analyser) {
        try {
            analyser.getByteFrequencyData(frequencyDataArray);
            analyser.getByteTimeDomainData(timeDomainDataArray);
            features = calculateAudioFeatures();
        } catch (e) {
            console.error("Error getting audio data:", e);
            features = createDefaultFeatures();
        }
    } else {
        features = createDefaultFeatures();
    }

    // --- Update Visuals Based on Mode ---
    switch (currentVisMode) {
        case 'spheresAndParticles':
            // *** Re-enable sphere update ***
            if (visElements.spheres) updateSpheres(features, deltaTime);
            // *** Keep particle update enabled ***
            if (visElements.particles) updateParticles(features, deltaTime);
            break;
        case 'frequencyBars':
            if (visElements.frequencyBars) updateFrequencyBars(features, deltaTime);
            break;
        case 'waveform':
             if (visElements.waveformLine) updateWaveform(features, deltaTime);
            break;
    }

    // Render Scene
    if (renderer && scene && camera) {
        try {
            renderer.render(scene, camera);
        } catch (e) {
            console.error("Error during render:", e);
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
        }
    }
}


// --- Feature Calculation ---
function calculateAudioFeatures() {
    // Ensure analyser and arrays are ready
    if (!analyser || !frequencyDataArray || !timeDomainDataArray) {
        return createDefaultFeatures();
    }

    let bass = 0, mid = 0, treble = 0, volume = 0;
    const bufferLength = analyser.frequencyBinCount;
    const bassEnd = Math.floor(bufferLength * 0.1);
    const midEnd = Math.floor(bufferLength * 0.4);
    let currentEnergy = 0;

    // Ensure bufferLength is valid
    if (bufferLength <= 0) return createDefaultFeatures();

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

    // Check for division by zero
    const validBassEnd = bassEnd > 0 ? bassEnd : 1;
    const validMidRange = (midEnd - bassEnd) > 0 ? (midEnd - bassEnd) : 1;
    const validTrebleRange = (bufferLength - midEnd) > 0 ? (bufferLength - midEnd) : 1;

    volume /= bufferLength;
    bass /= validBassEnd;
    mid /= validMidRange;
    treble /= validTrebleRange;
    currentEnergy /= bufferLength;

    const maxPossibleValue = 255;
    const normalizedBass = Math.min(1, bass / maxPossibleValue);
    const normalizedMid = Math.min(1, mid / maxPossibleValue);
    const normalizedTreble = Math.min(1, treble / maxPossibleValue);
    const normalizedVolume = Math.min(1, volume / maxPossibleValue);

    let isBeat = false;
    const now = performance.now();
    // Ensure lastFrameTime is valid before calculating timeSinceLastBeat
    const validLastFrameTime = lastFrameTime > 0 ? lastFrameTime : now - 16.67;
    timeSinceLastBeat += (now - validLastFrameTime);

    if (energyHistory.length > 0) {
        let avgEnergy = energyHistory.reduce((sum, val) => sum + val, 0) / energyHistory.length;
        // Add small epsilon to prevent division by zero or weirdness with silent audio
        if (currentEnergy > avgEnergy * beatThreshold + 1e-4 && timeSinceLastBeat > beatCooldown) {
            isBeat = true;
            timeSinceLastBeat = 0;
        }
    }

    energyHistory.push(currentEnergy);
    if (energyHistory.length > beatHistorySize) {
        energyHistory.shift();
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

function createDefaultFeatures() {
      const bufferLength = analyser ? analyser.frequencyBinCount : fftSize / 2;
      // Ensure bufferLength is positive
      const validBufferLength = bufferLength > 0 ? bufferLength : 256;
    return {
        volume: 0,
        bass: 0,
        mid: 0,
        treble: 0,
        rawFrequencyData: new Uint8Array(validBufferLength).fill(0),
        rawTimeDomainData: new Uint8Array(validBufferLength).fill(128),
        isBeat: false
    };
}


// --- Start Initialization --- Only after DOM is ready!

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed.");
    getDOMElements();
    console.log("Starting initialization...");
    initThreeJS();
    initAudio();
    // Initialize the default visualization mode AFTER core setup
    if (currentVisMode) {
         console.log(`Initializing default mode: ${currentVisMode}`);
        initVisualsForMode(currentVisMode);
    }
    console.log("Initialization complete. Waiting for audio file...");
}); 