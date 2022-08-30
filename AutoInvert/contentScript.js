// page variables
var autoInvertToogle = false;

///
/// General functions
///
function isAlphaNumeric(str) {
  var code, i, len;

  for (i = 0, len = str.length; i < len; i++) {
    code = str.charCodeAt(i);
    if (!(code > 47 && code < 58) && // numeric (0-9)
        !(code > 64 && code < 91) && // upper alpha (A-Z)
        !(code > 96 && code < 123)) { // lower alpha (a-z)
      return false;
    }
  }
  return true;
};

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

///
/// Excluded element from brightness inverting list
///
const invertExceptionClass = "autoInvertException";
const alreadyCheckedElement = "autoInvertAlreadyCheckedException";
const applyBackgroundExceptionOnElements = ['div', 'figure'];

const exclude = []; 

// background-image exceptions
exclude.push('.'+invertExceptionClass);

/*for(let el of applyBackgroundExceptionOnElements)
  exclude.push(el + '[style*="background-image"]:empty');*/ // leave it to exceptionsFinder function

exclude.push('img');
exclude.push('video');

// think about these tags:
//exclude.push('svg');
//exclude.push('canvas');

///
/// Exclusion exception finder: handle [semi]empty elements with background-image for JS exclusion
///

// For empty element analyzing
const emptyChars = [' ', '\r', '\n', '\t'];

let classes = {};

function exceptionsFinder(){
  for(let el of applyBackgroundExceptionOnElements){
    let emptyBackgrounds = [...document.querySelectorAll(el)]; // +':not(.'+alreadyCheckedElement+')'+':not([style*="background-image"]:empty)
    
    emptyBackgrounds.forEach(node => {

      if(!node.hasAttribute(alreadyCheckedElement)){

        let hasBackgroundImage = (node.getAttribute("style")||'').includes("background-image")

        if(!hasBackgroundImage){
          let classList = [...node.classList];

          for(let cssClass of classList){
            if(!isAlphaNumeric(cssClass))
              continue;
              
            let style = classes[cssClass];
            if(style === undefined){
              elem = document.querySelector('.'+cssClass);
              style = classes[cssClass] = getComputedStyle(elem);
            }  

            if(style && style.getPropertyValue('background-image') != 'none'){
              hasBackgroundImage = true;
              break;
            }
          }
        }

        if(hasBackgroundImage){
          let text = node.innerText;

          let isEmpty = true;

          for(let c in text){
            const ch = text[c];

            if(emptyChars.indexOf(ch)<0){  // Check if there are just useless char
              isEmpty = false;
              break;
            }
          }

          if(isEmpty){
            // AutoInvert exception applied to element
            node.classList.add(invertExceptionClass); 
          }

          node.setAttribute(alreadyCheckedElement, ""); 

        }
      }
    });
  }
}

///
/// Changes observer
///
/// https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/disconnect

let waitForExceptionsFinder = new WaitMoment(30, ()=>{
  exceptionsFinder();
});

// Select the node that will be observed for mutations
const targetNode = document.querySelector('body');

// Options for the observer (which mutations to observe)
const config = { attributes: false, childList: true, subtree: true };

// Callback function to execute when mutations are observed
const callback = (mutationList, observer) => {
  waitForExceptionsFinder.tick();
};

// Create an observer instance linked to the callback function
const observer = new MutationObserver(callback);

///
/// getInvertStyle
///
function getInvertStyle(invert){
  invert = invert || autoInvertToogle; // temporary for better days...

  // Calculate filters
  let filters = [];

  filters.push("invert("+(invert?100:0)+"%)");
  filters.push("hue-rotate("+(invert?180:0)+"deg)"); // compensate color change // todo: reflect about this

  let strFilters = filters.join(" ");

  // the background-color it's experimental method for handling certain websites that uses default background color
  // iframe are simply ignored, for the moment...

  let excludeContrastFilter = invert ? ' contrast(0.80) brightness(1.10)' : ''; // this compensate some website visualization problem

  let style = `
  html { 
    -webkit-filter: `+strFilters+`;
    background-color: white; 
  } 

  iframe {
    -webkit-filter: `+strFilters+`;
  }

  ` // excluded elements (inverted twice => not inverted)
  +exclude.join(', ')+` {
    -webkit-filter: `+ strFilters + excludeContrastFilter+ `;
  }`; //experimental: for handling particular cases, a contrast/brightness equalization is applied...

  // return final style
  return style;
}

///
/// Wait for an order from background.js
///

const inverterStyleId = "extAutoInverterRunning";

chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {

      // listen for messages sent from background.js    
      if (request.message === 'invert!') {

        var action = false;

        autoInvertToogle = request.toggle;

        var style = document.getElementById(inverterStyleId);
        if (!style) {
            style = document.createElement("style");
            style.type = "text/css";
            style.id = inverterStyleId;
            style.innerHTML = getInvertStyle();
            document.head.appendChild(style);

            action = true;
        }
        else {
          let styleToggle = style.getAttribute('autoInvert') == 'true' ? true : false;
          
          if(autoInvertToogle != styleToggle){
            style.innerHTML = getInvertStyle();

            action = true;
          } 
        }

        if(action){
          console.info("AutoInvert extension action", request);
          style.setAttribute("autoInvert", autoInvertToogle);

          if(autoInvertToogle){
            exceptionsFinder();
            observer.observe(targetNode, config);
          }
          else{
            observer.disconnect();
          }
        }
      }

      //sendResponse(true); // everythin fine broh
  });