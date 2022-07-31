if (document.getElementById("invertRunning") == null) {
	var style = document.createElement("style");
	style.type = "text/css";
	style.id = "invertRunning";
	style.innerHTML = "html {-webkit-filter: invert(100%)}";
	document.head.appendChild(style);
} else {
	document.getElementById("invertRunning").innerHTML = "html {-webkit-filter: invert(100%)}";
}