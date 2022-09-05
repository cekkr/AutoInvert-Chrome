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
const alreadyCheckedElement = "autoInvertChecked";
const applyBackgroundExceptionOnElements = ['div', 'figure'];

const exclude = []; 

// background-image exceptions
exclude.push('.'+invertExceptionClass);

/*for(let el of applyBackgroundExceptionOnElements)
  exclude.push(el + '[style*="background-image"]:empty');*/ // leave it to exceptionsFinder function

//exclude.push('img'); // directly handled in the CSS
exclude.push('video');
exclude.push('iframe');

// think about these tags:
//exclude.push('svg');
//exclude.push('canvas');

///
/// Exclusion exception finder: handle [semi]empty elements with background-image for JS exclusion
///

// For empty element analyzing
const emptyChars = [' ', '\r', '\n', '\t'];

function clearParentsExceptions(el){
  while(el = el.parentElement){
    if(el.hasAttribute(alreadyCheckedElement)){ //todo: maybe better to remove it
      el.classList.remove(invertExceptionClass); 	  
	  }
  }
}

let classes = {};

function exceptionsFinder(){
  for(let el of applyBackgroundExceptionOnElements){
    //tothink: a more efficient way for collecting elements to invert
    let emptyBackgrounds = [...document.querySelectorAll(el)]; // +':not(.'+alreadyCheckedElement+')'+':not([style*="background-image"]:empty)
    
    emptyBackgrounds.forEach(node => {

      let possibleEl = !node.hasAttribute(alreadyCheckedElement);

      // check if contains excluded elements
      if(possibleEl){
        for(let excl of exclude){
          if(node.querySelector(excl)){
            possibleEl = false;
            break;
          }
        }
      }

      // go go go!
      if(possibleEl){

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
            clearParentsExceptions(node); // remove exceptions to parent element
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
  //todo: remove alreadyCheckedElement from mutated elements
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

  // Should set background to HTML?
  // background-color: white;

  let imgExcludeContrastFilter = invert ? ' contrast(0.80) brightness(1.10); border-radius: 5px;' : ''; // this compensate some website visualization problem
  let bodyTextShadow = !invert ? '' : 'body{text-shadow: 0px 0px 2px rgba(255, 255, 255, 0.75); -webkit-text-stroke-width: 0.25px; -webkit-text-stroke-color: rgba(0,0,0, 0.75);}'; //Difficult choice... what I'm doing?

  //study this exception (math formula) https://en.wikipedia.org/wiki/Beam_splitter

  let style = `
  html { 
    -webkit-filter: `+strFilters +`; 
    background-color:white;
  } 

  `+ bodyTextShadow +`

  /* Excluded elements */
  ` // excluded elements (inverted twice => not inverted)
  +exclude.join(', ')+` {
    -webkit-filter: `+ strFilters + `;
  }
  
  img{
    -webkit-filter: `+ strFilters + ' ' + imgExcludeContrastFilter +`;
    background-color: rgba(127,127,127,1);
  } `; //experimental: excludeContrastFilter for handling particular cases in images, a contrast/brightness equalization is applied...
  
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

        if(request.status == 'update'){
          waitForExceptionsFinder.tick();
          return;
        }

        var action = false;

        autoInvertToogle = request.toggle;

        var style = document.getElementById(inverterStyleId);
        if (!style) {
            style = document.createElement("style");
            style.type = "text/css";
            style.id = inverterStyleId;
            style.innerHTML = getInvertStyle();
            document.head.append(style);

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
            waitForExceptionsFinder.tick();
            observer.observe(targetNode, config);
          }
          else{
            observer.disconnect();
          }
        }
      }

      //sendResponse(true); // everythin fine broh
  });