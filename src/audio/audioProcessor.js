// Audio processing module

let audioContext, analyser, sourceNode, gainNode;
let audioBuffer;
let frequencyDataArray, timeDomainDataArray;
let isPlaying = false;
let startTime = 0; // To track playback time offset for pause/resume/seek
let startedAt = 0; // audioContext.currentTime when playback most recently started

// --- Audio Analysis Parameters ---
const fftSize = 1024;

// --- Beat Detection Parameters ---
const beatHistorySize = 60;
const beatThreshold = 1.3;
const beatCooldown = 150;
let energyHistory = [];
let timeSinceLastBeat = 0;
let lastFrameTime = performance.now();

// Initialize audio context and analyzer
function initAudio(volumeSlider) {
    if (!volumeSlider) {
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
}

// Start audio playback from specified offset
function startPlayback(offset = 0, onEnded, uiControls) {
    const { playPauseButton, fileLabel } = uiControls;
    
    // Check prerequisites
    if (!audioBuffer || !audioContext || !analyser || !gainNode || !playPauseButton) {
        // console.error("Cannot start playback: missing audio buffer or core components.");
        return false;
    }
    
    // Ensure offset is valid
    const validOffset = Math.max(0, Math.min(offset, audioBuffer.duration));
    // console.log(`Starting playback from offset: ${validOffset.toFixed(2)}s`);

    // Clean up previous node if it exists
    if (sourceNode) {
        try { sourceNode.disconnect(); } catch(e) {}
        sourceNode = null;
    }

    // CRITICAL FIX: Always set startTime to the offset
    // This ensures correct progress calculation when seeking during playback
    startTime = validOffset;

    sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.connect(analyser);
    sourceNode.connect(gainNode);

    sourceNode.onended = () => {
        // isPlaying is checked to differentiate pause from natural end
        const naturallyEnded = isPlaying && (audioContext.currentTime - startedAt + startTime >= audioBuffer.duration - 0.1);

        isPlaying = false; // Update state
        if (playPauseButton) playPauseButton.textContent = '▶️'; // Set icon to Play
        // Re-enable button only if buffer still exists
        if (playPauseButton && audioBuffer) playPauseButton.disabled = false;

        if (naturallyEnded) {
             startTime = 0; // Reset start time
        }
        
        // Clear the source node reference
        sourceNode = null;
        
        // Call the onEnded callback with information about how playback ended
        if (onEnded) onEnded(naturallyEnded);
    };

    try {
        // CRITICAL: Reset startedAt to the current audioContext time
        // This ensures the progress bar calculation works correctly
        startedAt = audioContext.currentTime;
        
        // Start the audio node from the beginning but at the calculated offset
        sourceNode.start(0, validOffset);
        
        isPlaying = true;
        playPauseButton.textContent = '⏸️'; // Pause Icon
        playPauseButton.disabled = false; // Ensure enabled
        
        // console.log(`Playback started at: ${startedAt}, with offset: ${validOffset}, startTime set to: ${startTime}`);
        return true;
    } catch (e) {
        // console.error("Error starting sourceNode:", e);
        alert("Error starting audio playback.");
        return false;
    }
}

// Handle audio file loading and decoding
function loadAudioFile(file, onSuccess, onError) {
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        if (audioContext.state === 'suspended') {
            audioContext.resume().catch(err => console.error("Error resuming context:", err));
        }
        audioContext.decodeAudioData(e.target.result,
            (buffer) => {
                audioBuffer = buffer;
                if (onSuccess) onSuccess(buffer);
            },
            (error) => {
                console.error("Error decoding audio data:", error);
                alert('Error decoding audio file.');
                if (onError) onError(error);
            }
        );
    };
    reader.onerror = (e) => {
        console.error("FileReader error:", e);
        alert('Error reading file.');
        if (onError) onError(e);
    };
    reader.readAsArrayBuffer(file);
}

// Update volume level
function setVolume(value) {
    if (!gainNode) return;
    const volume = value / 100;
    gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.05);
}

// Stop audio playback (for pause)
function stopPlayback() {
    // Calculate elapsed time but don't add to startTime here
    // This prevents cumulative errors in the time calculation
    if (isPlaying && audioContext.currentTime > 0) {
        // Instead of incrementing startTime, just store the current playback position
        // This ensures we have the exact position when stopping
        startTime = getCurrentTime();
        // console.log(`Stopping playback at position: ${startTime.toFixed(2)}s`);
    }
    
    if (sourceNode) {
        sourceNode.onended = null; // Prevent onended logic during pause
        try { 
            sourceNode.stop(); 
        } catch(e) {
            // console.warn("Error stopping sourceNode:", e);
        }
        sourceNode = null;
    }
    
    isPlaying = false;
}

// Set the playback position when paused
function setStartTime(time) {
    // Simply update the time directly - minimize conditions that could fail
    // This function now intentionally works even during playback
    if (!audioBuffer) {
        // console.warn("No audio buffer loaded");
        return false;
    }
    
    // Ensure time is a valid number
    if (typeof time !== 'number') {
        time = parseFloat(time);
    }
    
    if (isNaN(time)) {
        // console.warn("Invalid time:", time);
        return false;
    }
    
    // Clamp time to valid range
    startTime = Math.max(0, Math.min(time, audioBuffer.duration));
    // console.log("Audio startTime set to:", startTime);
    return true;
}

// Calculate audio features from analyzer data
function calculateAudioFeatures() {
    // Ensure analyser and arrays are ready
    if (!analyser || !frequencyDataArray || !timeDomainDataArray) {
        return createDefaultFeatures();
    }

    // Update analyzer data
    try {
        analyser.getByteFrequencyData(frequencyDataArray);
        analyser.getByteTimeDomainData(timeDomainDataArray);
    } catch (e) {
        console.error("Error getting audio data:", e);
        return createDefaultFeatures();
    }

    let bass = 0, mid = 0, treble = 0, volume = 0;
    const bufferLength = analyser.frequencyBinCount;
    
    // Adjust frequency ranges for better audio visualization
    const bassEnd = Math.floor(bufferLength * 0.1);     // Low frequencies (0-10%)
    const midEnd = Math.floor(bufferLength * 0.5);      // Mid frequencies (10-50%)
    // Treble is the rest (50-100%)
    
    let currentEnergy = 0;

    // Ensure bufferLength is valid
    if (bufferLength <= 0) return createDefaultFeatures();

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

    // Check for division by zero
    const validBassEnd = bassEnd > 0 ? bassEnd : 1;
    const validMidRange = (midEnd - bassEnd) > 0 ? (midEnd - bassEnd) : 1;
    const validTrebleRange = (bufferLength - midEnd) > 0 ? (bufferLength - midEnd) : 1;

    // Calculate averages
    volume /= bufferLength;
    bass /= validBassEnd;
    mid /= validMidRange;
    treble /= validTrebleRange;
    currentEnergy /= bufferLength;

    // Scale from 0-255 to 0-1 with a bit more emphasis on lower values
    const normalizedBass = Math.pow(bass / 255, 0.8);
    const normalizedMid = Math.pow(mid / 255, 0.8);
    const normalizedTreble = Math.pow(treble / 255, 0.8);
    const normalizedVolume = Math.pow(volume / 255, 0.8);

    // Increase energy threshold for more pronounced beat detection
    let isBeat = false;
    const now = performance.now();
    // Ensure lastFrameTime is valid before calculating timeSinceLastBeat
    const validLastFrameTime = lastFrameTime > 0 ? lastFrameTime : now - 16.67;
    timeSinceLastBeat += (now - validLastFrameTime);
    lastFrameTime = now;

    // Beat detection with custom threshold based on bass impact
    if (energyHistory.length > 0) {
        let avgEnergy = energyHistory.reduce((sum, val) => sum + val, 0) / energyHistory.length;
        
        // Adjust beat threshold based on how much bass is present
        const dynamicThreshold = beatThreshold * (0.8 + normalizedBass * 0.5);
        
        // Detect beat when energy spikes and cooldown period has passed
        if (currentEnergy > avgEnergy * dynamicThreshold + 1e-4 && timeSinceLastBeat > beatCooldown) {
            isBeat = true;
            timeSinceLastBeat = 0;
            // console.log("BEAT DETECTED! Energy:", currentEnergy.toFixed(2), "Avg:", avgEnergy.toFixed(2), "Ratio:", (currentEnergy/avgEnergy).toFixed(2));
        }
    }

    // Keep energy history for beat detection
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

// Reset audio state
function resetAudio() {
    if (sourceNode) {
        try { sourceNode.disconnect(); } catch (e) { /* Ignore */ }
        sourceNode = null;
    }
    audioBuffer = null;
    isPlaying = false;
    startTime = 0;
    startedAt = 0;
}

// Get current playback position
function getCurrentTime() {
    if (!audioBuffer || !isPlaying) return startTime;
    return audioContext.currentTime - startedAt + startTime;
}

// Get total duration
function getDuration() {
    return audioBuffer ? audioBuffer.duration : 0;
}

// Update the last frame time for beat detection
// This is useful when the animation is running while audio is paused
function updateLastFrameTime(currentTime) {
    if (currentTime) {
        lastFrameTime = currentTime;
    } else {
        lastFrameTime = performance.now();
    }
}

// Export module functions and state
export {
    initAudio,
    loadAudioFile,
    startPlayback,
    stopPlayback,
    setVolume,
    setStartTime,
    calculateAudioFeatures,
    createDefaultFeatures,
    resetAudio,
    getCurrentTime,
    getDuration,
    updateLastFrameTime,
    // States
    audioBuffer,
    isPlaying
}; 