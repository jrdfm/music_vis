// Main application module
import * as AudioProcessor from './audio/audioProcessor.js';
import * as ThreeManager from './visualization/threeManager.js';
import * as Visualizers from './visualization/visualizers.js';
import * as UIManager from './ui/uiManager.js';

// Animation loop state
let animationFrameId = null;
let lastFrameTime = performance.now();

// Mouse tracking for camera interaction
let mouseX = 0;
let mouseY = 0;
let windowHalfX = window.innerWidth / 2;
let windowHalfY = window.innerHeight / 2;

// Setup mouse interaction
function setupMouseInteraction() {
    document.addEventListener('mousemove', (event) => {
        mouseX = event.clientX - windowHalfX;
        mouseY = event.clientY - windowHalfY;
    });
    
    // Update window dimensions on resize
    window.addEventListener('resize', () => {
        windowHalfX = window.innerWidth / 2;
        windowHalfY = window.innerHeight / 2;
    });
}

// Handle file selection
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) {
        UIManager.setLoadingState();
        return;
    }
    
    // Stop any current playback
    if (AudioProcessor.isPlaying) {
        handlePlayPause();
    }
    
    // Reset UI to loading state
    UIManager.resetUI();
    UIManager.setLoadingState(file.name);
    
    // Load and decode the audio file
    AudioProcessor.loadAudioFile(file, 
        // Success callback
        (buffer) => {
            UIManager.setAudioLoadedState(file.name, buffer.duration);
            
            // Initialize visuals if needed
            Visualizers.initVisualsForMode(Visualizers.getVisualizationMode());
            
            // Start animation loop if not already running
            if (!animationFrameId) {
                lastFrameTime = performance.now();
                animate();
            }
        },
        // Error callback
        (error) => {
            UIManager.resetUI();
            UIManager.setLoadingState();
        }
    );
}

// Handle play/pause button
function handlePlayPause() {
    if (!AudioProcessor.audioBuffer) return;
    
    if (AudioProcessor.isPlaying) {
        // Pause playback
        AudioProcessor.stopPlayback();
        UIManager.updatePlayPauseButton(false);
        
        // Do NOT stop the animation loop - keep it running to update UI
        // This was causing progress bar not to update when paused
        /* 
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        */
    } else {
        // Start/resume playback
        const uiControls = {
            playPauseButton: UIManager.getUIElements().playPauseButton,
            fileLabel: UIManager.getUIElements().fileLabel
        };
        
        const startSuccess = AudioProcessor.startPlayback(
            AudioProcessor.getCurrentTime(), 
            handlePlaybackEnded,
            uiControls
        );
        
        if (startSuccess) {
            UIManager.updatePlayPauseButton(true);
            
            // Restart animation loop if needed
            if (!animationFrameId) {
                lastFrameTime = performance.now();
                animate();
            }
        }
    }
}

// Handle playback ended event
function handlePlaybackEnded(naturallyEnded) {
    if (naturallyEnded) {
        UIManager.setPlaybackFinished(AudioProcessor.getDuration());
    }
}

// Handle volume change
function handleVolumeChange(event) {
    AudioProcessor.setVolume(event.target.value);
}

// Handle seeking in the track
function handleSeek(event) {
    if (!AudioProcessor.audioBuffer) return;
    
    // Stop any event propagation
    event.preventDefault();
    event.stopPropagation();
    
    // Get precise click position
    const bounds = UIManager.getUIElements().progressBarContainer.getBoundingClientRect();
    const clickX = event.clientX - bounds.left;
    const width = bounds.width;
    
    if (width <= 0) return;
    
    // Calculate seek position
    const seekRatio = Math.max(0, Math.min(1, clickX / width));
    const duration = AudioProcessor.getDuration();
    const seekTime = seekRatio * duration;
    
    console.log(`Seek: ${seekTime.toFixed(2)}s / ${duration.toFixed(2)}s (${(seekRatio * 100).toFixed(1)}%)`);
    
    // 1. FORCE the progress bar to update immediately using our dedicated function
    UIManager.forceProgressBarUpdate(seekRatio * 100);
    
    // Update time display directly
    const currentTimeDisplay = UIManager.getUIElements().currentTimeDisplay;
    if (currentTimeDisplay) {
        currentTimeDisplay.textContent = UIManager.formatTime(seekTime);
    }
    
    // 2. Handle actual audio seeking
    if (AudioProcessor.isPlaying) {
        // For playing audio: stop current playback
        AudioProcessor.stopPlayback();
        
        // Create a slight delay to ensure UI updates before playback resumes
        setTimeout(() => {
            const uiControls = {
                playPauseButton: UIManager.getUIElements().playPauseButton,
                fileLabel: UIManager.getUIElements().fileLabel
            };
            
            // Start playback from the new position
            // This will properly set both startTime and startedAt in AudioProcessor
            AudioProcessor.startPlayback(seekTime, handlePlaybackEnded, uiControls);
        }, 10);
    } else {
        // For paused audio: just update the start time
        AudioProcessor.setStartTime(seekTime);
        
        // Force another UI update after setting the time
        setTimeout(() => {
            // Use both update methods to ensure it works
            UIManager.updateProgressUI(seekTime, duration);
            UIManager.forceProgressBarUpdate(seekRatio * 100);
        }, 0);
    }
    
    // 3. Make sure animation loop is running
    if (!animationFrameId) {
        lastFrameTime = performance.now();
        animate();
    }
}

// Handle visualization mode change
function handleModeChange(event) {
    Visualizers.switchVisualMode(event.target.value);
}

// Handle color change
function handleColorChange(event) {
    Visualizers.setSphereColor(event.target.value);
}

// Animation loop
function animate() {
    animationFrameId = requestAnimationFrame(animate);

    const currentTime = performance.now();
    const deltaTime = currentTime - lastFrameTime;
    lastFrameTime = currentTime;

    // Get current audio time and duration
    const audioCurrentTime = AudioProcessor.getCurrentTime();
    const audioDuration = AudioProcessor.getDuration();
    
    // Update progress UI regardless of playing status
    // When paused, getCurrentTime() returns startTime which is what we set during seeking
    UIManager.updateProgressUI(audioCurrentTime, audioDuration);
    
    // Also use the forced update method for progress bar - for redundancy
    if (audioDuration > 0) {
        const percent = (audioCurrentTime / audioDuration) * 100;
        // Only update periodically to avoid performance issues
        if (!animate.lastProgressUpdate || currentTime - animate.lastProgressUpdate > 250) {
            animate.lastProgressUpdate = currentTime;
            UIManager.forceProgressBarUpdate(percent);
        }
    }

    // Update camera for interactive visualizations like snowflakes
    if (Visualizers.getVisualizationMode() === 'snowflakes') {
        ThreeManager.updateCamera(mouseX, mouseY);
    }

    // Get audio features
    let features;
    if (AudioProcessor.isPlaying) {
        features = AudioProcessor.calculateAudioFeatures();
    } else {
        features = AudioProcessor.createDefaultFeatures();
        
        // When paused, we still need to update the lastFrameTime for beat detection
        // This prevents issues when resuming playback
        AudioProcessor.updateLastFrameTime(currentTime);
    }

    // Update visualizations based on audio features
    Visualizers.updateVisualization(features, deltaTime);
    
    // Render the scene
    ThreeManager.render();
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM loaded, initializing application...");
    
    // Get UI elements
    const uiElements = UIManager.initUI();
    
    // Initialize Three.js with the canvas element
    const canvas = document.getElementById('visualizerCanvas');
    if (!ThreeManager.init(canvas)) {
        console.error("Failed to initialize Three.js");
    }
    
    // Initialize Audio
    AudioProcessor.initAudio(UIManager.getUIElements().volumeSlider);
    
    // Setup event handlers
    UIManager.setupEventListeners({
        onFileSelect: handleFileSelect,
        onPlayPause: handlePlayPause,
        onVolumeChange: handleVolumeChange,
        onSeek: handleSeek,
        onModeChange: handleModeChange,
        onColorChange: handleColorChange
    });
    
    // Setup mouse tracking for camera interactions
    setupMouseInteraction();
    
    console.log("Application initialized successfully");
}); 