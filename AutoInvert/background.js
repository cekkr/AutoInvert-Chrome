///
/// General functions
///

// copied from contentScript.js //todo: make a common library js file?
class WaitMoment{
	constructor(waitMs, callback) {
	  this.waitMs = callback;
	  this.callback = callback; 
	}
  
	tick(){
	  clearTimeout(this.timeout);
  
	  let args = [...arguments];
  
	  this.timeout = setTimeout(()=>{
		this.callback.apply(null, args);
	  }, this.waitMs);
	}
  }

///
/// Script
///

// Absolute Variables
let domainsToggles = {};
let tabs = {};

// Get variables from storage
chrome.storage.local.get(['autoInvertData'], function(data) {
	Object.assign(domainsToggles, (data.autoInvertData || data).domainsToggles); // forgive the || but I'm still insecure about how the object is saved
	console.log("Local storage loaded", data, domainsToggles);
});

// Wait 3 seconds before updating local storage
const waitForUpdate = new WaitMoment(3000, ()=>{
	chrome.storage.local.set({autoInvertData: {domainsToggles}}, function() {
		console.log('Local storage updated');
	});
});

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
			waitForUpdate.tick();
		}

		// just do it
		let tabToggle = domainsToggles[domainRef];

		if(tabToggle !== undefined){
			chrome.tabs.sendMessage(tab.id, {
				message: 'invert!',
				toggle: tabToggle,
			});

			if (tabToggle) {
				chrome.action.setIcon({path: "images/on.png", tabId:tab.id});
			} else {
				chrome.action.setIcon({path: "images/off.png", tabId:tab.id});
			}
		}
	}
}

function extractPersonalTabObj(tab){
	let myTab = tabs[tab.id] = tabs[tab.id] || {id: tab.id};

	if(myTab.url != tab.url){
		myTab.url = tab.url;		
		myTab.domainRef = getDomain(tab.url);
	}

	myTab.status = tab.status

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

		chrome.tabs.sendMessage(tab.id, {
			message: 'invert!',
			status: 'update',
		});

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
