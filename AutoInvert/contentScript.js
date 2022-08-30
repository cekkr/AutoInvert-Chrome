// page variables
var autoInvertToogle = false;

///
/// Excluded element from brightness inverting list
///
const invertExceptionClass = "autoInvertException";
const applyBackgroundExceptionOnElements = ['div', 'figure'];

const exclude = []; 

// background-image exceptions
exclude.push('.'+invertExceptionClass);

for(let el of applyBackgroundExceptionOnElements)
  exclude.push(el + '[style*="background-image"]:empty');

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
const tagClosures = ["<", ">"];

let classes = {};

function exceptionsFinder(){
  for(let el of applyBackgroundExceptionOnElements){
    let emptyBackgrounds = [...document.querySelectorAll(el+':not([style*="background-image"]:empty):not(.'+invertExceptionClass+')')];
    
    emptyBackgrounds.forEach(node => {

      let hasBackgroundImage = (node.getAttribute("style")||'').includes("background-image")

      if(!hasBackgroundImage){
        let classList = [...node.classList];

        for(let cssClass of classList){
          let style = classes[cssClass];
          if(style === undefined){
            elem = document.querySelector('.'+cssClass);
            style = classes[cssClass] = getComputedStyle(elem);
          }  

          if(style.getPropertyValue('background-image') != 'none'){
            hasBackgroundImage = true;
            break;
          }
        }
      }

      if(hasBackgroundImage){
        let html = node.innerHTML;

        let isEmpty = true;

        let tagStatus = false;
        let commentStatus = false;
        let commentDying = 0;

        for(let c in html){
          const ch = html[c];

          if(!tagStatus){
            if(ch == tagClosures[0]){
              tagStatus = true;
              commentStatus = 0;
            }
            else if(emptyChars.indexOf(ch)<0){  // Check if there are just useless char
              isEmpty = false;
              break;
            }
          }
          else {
            /// Check if it's a comment
            if(typeof commentStatus === 'number'){
              // you're looking for the next !-- of a comment
              if(commentStatus == 0){
                if(ch=='!')
                  commentStatus++;
                else 
                  commentStatus = false;
              }
              else if(commentStatus > 0){ 
                if(ch=='-'){
                  commentStatus++;

                  if(commentStatus == 3)
                    commentStatus = true; // we are at <!-- ... yep, it's a comment
                }
                else 
                  commentStatus = false;
              }
            }

            if(commentStatus == false){
              if(ch == tagClosures[1] && (commentStatus === false || commentDying >= 2))
                tagStatus = false;
            }
            
            if(commentStatus === true) // count final --> of an end comment
              commentDying = ch == '-' ? commentDying+1 : 0; 
          }
        }

        if(isEmpty){
          // AutoInvert exception applied to element

          if(autoInvertToogle)
            node.classList.add(invertExceptionClass); 
          else 
            node.classList.remove(invertExceptionClass);
        }
      }
    });
  }
}

///
/// Changes observer
///
/// https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/disconnect

// Select the node that will be observed for mutations
const targetNode = document.querySelector('body');

// Options for the observer (which mutations to observe)
const config = { attributes: false, childList: true, subtree: true };

// Callback function to execute when mutations are observed
const callback = (mutationList, observer) => {
  exceptionsFinder();
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
    -webkit-filter: `+strFilters+` contrast(0.80) brightness(1.10);
  }`; //experimental: for handling particular cases, a contrast/brightness equalization is applied...

  exceptionsFinder();

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

          if(autoInvertToogle)
            observer.observe(targetNode, config);
          else
            observer.disconnect();
          }
      }

      //sendResponse(true); // everythin fine broh
  });