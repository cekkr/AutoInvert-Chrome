chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
      // listen for messages sent from background.js

      console.log("received message", request);

      if (request.message === 'invert!') {
        if(request.toggle){
            if (document.getElementById("invertRunning") == null) {
                var style = document.createElement("style");
                style.type = "text/css";
                style.id = "invertRunning";
                style.innerHTML = "html {-webkit-filter: invert(100%)}";
                document.head.appendChild(style);
            } else {
                document.getElementById("invertRunning").innerHTML = "html {-webkit-filter: invert(100%)}";
            }
        }
        else {
            document.getElementById("invertRunning").innerHTML = "html {-webkit-filter: invert(0%)}";
        }
      }

      sendResponse(true); // everythin fine broh
  });