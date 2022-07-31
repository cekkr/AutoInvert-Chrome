var toggle = false;

chrome.browserAction.onClicked.addListener(function(tab) {
	toggle = !toggle;
	if (toggle) {
		chrome.browserAction.setIcon({path: "images/on.png", tabId:tab.id});
		chrome.tabs.executeScript(null, {file: "on.js"});
	} else {
		chrome.browserAction.setIcon({path: "images/off.png", tabId:tab.id});
		chrome.tabs.executeScript(null, {file: "off.js"});
	}
});