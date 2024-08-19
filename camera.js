let cameraStream = null;

const runCode = async () => {
  const cameraElement = document.querySelector("#camera");

  // first request permission to use camera and microphone
  const permissions = await navigator.permissions.query({
    name: "camera",
  });

  // prompt user to enable camera and microphone
  if (permissions.state === "prompt") {
    // trigger the permissions dialog
    await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    return;
  }

  if (permissions.state === "denied") {
    alert("Camera permissions denied");
    return;
  }

  const startCamera = async () => {
    const videoElement = document.createElement("video");
    videoElement.setAttribute("id", "cam");
    videoElement.setAttribute(
      "style",
      `
      height: 200px;
      border-radius: 100px;
      transform: scaleX(-1);
      `
    );
    videoElement.setAttribute("autoplay", true);
    videoElement.setAttribute("muted", true);

    cameraStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: true,
    });

    videoElement.srcObject = cameraStream;

    cameraElement.appendChild(videoElement);
  };


  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => {
        track.stop();
        console.log("Camera track stopped:", track);
      });
      cameraStream = null; // Clear the reference to the stream


      const cameraElement = document.getElementById("rusty-camera");
      if (cameraElement) {
        cameraElement.remove();
      }
      // Remove the video element
      const videoElement = document.getElementById("cam");
      if (videoElement) {
        videoElement.remove();
      }
    }
  };


  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "stop-camera") {
      stopCamera();
      sendResponse({ status: "camera-stopped" });
    }
  });


  startCamera();
};

runCode();


