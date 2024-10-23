import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

let mediaRecorder;
let timestamps = { start: null, end: null }
let videoFile;
let ffmpeg;
const videoFileType = 'video/mp4'
const videoFileExt = 'mp4'

window.onClickStart = async function () {
    let recordedChunks = [];
    let stream;
    const timer = createTimer((seconds) => {
        document.getElementById('status').hidden = false
        document.getElementById('status').textContent = `Recording... ${formatVideoTime(seconds, 'short')}`
    })
    try {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    } catch (error) {
        document.getElementById('status').textContent = "Screen capture is not allowed in this browser"
        return
    }

    const video = document.getElementById('video')
    URL.revokeObjectURL(video.src);
    video.src = ""

    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };

    mediaRecorder.onstop = async () => {
        stream.getAudioTracks().forEach(track => {
            track.enabled = false;
            track.stop();
        });
        stream.getVideoTracks().forEach(track => {
            track.enabled = false;
            track.stop();
        });
        timer.stop()
        onMediaRecorderStop()
        const blob = new Blob(recordedChunks, { type: videoFileType });
        recordedChunks = []
        const url = URL.createObjectURL(blob);
        videoFile = new File([blob], `recording.${videoFileExt}`, { type: videoFileType });
        video.src = url;
        video.load();
        video.autoplay = true;
    };
    mediaRecorder.onerror = event => {
        alert('Recording error:', event.error)
    }

    mediaRecorder.start();
    timer.start()
    videoFile = undefined;
    timestamps = { start: null, end: null }
    onMediaRecorderStart()
};

window.onClickStop = async function () {
    mediaRecorder.stop();
    onMediaRecorderStop()
};

window.onClickSetStart = function () {
    setTimestamp("start", document.getElementById('video').currentTime)
}

window.onClickSetEnd = function () {
    setTimestamp("end", document.getElementById('video').currentTime)
}

window.onClickDownload = async function () {
    onDownloading()
    try {
        const compressedVideo = await compressVideo()
        saveFile(compressedVideo)
    } catch (error) {
        console.log(error)
    } finally {
        onDownloaded()
    }
}

document.getElementById('video').ondurationchange = () => {
    const video = document.getElementById('video')
    const duration = video.duration
    if (duration === Infinity) return
    setTimestamp("start", 0)
    setTimestamp("end", video.duration)
    onVideoLoaded()
}

window.addEventListener('resize', updateVideoContainerHeight);

function setTimestamp(type, time) {
    timestamps[type] = time
    document.getElementById(`time-${type}`).textContent = formatVideoTime(time)
}

function onMediaRecorderStart() {
    document.getElementById('start').disabled = true;
    document.getElementById('stop').disabled = false;
    document.getElementById('set-start').disabled = true
    document.getElementById('set-end').disabled = true
    document.getElementById('video-timestamps').hidden = true
    document.getElementById('video-container').hidden = true
    document.getElementById('download').disabled = true
    document.getElementById('status').hidden = false
    document.getElementById('status').textContent = "Recording... 00:00"
}

function onMediaRecorderStop() {
    document.getElementById('start').disabled = false;
    document.getElementById('stop').disabled = true;
    document.getElementById('status').hidden = false
    document.getElementById('status').textContent = "Loading..."
}

function onVideoLoaded() {
    document.getElementById('set-start').disabled = false
    document.getElementById('set-end').disabled = false
    document.getElementById('download').disabled = false
    document.getElementById('video-timestamps').hidden = false
    document.getElementById('video-container').hidden = false
    document.getElementById('status').hidden = true
    document.getElementById('status').textContent = ""
    updateVideoContainerHeight()
}

function onDownloading() {
    document.getElementById("start").disabled = true
    document.getElementById("stop").disabled = true
    document.getElementById("set-start").disabled = true
    document.getElementById("set-end").disabled = true
    document.getElementById("download").disabled = true
    document.getElementById('status').hidden = false
    document.getElementById('status').textContent = "Processing..."
}

function onDownloaded() {
    document.getElementById("start").disabled = false
    document.getElementById("stop").disabled = true
    document.getElementById("set-start").disabled = false
    document.getElementById("set-end").disabled = false
    document.getElementById("download").disabled = false
    document.getElementById('status').hidden = true
    document.getElementById('status').textContent = ""
}

async function compressVideo() {
    if (!videoFile) return
    if (!ffmpeg) ffmpeg = new FFmpeg()
    const compressedFileName = `Screen recording ${getTodaysDate()}.${videoFileExt}`;
    if (!ffmpeg.loaded) await ffmpeg.load();

    // Write the video file to FFmpeg's filesystem
    const { name } = videoFile
    await ffmpeg.writeFile(name, await fetchFile(videoFile));
    const status = document.getElementById('status')
    ffmpeg.on("log", ({ message }) => {
        status.textContent = `Processing: ${message}`;
    })

    // Run FFmpeg command to compress the video
    const trimArgs = []
    if (timestamps.start) {
        trimArgs.push('-ss', String(timestamps.start))
    }
    if (timestamps.end) {
        trimArgs.push('-to', String(timestamps.end))
    }
    await ffmpeg.exec(['-i', name, '-c:v', 'libx264', '-crf', '28', ...trimArgs, compressedFileName]);


    // Read the compressed video from FFmpeg's filesystem
    const data = await ffmpeg.readFile(compressedFileName);

    // Create a Blob from the compressed data and generate a download link
    const compressedBlob = new Blob([data.buffer], { type: videoFileType });
    const compressedUrl = URL.createObjectURL(compressedBlob);

    return { url: compressedUrl, fileName: compressedFileName, blob: compressedBlob }
}

function formatVideoTime(currentTime, type = 'long') {
    // Calculate hours, minutes, seconds and milliseconds
    const minutes = Math.floor(currentTime / 60);
    const seconds = Math.floor(currentTime % 60);
    const milliseconds = Math.floor((currentTime - Math.floor(currentTime)) * 1000);

    // Format the time as "mm:ss.ms"
    if (type === 'short') {
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    } else {
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
    }
}

function getTodaysDate() {
    const today = new Date();

    // Get year, month, day, hours, minutes, and seconds
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are zero-based
    const day = String(today.getDate()).padStart(2, '0');
    const hours = String(today.getHours()).padStart(2, '0');
    const minutes = String(today.getMinutes()).padStart(2, '0');
    const seconds = String(today.getSeconds()).padStart(2, '0');

    // Format the date string
    return `${year}-${month}-${day} ${hours}${minutes}${seconds}`;
}

function updateVideoContainerHeight() {
    if (!document.getElementById('video').src) return

    const video = document.getElementById('video')
    const aspectRatio = video.videoWidth / video.videoHeight
    video.hidden = true
    const containerHeight = document.getElementById('video-container').clientHeight
    const containerWidth = containerHeight * aspectRatio
    document.getElementById('video-container').style.width = `${containerWidth}px`;
    video.hidden = false
}

function saveFile(compressedVideo) {
    const link = document.createElement('a');
    link.href = compressedVideo.url;
    link.download = compressedVideo.fileName;
    document.body.appendChild(link); // Append to body for Firefox compatibility
    link.click();
    URL.revokeObjectURL(link.href); // Clean up
    document.body.removeChild(link); // Remove link after clicking
}

function createTimer(updateCallback, interval = 1000) {
    let timerInterval;
    let seconds = 0;
    let isRunning = false;

    return {
        start: () => {
            if (!isRunning) {
                isRunning = true; // Set the running flag
                timerInterval = setInterval(() => {
                    seconds++; // Increment seconds
                    updateCallback(seconds); // Call the update callback with the current seconds
                }, interval);
            }
        },
        stop: () => {
            if (isRunning) {
                clearInterval(timerInterval); // Stop the interval
                isRunning = false; // Reset the running flag
            }
        }
    };
}
