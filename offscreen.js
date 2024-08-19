chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  console.log("[offscreen] message received", message, sender);

  switch (message.type) {
    case "start-recording":
      console.log("start recording received in offscreen.js");

      await startRecording(message.data, message.quality);
      sendResponse({ status: "recording-started" });
      break;
    case "stop-recording":
      console.log("stop recording received in offscreen.js");

      await stopRecording();
      // chrome.offscreen.closeDocument();
      sendResponse({ status: "recording-stopped" });
      break;
    default:
      console.log("default");
      sendResponse({ status: "unknown-message" });
  }

  return true; 
});


let recorder;
let data = [];

async function stopRecording() {
  console.log("Entered stopRecording");

  if (recorder?.state === "recording") {
    console.log("Recorder state is 'recording', stopping...");
    recorder.stop();

    // Send a message to the content script to stop the camera
    chrome.runtime.sendMessage({ type: "stop-camera" }, response => {
      if (response?.status === "camera-stopped") {
        console.log("Camera has been successfully stopped.");
      } else {
        console.log("Failed to stop the camera.");
      }
    });
  } else {
    console.log("No active recording found or recorder is not in 'recording' state.");
  }

  console.log("Stopped the recording");
}

function stopAllMediaStreams(media, microphone) {
  media.getTracks().forEach((track) => {
    track.stop();
    console.log("Media Track stopped:", track);
  });

  microphone.getTracks().forEach((track) => {
    track.stop();
    console.log("Microphone Track stopped", track);
  });
}

async function startRecording(streamId, quality) {
  try {
    if (recorder?.state === "recording") {
      throw new Error("Called startRecording while recording is in progress.");
    }

    console.log("start recording", streamId);
    console.log("qaulity inside offfscreen.js", quality);


    let videoConstraints;

    switch (quality) {
      case "low":
        videoConstraints = {
          mandatory: {
            chromeMediaSource: "tab",
            chromeMediaSourceId: streamId,
            maxWidth: 640,
            maxHeight: 480,
            minWidth: 640,
            minHeight: 480,
            maxFrameRate: 15,
          },
        };
        break;
      case "medium":
        videoConstraints = {
          mandatory: {
            chromeMediaSource: "tab",
            chromeMediaSourceId: streamId,
            maxWidth: 1280,
            maxHeight: 720,
            minWidth: 1280,
            minHeight: 720,
            maxFrameRate: 30,
          },
        };
        break;
      case "high":
        videoConstraints = {
          mandatory: {
            chromeMediaSource: "tab",
            chromeMediaSourceId: streamId,
            maxWidth: 1920,
            maxHeight: 1080,
            minWidth: 1920,
            minHeight: 1080,
            maxFrameRate: 60,
          },
        };
        break;
      default:
        videoConstraints = {
          mandatory: {
            chromeMediaSource: "tab",
            chromeMediaSourceId: streamId,
          },
        };
    }


   
    const media = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: streamId,
        },
      },
      video: videoConstraints
    });

  
    const microphone = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false },
    });
   
    const mixedContext = new AudioContext();
    const mixedDest = mixedContext.createMediaStreamDestination();

    mixedContext.createMediaStreamSource(microphone).connect(mixedDest);
    mixedContext.createMediaStreamSource(media).connect(mixedDest);

    const combinedStream = new MediaStream([
      media.getVideoTracks()[0],
      mixedDest.stream.getTracks()[0],
    ]);

    recorder = new MediaRecorder(combinedStream, { mimeType: "video/webm" });

   
    recorder.ondataavailable = (event) => {
      console.log("data available", event);
      data.push(event.data);
    };

    
    recorder.onstop = async () => {
      console.log("recording stopped");
      // send the data to the service worker
      console.log("sending data to service worker");
      stopAllMediaStreams(media, microphone);

      recorder = null;

     
      const blob = new Blob(data, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
    
      chrome.runtime.sendMessage({ type: "open-tab", url });
    };


    recorder.start();
  } catch (err) {
    console.log("error", err);
  }
}