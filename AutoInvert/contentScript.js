chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
      // listen for messages sent from background.js    
      const inverterStyleId = "extAutoInverterRunning";

      function invertFreeStyle(invert, exclude){
        // Tags to exclude from color inverting
        exclude = exclude || []; 

        exclude.push('img');
        exclude.push('video');

        // think about these tags:
        //exclude.push('svg');
        //exclude.push('canvas');

        // Calculate filters
        let filters = [];

        filters.push("invert("+(invert?100:0)+"%)");
        filters.push("hue-rotate("+(invert?180:0)+"deg)"); // compensate color change // todo: reflect about this

        let strFilters = filters.join(" ");

        // the background-color it's experimental method for handling certain websites that uses default background color
        let style = `html { 
          -webkit-filter: `+strFilters+`;
          background-color: white; 
        } 
        ` // excluded elements (inverted twice => not inverted)
        +exclude.join(', ')+` {
          -webkit-filter: `+strFilters+`;
        }`;

        //console.log('Elaborated color inverting style: ' , style);

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