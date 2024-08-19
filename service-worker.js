const checkRecording = async () => {
  const recording = await chrome.storage.local.get(["recording", "type"]);
  const recordingStatus = recording.recording || false;
  const recordingType = recording.type || "";
  console.log("recording status", recordingStatus, recordingType);
  return [recordingStatus, recordingType];
};

const updateRecording = async (state, type) => {
  console.log("update recording", type);
  chrome.storage.local.set({ recording: state, type });
};

const injectCamera = async () => {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://")) {
      continue;
    }
    console.log("Injecting camera into tab", tab.id);
    await chrome.scripting.executeScript({
      files: ["content.js"],
      target: { tabId: tab.id },
    });
  }
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

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  console.log("tab activated", activeInfo);


  const activeTab = await chrome.tabs.get(activeInfo.tabId);
  if (!activeTab) return;
  const tabUrl = activeTab.url;


  if (
    tabUrl.startsWith("chrome://") ||
    tabUrl.startsWith("chrome-extension://")
  ) {
    console.log("chrome or extension page - exiting");
    return;
  }

 
  const [recording, recordingType] = await checkRecording();

  console.log("recording check after tab change", {
    recording,
    recordingType,
    tabUrl,
  });

  if (recording && recordingType === "screen") {
    // inject the camera
    injectCamera();
  } else {
    // remove the camera
    removeCamera();
  }
});




const startRecording = async (type, quality) => {
  console.log("start recording", type);
  const currentstate = await checkRecording();
  console.log("current state", currentstate);
  updateRecording(true, type);
  const afterState = await checkRecording();
  console.log("cuurent 2 state", afterState);

  chrome.action.setIcon({ path: "icons/recording.png" });
  if (type === "tab") {
    recordTabState(true, quality);
  }
  if (type === "screen") {
    recordScreen(quality);
  }
};

const recordScreen = async (quality) => {
 
  const desktopRecordPath = chrome.runtime.getURL("desktopRecord.html");

  const currentTab = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  const currentTabId = currentTab[0].id;

  const newTab = await chrome.tabs.create({
    url: desktopRecordPath,
    pinned: true,
    active: true,
    index: 0,
  });

  
  setTimeout(() => {
    chrome.tabs.sendMessage(newTab.id, {
      type: "start-recording",
      focusedTabId: currentTabId,
      quality: quality
    });
  }, 500);
};

const removeCameraFromAllTabs = async () => {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://")) {
      continue;
    }
    console.log("Removing camera from tab", tab.id);
    await chrome.scripting.executeScript({
      func: () => {
        const camera = document.querySelector("#rusty-camera");
        if (camera) {
          camera.remove();
        }
      },
      target: { tabId: tab.id },
    });
  }
};


const stopRecording = async () => {
  console.log("stop recording");
  await updateRecording(false, "");

  await removeCameraFromAllTabs();
  chrome.action.setIcon({ path: "icons/not-recording.png" });
  await recordTabState(false);
};




const recordTabState = async (start = true, quality) => {
  const existingContexts = await chrome.runtime.getContexts({});
  const offscreenDocument = existingContexts.find(
    (c) => c.contextType === "OFFSCREEN_DOCUMENT"
  );

  if (!offscreenDocument) {
    // Create an offscreen document.
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["USER_MEDIA", "DISPLAY_MEDIA"],
      justification: "Recording from chrome.tabCapture API",
    });
  }

  if (start) {
    
    const tab = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    const tabId = tab[0].id;

    console.log("tab id", tabId);

    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: tabId,
    });

    console.log("stream id", streamId);

    // send to offscreen document
    chrome.runtime.sendMessage({
      type: "start-recording",
      target: "offscreen",
      data: streamId,
      quality: quality
    });
  } else {
 
    chrome.runtime.sendMessage({
      type: "stop-recording",
      target: "offscreen",
    });
  }
};

const openTabWithVideo = async (message) => {
  console.log("request to open tab with video", message);

  const { url: videoUrl, base64 } = message;

  if (!videoUrl && !base64) return;

  const url = chrome.runtime.getURL("video.html");
  const newTab = await chrome.tabs.create({ url });

  // send message to tab
  setTimeout(() => {
    chrome.tabs.sendMessage(newTab.id, {
      type: "play-video",
      videoUrl,
      base64,
    });
  }, 500);
};



chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  console.log("message received", request, sender);

  switch (request.type) {
    case "open-tab":
      await openTabWithVideo(request);
      sendResponse({ status: "done" });
      break;
    case "start-recording":
      await startRecording(request.recordingType, request.quality);
      sendResponse({ status: "recording-started" });
      break;
    case "stop-recording":
      await stopRecording();
      sendResponse({ status: "recording-stopped" });
      break;
    default:
      console.log("default");
      sendResponse({ status: "unknown-message" });
  }

  return true; 
});
