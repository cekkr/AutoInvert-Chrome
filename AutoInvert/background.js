// absolute
var tabsUrl = {};
var domainsToggles = {};

function getDomain(url){
	return url.split('//')[1].split('/')[0]; // pls don't kill me
}

// tab relative
var domainRef = undefined;

function execToggle(tabId, url, toggle){
	if(!domainRef){
		if(url)
			domainRef = getDomain(url);
	}

	if(domainRef){

		if(toggle){
			domainsToggles[domainRef] = !domainsToggles[domainRef];
		}

		chrome.tabs.sendMessage(tabId, {
			message: 'invert!',
			toggle: domainsToggles[domainRef],
		})

		if (domainsToggles[domainRef]) {
			chrome.action.setIcon({path: "images/on.png", tabId:tabId});
		} else {
			chrome.action.setIcon({path: "images/off.png", tabId:tabId});
		}

	}
}

// Event: click on AutoInvert button
chrome.action.onClicked.addListener(function(tab) {
	execToggle(tab.id, tab.url, true);
});

// Current page updated
chrome.tabs.onUpdated.addListener(
	function (tabId, changeInfo, tab) {
		console.info("currTabUpdated", changeInfo, tab);
		tabsUrl[tab.id] = tab.url;
		execToggle(tab.id, tab.url);			
	}
);

// Event: Changed Tab
chrome.tabs.onActivated.addListener(
	function (res) {
		domainRef = undefined
		execToggle(res.tabId, tabsUrl[res.tabId]);
	}
);
