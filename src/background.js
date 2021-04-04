'use strict';

chrome.commands.onCommand.addListener(function(command) {
  chrome.windows.getCurrent({}, (window) => {
    chrome.windows.create({
      url: chrome.runtime.getURL("index.html?id=" + encodeURIComponent(window.id)),
      type: "popup",
      width: 600,
      height: 420,
      top: 400,
      left: 400 
    });
  });
});