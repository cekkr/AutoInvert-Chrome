chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
      // listen for messages sent from background.js    
      const inverterStyleId = "extAutoInverterRunning";

      function invertFreeStyle(invert, exclude){
        exclude = exclude || []; // list of additional tags to exclude

        exclude.push('video');

        // think about these
        exclude.push('svg'); // could work
        exclude.push('canvas');

        let percentage = invert ? 100 : 0;

        return "html {-webkit-filter: invert("+percentage+"%)} img "+ (exclude.length > 0 ? ', ' + exclude.join(', ') : '')+" {-webkit-filter: invert("+percentage+"%)}";
      }

      if (request.message === 'invert!') {

        var style = document.getElementById(inverterStyleId);
        if (!style) {
            style = document.createElement("style");
            style.type = "text/css";
            style.id = inverterStyleId;
            style.innerHTML = invertFreeStyle(request.toggle);
            document.head.appendChild(style);
        }
        else 
          style.innerHTML = invertFreeStyle(request.toggle);
      }

      //sendResponse(true); // everythin fine broh
  });