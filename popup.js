const recordTab = document.querySelector("#tab");
const recordScreen = document.querySelector("#screen");
const qualitySelect = document.querySelector('#quality');

const injectCamera = async () => {
  // inject the content script into the current page
  const tab = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  const tabId = tab[0].id;
  console.log("inject into tab", tabId);
  await chrome.scripting.executeScript({
    files: ["content.js"],
    target: { tabId },
  });
};

const removeCamera = async () => {
  
  const tab = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  const tabId = tab[0].id;
  console.log("inject into tab", tabId);
  await chrome.scripting.executeScript({
    func: () => {
      const camera = document.querySelector("#rusty-camera");
      if (!camera) return;
      camera.remove();
      document.querySelector("#rusty-camera").style.display = "none";
    },
    target: { tabId },
  });
};




const checkRecording = async () => {
  const recording = await chrome.storage.local.get(["recording", "type"]);
  const recordingStatus = recording.recording || false;
  const recordingType = recording.type || "";
  console.log("recording status", recordingStatus, recordingType);
  return [recordingStatus, recordingType];
};

const init = async () => {
  const recordingState = await checkRecording();

  console.log("recording state", recordingState);

  if (recordingState[0] === true) {
    document.querySelector("#options").style.display = "none";
    if (recordingState[1] === "tab") {
     
      document.getElementById("tab-icon").classList.remove("fa-window-maximize");
      document.getElementById("tab-icon").classList.remove("fa-regular");
      document.getElementById("tab-icon").classList.add("fa-solid");
      document.getElementById("tab-icon").classList.add("fa-stop");
    } else {
      
      document.getElementById("screen-icon").classList.remove("fa-display");
      document.getElementById('screen-icon').classList.add("fa-stop");
    }
  } else {
    document.querySelector("#options").style.display = "block";
  }

  const updateRecording = async (type) => {
    console.log("start recording", type);

    const quality = qualitySelect.value;

    const recordingState = await checkRecording();

    if (recordingState[0] === true) {
     
      chrome.runtime.sendMessage({ type: "stop-recording" });
      removeCamera();
    } else {
      // send message to service worker to start recording

      chrome.runtime.sendMessage({
        type: "start-recording",
        recordingType: type,
        quality: quality
      });
      injectCamera();
    }


    setTimeout(() => {
      window.close();
    }, 100);
  };

  recordTab.addEventListener("click", async () => {
    console.log("updateRecording tab clicked");
    updateRecording("tab");
  });

  recordScreen.addEventListener("click", async () => {
    console.log("updateRecording screen clicked");
    updateRecording("screen");
  });
};

init();

