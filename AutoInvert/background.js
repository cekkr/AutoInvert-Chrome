var tabs = {};
var domainsToggles = {};

function getDomain(url){
	return url.split('//')[1].split('/')[0]; // pls don't kill me
}

var domainRef = undefined;
var lastToggle = false;

function execToggle(tabId, url, toggle){
	if(!domainRef){
		if(!url)
			return;
		
		domainRef = getDomain(url);
	}

	if(domainRef){

		if(toggle)
			domainsToggles[domainRef] = !domainsToggles[domainRef];

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

chrome.action.onClicked.addListener(function(tab) {
	console.log("clicked", tab);
	execToggle(tab.id, tab.url, true);
});

chrome.tabs.onUpdated.addListener(
	function (tabId, changeInfo, tab) {
		console.log("tab updated", changeInfo, tab);
		tabs[tab.id] = {id: tab.id, url: tab.url};
		execToggle(tab.id, tab.url);			
	}
);

chrome.tabs.onActivated.addListener(
	function (res) {
		console.log("tab activated", res);
		execToggle(res.tabId, (tabs[res.tabId]||{}).url);
	}
);
