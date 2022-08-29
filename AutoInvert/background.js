// absolute
let domainsToggles = {};
let tabs = {};

function getDomain(url){
	console.log("get domain of",url);
	return url.split('//')[1].split('/')[0]; // pls don't kill me
}

function execInvert(tab, toggle){
	console.log("execToggle", tab, toggle);

	if(!tab)
		return; // next time, i swear

	let domainRef = tab.domainRef;

	if(domainRef){

		if(toggle){
			domainsToggles[domainRef] = !domainsToggles[domainRef];
		}

		let tabToggle = domainsToggles[domainRef];

		if(tab.lastToggle !== tabToggle && tab.status == 'complete'){
			console.log("domainRef", domainRef, domainsToggles[domainRef]);

			chrome.tabs.sendMessage(tab.id, {
				message: 'invert!',
				toggle: tabToggle,
			});

			if (tabToggle) {
				chrome.action.setIcon({path: "images/on.png", tabId:tab.id});
			} else {
				chrome.action.setIcon({path: "images/off.png", tabId:tab.id});
			}

			tab.lastToggle = tabToggle;
		}
	}
}

function extractPersonalTabObj(tab){
	let myTab = tabs[tab.id] = tabs[tab.id] || {id: tab.id};

	if(myTab.url != tab.url){
		myTab.url = tab.url;		
		myTab.domainRef = getDomain(tab.url);
	}

	myTab.status = tab.status;

	return myTab;
}

// Event: click on AutoInvert button
chrome.action.onClicked.addListener(function(tab) {
	console.log("AutoInvert toggled", tab);
	let myTab = extractPersonalTabObj(tab);
	execInvert(myTab, true);
});

// Current page updated
chrome.tabs.onUpdated.addListener(
	function (tabId, changeInfo, tab) {
		console.info("currTabUpdated", changeInfo, tab);

		let myTab = extractPersonalTabObj(tab);
		execInvert(myTab);			
	}
);

// Event: Changed Tab
chrome.tabs.onActivated.addListener(
	function (res) {
		console.log("tabs.onActivated", res, tabs[res.tabId]);

		domainRef = undefined;

		execInvert(tabs[res.tabId]);
	}
);
