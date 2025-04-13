// UI Manager module for handling DOM elements and interactions

// UI element references
let fileInput, fileLabel, playPauseButton, volumeSlider, canvas;
let progressBarContainer, progressBar, currentTimeDisplay, totalDurationDisplay; 
let visModeSelect, sphereColorPicker;

// Initialize and get DOM elements
function initUI() {
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
    
    return {
        allElementsFound: !!(fileInput && fileLabel && playPauseButton && volumeSlider && 
                          canvas && progressBarContainer && progressBar && 
                          currentTimeDisplay && totalDurationDisplay && 
                          visModeSelect && sphereColorPicker)
    };
}

// Setup event listeners - pass callback functions
function setupEventListeners({
    onFileSelect,
    onPlayPause,
    onVolumeChange,
    onSeek,
    onModeChange,
    onColorChange
}) {
    if (!fileInput || !playPauseButton || !volumeSlider || 
        !progressBarContainer || !visModeSelect || !sphereColorPicker) {
        return false;
    }
    
    fileInput.addEventListener('change', onFileSelect, false);
    playPauseButton.addEventListener('click', onPlayPause, false);
    volumeSlider.addEventListener('input', onVolumeChange, false);
    
    // Use mousedown instead of click for better responsiveness
    // Also add touch support for mobile devices
    progressBarContainer.addEventListener('mousedown', onSeek, false);
    progressBarContainer.addEventListener('touchstart', (e) => {
        // Convert touch event to compatible format for the handler
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY,
            bubbles: true
        });
        onSeek(mouseEvent);
        e.preventDefault(); // Prevent scrolling
    }, false);
    
    visModeSelect.addEventListener('change', onModeChange, false);
    sphereColorPicker.addEventListener('input', onColorChange, false);
    
    return true;
}

// Reset UI to initial state (no audio loaded)
function resetUI() {
    if (progressBar) progressBar.style.width = '0%';
    if (currentTimeDisplay) currentTimeDisplay.textContent = '0:00';
    if (totalDurationDisplay) totalDurationDisplay.textContent = '0:00';
    if (playPauseButton) {
        playPauseButton.textContent = '▶️'; // Play Icon
        playPauseButton.disabled = true;
    }
    if (volumeSlider) volumeSlider.disabled = true;
    if (progressBarContainer) progressBarContainer.style.cursor = 'default'; // Disable seeking cursor
}

// Set UI to "loading" state
function setLoadingState(filename) {
    resetUI();
    if (fileLabel) fileLabel.textContent = filename ? `Loading: ${filename}` : "Select Audio File";
}

// Set UI state after audio is successfully loaded
function setAudioLoadedState(filename, duration) {
    if (totalDurationDisplay) totalDurationDisplay.textContent = formatTime(duration);
    if (playPauseButton) playPauseButton.disabled = false;
    if (volumeSlider) volumeSlider.disabled = false;
    if (progressBarContainer) progressBarContainer.style.cursor = 'pointer';
    if (fileLabel) fileLabel.textContent = filename || "Select Audio File";
}

// Update play/pause button state
function updatePlayPauseButton(isPlaying) {
    if (playPauseButton) {
        playPauseButton.textContent = isPlaying ? '⏸️' : '▶️';
    }
}

// Update progress bar and time display
function updateProgressUI(currentTime, duration) {
    if (!progressBar || !currentTimeDisplay) return;
    
    // Handle edge cases
    if (typeof currentTime !== 'number' || isNaN(currentTime)) {
        console.warn("Invalid currentTime in updateProgressUI:", currentTime);
        currentTime = 0;
    }
    
    if (typeof duration !== 'number' || isNaN(duration) || duration <= 0) {
        // Don't show a warning as this might be a normal case when no audio is loaded
        duration = 1; // Use 1 as default to avoid division by zero
    }
    
    // Clamp values to valid ranges
    currentTime = Math.max(0, Math.min(currentTime, duration));
    const progress = (currentTime / duration) * 100;
    
    // Force progress bar update with specific styling to ensure browser repaints
    progressBar.style.width = `${Math.min(100, progress)}%`;
    progressBar.style.transition = progress < 1 ? 'none' : 'width 0.1s linear';
    
    // Update time display
    currentTimeDisplay.textContent = formatTime(currentTime);
    
    // Store last updated time to detect if we need to force an update
    if (!progressBar.lastUpdateTime || Math.abs(progressBar.lastUpdateTime - currentTime) > 0.1) {
        progressBar.lastUpdateTime = currentTime;
        
        // Force a repaint in some browsers by accessing offsetHeight
        // This can help ensure the progress bar visually updates
        progressBar.offsetHeight;
    }
}

// Set progress to 100% when playback finishes
function setPlaybackFinished(duration) {
    if (progressBar) progressBar.style.width = '100%';
    if (currentTimeDisplay && totalDurationDisplay) {
        currentTimeDisplay.textContent = totalDurationDisplay.textContent;
    }
}

// Format seconds into MM:SS format
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}

// Get the current value of the sphereColorPicker
function getCurrentColor() {
    return sphereColorPicker ? sphereColorPicker.value : "#00ff00";
}

// Get the current value of the visualization mode selector
function getCurrentMode() {
    return visModeSelect ? visModeSelect.value : "spheresAndParticles";
}

// Get the current volume value
function getCurrentVolume() {
    return volumeSlider ? volumeSlider.value : 80;
}

// Force update the progress bar with the most direct DOM manipulation
// This is designed to work even if other update methods fail
function forceProgressBarUpdate(percent) {
    if (!progressBar) return false;
    
    // Ensure percent is a valid number between 0-100
    if (typeof percent !== 'number') {
        percent = parseFloat(percent);
    }
    
    if (isNaN(percent)) {
        console.warn("Invalid percent for progress bar update:", percent);
        return false;
    }
    
    // Clamp to valid range
    percent = Math.max(0, Math.min(100, percent));
    
    // Use multiple approaches to ensure at least one works
    try {
        // 1. Direct attribute setting (most reliable)
        progressBar.setAttribute('style', `width: ${percent}% !important; transition: none !important;`);
        
        // 2. Style property setting
        progressBar.style.width = `${percent}%`;
        progressBar.style.transition = 'none';
        
        // 3. Force reflow/repaint
        void progressBar.offsetWidth;
        
        // 4. Use setTimeout for a second update attempt
        setTimeout(() => {
            progressBar.style.cssText = `width: ${percent}% !important;`;
            void progressBar.offsetWidth;
        }, 0);
        
        return true;
    } catch (e) {
        console.error("Error updating progress bar:", e);
        return false;
    }
}

// Get all UI elements
function getUIElements() {
    return {
        fileInput,
        fileLabel,
        playPauseButton,
        volumeSlider,
        canvas,
        progressBarContainer,
        progressBar,
        currentTimeDisplay,
        totalDurationDisplay,
        visModeSelect,
        sphereColorPicker
    };
}

// Export all functions and elements
export {
    initUI,
    setupEventListeners,
    resetUI,
    setLoadingState,
    setAudioLoadedState,
    updatePlayPauseButton,
    updateProgressUI,
    setPlaybackFinished,
    formatTime,
    getCurrentColor,
    getCurrentMode,
    getCurrentVolume,
    forceProgressBarUpdate,
    getUIElements
}; 