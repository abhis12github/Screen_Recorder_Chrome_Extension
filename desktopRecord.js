const convertBlobToBase64 = (blob) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = () => {
      const base64data = reader.result;
      resolve(base64data);
    };
  });
};

const fetchBlob = async (url) => {
  const response = await fetch(url);
  const blob = await response.blob();
  const base64 = await convertBlobToBase64(blob);
  return base64;
};

// listen for messages from the service worker - start recording  - stop recording
chrome.runtime.onMessage.addListener(function (request, sender) {
  console.log("message received", request, sender);

  switch (request.type) {
    case "start-recording":
      startRecording(request.focusedTabId, request.quality);
      break;
    case "stop-recording":
      stopRecording();
      break;
    default:
      console.log("default");
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
  

    chrome.runtime.sendMessage({ type: "stop-camera" }, response => {
      if (response?.status === "camera-stopped") {
        console.log("Camera has been successfully stopped.");
      } else {
        console.log("Failed to stop the camera.");
      }
    });


    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, { type: "stop-camera" }, (response) => {
          if (response?.status === "camera-stopped") {
            console.log(`Camera stopped on tab ${tab.id}`);
          } else {
            console.log(`Failed to stop the camera on tab ${tab.id}`);
          }
        });
      });
    });

  } else {
    console.log("No active recording found or recorder is not in 'recording' state.");
  }

  console.log("Stopped the recording");
}


function stopAllMediaStreams(stream, microphone) {
  stream.getTracks().forEach((track) => {
    track.stop();
    console.log("Media Track stopped:", track);
  });

  microphone.getTracks().forEach((track) => {
    track.stop();
    console.log("Microphone Track stopped", track);
  });
}

const startRecording = async (focusedTabId, quality) => {
 
  console.log("inside desktopRecord.js", quality);

  if (recorder) {
    stopRecording();
  }


  chrome.desktopCapture.chooseDesktopMedia(
    ["screen", "window"],
    async function (streamId) {
      if (streamId === null) {
        return;
      }
   
      console.log("stream id from desktop capture", streamId);

      let videoConstraints;

      switch (quality) {
        case "low":
          videoConstraints = {
            mandatory: {
              chromeMediaSource: "desktop",
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
              chromeMediaSource: "desktop",
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
              chromeMediaSource: "desktop",
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
              chromeMediaSource: "desktop",
              chromeMediaSourceId: streamId,
            },
          };
      }



      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: streamId,
          },
        },
        video: videoConstraints
      });

      console.log("stream from desktop capture", stream);

      // get the microphone stream
      const microphone = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false },
      });

      // check that the microphone stream has audio tracks
      if (microphone.getAudioTracks().length !== 0) {
        const combinedStream = new MediaStream([
          stream.getVideoTracks()[0],
          microphone.getAudioTracks()[0],
        ]);

        console.log("combined stream", combinedStream);

        recorder = new MediaRecorder(combinedStream, {
          mimeType: "video/webm",
        });

        recorder.ondataavailable = (event) => {
          console.log("data available", event);
          data.push(event.data);
        };

        recorder.onstop = async () => {
          console.log("recording stopped");
          // send the data to the service worker

          stopAllMediaStreams(stream, microphone);
          recorder = null;

          const blobFile = new Blob(data, { type: "video/webm" });
          const base64 = await fetchBlob(URL.createObjectURL(blobFile));

          // send message to service worker to open tab
          console.log("send message to open tab", base64);
          chrome.runtime.sendMessage({ type: "open-tab", base64 });

          data = [];
        };

        recorder.start();

        if (focusedTabId) {
          chrome.tabs.update(focusedTabId, { active: true });
        }
      }

      return;
    }
  );
};


