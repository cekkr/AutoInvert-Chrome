var toggles = {};

function getDomain(url){
	return url.split('//')[1].split('/')[0]; // pls don't kill me
}

var settingRef = 'blanco';

function execToggle(tab){
	settingRef = getDomain(tab.url);

	chrome.tabs.sendMessage(tab.id, {
		message: 'invert!',
		toggle: toggles[settingRef],
	})

	if (toggles[settingRef]) {
		chrome.action.setIcon({path: "images/on.png", tabId:tab.id});
	} else {
		chrome.action.setIcon({path: "images/off.png", tabId:tab.id});
	}
}

chrome.action.onClicked.addListener(function(tab) {
	toggles[settingRef] = !(toggles[settingRef] || false);
	execToggle(tab);
});

chrome.tabs.onUpdated.addListener(function
	(tabId, changeInfo, tab) {
		execToggle(tab);
	}
);

chrome.tabs.onActivated.addListener(function
	(tabId, changeInfo, tab) {
		execToggle(tab);
	}
);
