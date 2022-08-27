chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
      // listen for messages sent from background.js

      console.log("received message", request);

      const inverterStyleId = "extAutoInverterRunning";

      function invertFreeStyle(invert){
        let percentage = invert ? 100 : 0;

        return "html {-webkit-filter: invert("+percentage+"%)} img {-webkit-filter: invert("+percentage+"%)}";
      }

      if (request.message === 'invert!') {
        if(request.toggle){
            if (document.getElementById(inverterStyleId) == null) {
                var style = document.createElement("style");
                style.type = "text/css";
                style.id = inverterStyleId;
                style.innerHTML = invertFreeStyle(true);
                document.head.appendChild(style);
            } else {
                document.getElementById(inverterStyleId).innerHTML = invertFreeStyle(true);
            }
        }
        else {
            document.getElementById(inverterStyleId).innerHTML = invertFreeStyle(false);
        }
      }

      sendResponse(true); // everythin fine broh
  });