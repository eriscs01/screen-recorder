const ffmpeg = FFmpeg.createFFmpeg({ log: true });

let mediaRecorder;
let recordedChunks = [];
let timeStart;
let timeEnd;
let videoFile;
const inputFileType = 'video/webm'

document.getElementById('start').onclick = async () => {
    const stream = await navigator.mediaDevices.getDisplayMedia();

    const video = document.getElementById('video')
    video.src = ""

    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };

    mediaRecorder.onstop = async () => {
        stream.getAudioTracks().forEach(track => {
            track.enabled = false; // Mute audio
        });
        stream.getVideoTracks().forEach(track => {
            track.enabled = false; // Pause video
        });
        onMediaRecorderStop()
        const blob = new Blob(recordedChunks, { type: inputFileType });
        const url = URL.createObjectURL(blob);
        videoFile = new File([blob], 'recording.webm', { type: inputFileType });
        video.src = url;
        video.load();
        video.autoplay = true;
    };
    mediaRecorder.onerror = event => {
        alert('Recording error:', event.error)
    }

    mediaRecorder.start();
    videoFile = undefined;
    timeStart = undefined;
    timeEnd = undefined;
    onMediaRecorderStart()
};

document.getElementById('stop').onclick = () => {
    mediaRecorder.stop();
    onMediaRecorderStop()
};

document.getElementById('set-start').onclick = () => {
    setStartTime(document.getElementById('video').currentTime)
}

document.getElementById('set-end').onclick = () => {
    setEndTime(document.getElementById('video').currentTime)
}

document.getElementById('video').ondurationchange = () => {
    const video = document.getElementById('video')
    const duration = video.duration
    if (duration === Infinity) return
    setStartTime(0)
    setEndTime(video.duration)
    onVideoLoaded()
    document.getElementById('download').onclick = async () => {
        onDownloading()
        const compressedVideo = await compressVideo()
        const a = document.createElement("a")
        a.href = compressedVideo.url;
        a.download = compressedVideo.fileName;
        a.click()
        onDownloaded()
    };
}

window.addEventListener('resize', updateVideoContainerHeight);

function setStartTime(time) {
    timeStart = time
    document.getElementById('time-start').textContent = formatVideoTime(timeStart)
}

function setEndTime(time) {
    timeEnd = time
    document.getElementById('time-end').textContent = formatVideoTime(timeEnd)
}

function onMediaRecorderStart() {
    document.getElementById('start').disabled = true;
    document.getElementById('stop').disabled = false;
    document.getElementById('set-start').disabled = true
    document.getElementById('set-end').disabled = true
    document.getElementById('video-timestamps').hidden = true
    document.getElementById('video-container').hidden = true
    document.getElementById('download').disabled = true
    document.getElementById('download').textContent = "Download"
    document.getElementById('status').hidden = false
    document.getElementById('status').textContent = "Recording..."
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
    const compressedFileName = `Screen recording ${getTodaysDate()}.mp4`;
    if (!ffmpeg.isLoaded()) await ffmpeg.load();

    // Write the video file to FFmpeg's filesystem
    ffmpeg.FS('writeFile', 'input.webm', await FFmpeg.fetchFile(videoFile));

    ffmpeg.setLogger(function ({ type, message }) {
        document.getElementById('status').textContent = `Processing: ${message}`;
    })

    // Run FFmpeg command to compress the video
    await ffmpeg.run('-i', 'input.webm', '-c:v', 'libx264', '-crf', '28', '-ss', String(timeStart), '-to', String(timeEnd), compressedFileName);


    // Read the compressed video from FFmpeg's filesystem
    const data = ffmpeg.FS('readFile', compressedFileName);

    // Create a Blob from the compressed data and generate a download link
    const compressedBlob = new Blob([data.buffer], { type: 'video/mp4' });
    const compressedUrl = URL.createObjectURL(compressedBlob);

    return { url: compressedUrl, fileName: compressedFileName }
}

function formatVideoTime(currentTime) {
    // Calculate hours, minutes, seconds and milliseconds
    const hours = Math.floor(currentTime / 3600);
    const minutes = Math.floor((currentTime % 3600) / 60);
    const seconds = Math.floor(currentTime % 60);
    const milliseconds = Math.floor((currentTime - Math.floor(currentTime)) * 1000);

    // Format the time as "HH:mm:ss.ms"
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
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
