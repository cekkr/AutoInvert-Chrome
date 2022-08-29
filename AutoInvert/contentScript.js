const invertExceptionClass = "autoInvertException";
const applyBackgroundExceptionOnElements = ['div', 'figure'];
const emptyChars = [' ', '\r', '\n'];

/// Excluded element from brightness inverting list
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
/// Wait for an order from background.js
///
chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
      // listen for messages sent from background.js    
      const inverterStyleId = "extAutoInverterRunning";

      function invertFreeStyle(invert){
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

        //console.log('Elaborated color inverting style: ' , style);

        ///
        /// Handle empty elements with background-image
        ///
        for(let el of applyBackgroundExceptionOnElements){
          let emptyBackgrounds = [...document.querySelectorAll(el+'[style*="background-image"]:not(:empty)')];
          emptyBackgrounds.forEach(node => {
            let html = node.innerHTML;

            let isEmpty = true;

            for(let c in html){
              //todo: add support to comment (interesting algorithmically)
              if(emptyChars.indexOf(html[c])<0){
                isEmpty = false;
                break;
              }
            }

            if(isEmpty){
              console.debug("AutoInvert exception applied to element", node);

              if(invert)
                node.classList.add(invertExceptionClass); 
              else 
                node.classList.remove(invertExceptionClass);
            }
          });
        }

        // return final style
        return style;
      }

      if (request.message === 'invert!') {

        var action = false;

        var style = document.getElementById(inverterStyleId);
        if (!style) {
            style = document.createElement("style");
            style.type = "text/css";
            style.id = inverterStyleId;
            style.innerHTML = invertFreeStyle(request.toggle);
            document.head.appendChild(style);

            action = true;
        }
        else {
          let styleToggle = style.getAttribute('autoInvert') == 'true' ? true : false;
          
          if(request.toggle != styleToggle){
            style.innerHTML = invertFreeStyle(request.toggle);

            action = true;
          } 
        }

        if(action){
          console.info("AutoInvert extension action", request);
          style.setAttribute("autoInvert", request.toggle);
        }
      }

      //sendResponse(true); // everythin fine broh
  });