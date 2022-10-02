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
let pathToggles = {};
let tabs = {};

// Get variables from storage
chrome.storage.local.get(['autoInvertData'], function(data) {
	//Object.assign(domainsToggles, (data.autoInvertData || data).domainsToggles); // forgive the || but I'm still insecure about how the object is saved
	Object.assign(pathToggles, (data.autoInvertData || data).pathToggles); 
	console.log("Local storage loaded", data, pathToggles);
});

// Wait 3 seconds before updating local storage
const waitForUpdate = new WaitMoment(3000, ()=>{
	chrome.storage.local.set({autoInvertData: {pathToggles}}, function() {
		console.log('Local storage updated');
	});
});

function getDomain(url){
	console.log("get domain of",url);
	return url.split('//')[1].split('/')[0]; // pls don't kill me
}

function urlPieces(url){
	url = url.substr(url.split('://')[0].length+3);

	let ret = [];
	let pieces = url.split('/');

	let leave = 1;
	while(leave < pieces.length){
		ret.push([...pieces].splice(0, pieces.length-leave).join('/'));
		leave++;
	}

	console.log("Pieces are",ret);
	return ret;
}

const maxPathVal = 8;

function execInvert(tab, toggle){
	console.log("execToggle", tab, toggle);

	if(!tab)
		return; // next time, i swear

	let domainRef = tab.domainRef;

	let val = false;

	let maxVal=0, maxValPath=null;

	if(domainRef){

		// Get more probabilistic path
		for(let path of tab.urlPieces){
			let clicks = Math.abs(pathToggles[path] || 0);
			if(clicks >= maxVal){
				maxVal = clicks;
				maxValPath = path;
			}
		}

		if(maxValPath){
			let clicks = pathToggles[maxValPath] || 0;
			val = clicks < 0 ? true : false;
		}

		// Control max clicks
		if(maxVal > maxPathVal){
			for(let path of tab.urlPieces){
				let clicks = pathToggles[path] || 0;
				clicks /= 2;
				pathToggles[path] = clicks;
			}
		}

		if(toggle){
			val = !val;

			for(let path of tab.urlPieces){
				let clicks = pathToggles[path] || 0;
				clicks += val ? -1 : 1;
				pathToggles[path] = clicks;
			}

			waitForUpdate.tick();
		}

		// Add to list
		if(maxValPath != null){
			let afterSelector = false;
			let newPath = false;
			for(let path of tab.urlPieces){
				let thisNewPath = pathToggles[path] == undefined;
				newPath = newPath || thisNewPath;

				let clicks = pathToggles[path] || 0;
				clicks += val ? -1 : 1;
				pathToggles[path] = clicks;

				if(path == maxValPath)
					afterSelector = true;
					
				if(afterSelector && newPath && !thisNewPath)
					break;

			}
		}

		// just do it
		if(val !== undefined){
			chrome.tabs.sendMessage(tab.id, {
				message: 'invert!',
				toggle: val,
			});

			if (val) {
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
		myTab.urlPieces = urlPieces(tab.url);
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

		if(tab.status == 'complete'){
			chrome.tabs.sendMessage(tab.id, {
				message: 'invert!',
				status: 'update',
			});
		
			let myTab = extractPersonalTabObj(tab);
			execInvert(myTab);			
		}
		// else chrome.scripting.insertCSS({target: {tabId: tab.id}, files: ["inject.css"]});
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