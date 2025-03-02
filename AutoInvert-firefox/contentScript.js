// dev
const rememberWorkingOn = false;
const debug = false

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
    this.waitMs = waitMs;
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

function getDomPath(el) {
  var stack = [];
  while ( el.parentNode != null ) {
    //console.log(el.nodeName);
    var sibCount = 0;
    var sibIndex = 0;
    for ( var i = 0; i < el.parentNode.childNodes.length; i++ ) {
      var sib = el.parentNode.childNodes[i];
      if ( sib.nodeName == el.nodeName ) {
        if ( sib === el ) {
          sibIndex = sibCount;
        }
        sibCount++;
      }
    }
    if ( el.hasAttribute('id') && el.id != '' ) {
      stack.unshift(el.nodeName.toLowerCase() + '#' + el.id);
    } else if ( sibCount > 1 ) {
      stack.unshift(el.nodeName.toLowerCase() + ':eq(' + sibIndex + ')');
    } else {
      stack.unshift(el.nodeName.toLowerCase());
    }
    el = el.parentNode;
  }

  return stack.slice(1); // removes the html element
}

///
/// Script
///

///
/// Excluded element from brightness inverting list
///
const classZeroFilter = "imposeZeroFilter";
const invertExceptionClass = "autoInvertException";
const alreadyCheckedElement = "autoInvertChecked";
const applyInvertExceptionOnElements = ['div', 'figure', 'a', 'picture', 'span'];
const dontCheckContentOn = ['a', 'figure', 'picture'];

const debugImgAnalyzer = false;

const exclude = []; 

// background-image exceptions
exclude.push('.'+invertExceptionClass);

/*for(let el of applyBackgroundExceptionOnElements)
  exclude.push(el + '[style*="background-image"]:empty');*/ // leave it to exceptionsFinder function

exclude.push('img'); // directly handled in the CSS
exclude.push('video');
exclude.push('iframe');
//exclude.push('i'); //for icon, but is used for italic

// think about these tags:
//exclude.push('svg');
exclude.push('canvas');

///
/// Exclusion exception finder: handle [semi]empty elements with background-image for JS exclusion
///

// For empty element analyzing
const emptyChars = [' ', '\r', '\n', '\t'];

function clearParentsExceptions(el){
  while(el = el.parentElement){
    if(el.hasAttribute(alreadyCheckedElement)){ //todo: maybe better to remove it
      el.removeAttribute(invertExceptionClass); 	  
	  }
  }
}

///
/// Canvas and images analyzing
///

//TODO: update algorithm watching https://context.reverso.net/translation/italian-english/ flags

function analyzeContext($el, ctx){
  $el.attr('aiAnalyzed', true); 

  let el = $el[0];
  
  if(el.src.endsWith(".svg")){
    justInvert($el, true);
    return;
  }

  const pixelsPerIncrement = 30;
  const dimensionAvg = ((el.width + el.height)/2);
  let increment = Math.round((dimensionAvg/pixelsPerIncrement)*1.25) || 1;

  if(ctx === null)
    return;

  const round = 1;
  const roundAvg = round; // think about mul by 4
  const roundDiff = round;

  let avgs = {};
  let totPixelsConsidered = 0;
  let totPixels = 0;
  let avgP3 = 0;

  let opaquePixels = 0

  try{    
    for(let x=0; x<el.width; x+=increment){
      for(let y=0; y<el.height; y+=increment){
        let p = ctx.getImageData(x, y, 1, 1).data; 

        avgP3 += p[3]
        totPixels++

        if(p[3]>250){
          let avg = (p[0]+p[1]+p[2])/3;
          let diff = (Math.abs(avg-p[0])+Math.abs(avg-p[1])+Math.abs(avg-p[2]))/3;

          let iavg = Math.round(avg/roundAvg);
          let idiff = Math.round(diff/roundDiff);

          let arr = avgs[iavg] = avgs[iavg] || {};
          arr['totPixels'] = (arr['totPixels'] || 0) + 1;
          arr[idiff] = (arr[idiff] || 0)+1;        
          totPixelsConsidered++;

          //diffs[idiff] = (diffs[idiff] || 0)+1;
        }
      }
    }
  }
  catch {
    analyzedImgsUrls[el.src] = -2;
    return;
  }

  let opacity = totPixelsConsidered / totPixels

  avgP3 /= totPixels;

  let indexes = Object.keys(avgs);
  let indexesLen = indexes.length;

  // Calculate avg light
  let avgLight = 0;
  for(let a in avgs){
    avgLight += (a/(255*roundAvg /*PAY ATTENTION*/))*(avgs[a]['totPixels']);
  }

  avgLight /= totPixelsConsidered

  let invert = !dontInvert(el);

  const maxShades = 4;

  //console.log(el, avgP3, indexesLen, avgLight)

  if(indexesLen > maxShades || (avgLight < 0.5 && opacity > 0.5)){
    if(debug) $el.attr("aisettedby","indexesLen="+indexesLen)
    invert = false;
  }
  else if(avgP3 < 127 && avgLight < 0.1){
    if(debug) $el.attr("aisettedby","avgLight="+avgLight)
    invert = true;
  }
  else {
    const minMix = 0.1; //it works, even if i don't know why. Hey, but it works.

    let totMix = 0;
    let totMixPower = 0;

    for(let a in avgs){
      let avg = avgs[a];
      let avgDiffs = Object.keys(avg);

      let avgMix = 0;
      let avgTot = 1;
      for(let d of avgDiffs){
        if(isNaN(d))
          avgTot = avg[d];
        else  
          avgMix += 255-d;
      }

      totMix += avgDiffs.length;

      avgMix /= avgTot;
      totMixPower += avgMix;
    } 

    totMixPower /= totPixelsConsidered;
    let variety = totMix * totMixPower;

    //console.log('totMix', totMixPower, variety, el);
    if(debug) $el.attr("aisettedby","variety="+variety)

    if(variety < minMix)
      invert = false;
  }
  
  /*if(invert && dontInvert(el, 150)){
    invert = false;
  }*/

  analyzedImgsUrls[el.src] = invert;
  justInvert($el, invert);

  // console.log('avgs', avgs, el);
}

function justInvert($el, invert){
  if(invert === -2)
    return;

  if(invert){
    if($el.is('img')){
      $el.addClass('imposeZeroFilter');    
    }
  }
  else{
    if($el.is('canvas'))
      $el.addClass(invertExceptionClass);
  }  
}

const analyzedImgsChecker = false;
let imgsUrls = {};
let analyzedImgsUrls = {};
let analyzedImgs = [];

function analyzeImg(img){
  let $el = $(img);

  if($el.attr('aiAnalyzed'))
    return;

  if(img.nodeName == 'DIV'){
    img.src = $el.attr('aibackimg');
  }

  if(!img.src)
    img.src = getDomPath(img);

  if(analyzedImgsChecker){
    let imgUrl = imgsUrls[img.src] = imgsUrls[img.src] || {
      src: img.src,
      imgs: []
    }

    imgUrl.imgs.push(img);
    analyzedImgs.push(img);
  }

  if(analyzedImgsUrls[img.src] === undefined){

    // Wait for it
    analyzedImgsUrls[img.src] = -2;
    setTimeout(()=>{
      if(analyzedImgsUrls[img.src] === -2){
        analyzedImgsUrls[img.src] = undefined;
        $el.attr('aiAnalyzed', false);
      }
    }, 4000);

    // Create context to analyze
    let ctx = undefined;    
    if(img.nodeName == 'IMG'){
      try{
        let canvas = document.createElement('canvas');
        ctx = canvas.getContext('2d', {willReadFrequently: true});

        if(img.src.endsWith(".webp"))
          return;

        let base_image = new Image();
        base_image.src = img.src;
       
        base_image.crossOrigin = "Anonymous";
        base_image.onload = function(){
          ctx.drawImage(base_image, 0, 0);
          analyzeContext($el, ctx);        
        }
      }
      catch {
        analyzeContext($el, null); 
      }
    }
    else if(img.nodeName == 'CANVAS') {
      let canvas = img;
      canvas.crossOrigin = "Anonymous";
      ctx = canvas.getContext('2d', {willReadFrequently: true});
      if(ctx){
        analyzeContext($el, ctx);
      }
      else {
        analyzedImgsUrls[img.src] = true;
      }
    }
    else if(img.nodeName == 'DIV'){
      if(rememberWorkingOn) console.log("todo div", img);
      analyzedImgsUrls[img.src] = true;
    }

  }
  else 
    justInvert($el, analyzedImgsUrls[img.src]);

}

function dontInvert(node, limit = 100){
  return ((node.clientWidth + node.clientHeight)/2) < limit;
}

///
///
let classes = {};

function exceptionsFinder(){
  for(let el of applyInvertExceptionOnElements){
    let checkContent = !dontCheckContentOn.includes(el);

    //tothink: a more efficient way for collecting elements to invert
    let emptyBackgrounds = [...document.querySelectorAll(el)]; // +':not(.'+alreadyCheckedElement+')'+':not([style*="background-image"]:empty)
    
    emptyBackgrounds.forEach(node => {

      let possibleEl = !node.hasAttribute(alreadyCheckedElement);

      // check if contains excluded elements
      /*if(possibleEl){
        for(let excl of exclude){
          if($(node.querySelector(excl)).is(":visible")){
            possibleEl = false;
            break;
          }
        }
      }*/

      // go go go!
      if(possibleEl){

        let elStyle = (node.getAttribute("style")||'').replaceAll(' ','');
        const backgroundImgCss = "background-image:url(";
        let hasBackgroundImage = elStyle.includes(backgroundImgCss);

        if(hasBackgroundImage){
          let url = elStyle.split(backgroundImgCss)[1].split(')')[0];
          node.setAttribute('aibackimg', url);
        }
        else {
          if(elStyle.includes('background')){
            let url = elStyle.split('background')[1].split(':')[1].split(';')[0]; //get color
            node.setAttribute('aibackimg', url);
          }
        }

        /*if(elStyle.includes("background-image"))
          console.log(el, "contains background", hasBackgroundImage);*/

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

            let backgroundImage = '';
            if(style){
              if((backgroundImage = style.getPropertyValue('background-image'))){
                backgroundImage = backgroundImage.replaceAll(' ','');
                hasBackgroundImage = backgroundImage.startsWith('url(');

                if(hasBackgroundImage){
                  let url = backgroundImage.split('(')[1].split(')')[0];
                  node.setAttribute('aibackimg', url);
                }

                break;
              }
              else if((backgroundImage = style.getPropertyValue('background') || style.getPropertyValue('background-color'))){
                node.setAttribute('aibackimg', backgroundImage);
              }
            }
          }
        }

        if(hasBackgroundImage){
          let isEmpty = true;

          if(dontInvert(node))
            isEmpty = false;
          else if(checkContent){
            let text = node.innerText;

            let count = 0;
            for(let c in text){
              const ch = text[c];

              if(emptyChars.indexOf(ch)<0){  // Check if it's not "empty" char
                if(count++ > 128){
                  empty = false;
                  break;                  
                }
              }
            }
          }          

          if(isEmpty){
            // AutoInvert exception applied to element
            node.classList.add(invertExceptionClass); 

            /*$(node).find("img").each(function(){
              this.classList.add(classZeroFilter);
            });*/
            
            clearParentsExceptions(node); // remove exceptions to parent element
          }

          node.setAttribute(alreadyCheckedElement, ""); 

        }
      }
    });
  }

  ///
  /// Check for canvas (and images)
  ///
  let els = $("canvas, :not(picture) > img, div:has([aibackimg])");
  els.each(function(){
    analyzeImg(this);
  });

  ///
  /// Space-temporal exception paradox finder
  ///

  function parentIsExcluded($el){

    while(($el = $el.parent()) && $el.length > 0){    
      for(let excl of exclude){
        if($el.is(excl))
          return $el;
      }    
    }

    return false;
  }

  let exEls = $(exclude.join(','));
  exEls.each(function() {
    let $el = $(this);    

    let parExcl = parentIsExcluded($el);
    if(parExcl){

      if($el.hasClass(invertExceptionClass)){ 
        $el.removeClass(invertExceptionClass);
      }
      else {
        let parent = $el.parent();
        if(parent != parExcl)
          parent.addClass(invertExceptionClass);
        else
          $el.addClass("imposeZeroFilter");
      }
    }
  }); 
}

///
/// Changes observer
///
/// https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/disconnect

let waitForExceptionsFinder = new WaitMoment(100, ()=>{
  exceptionsFinder();

  // GitHub exception
  if(tabLoaded)
    aiLoaded();
});

// Select the node that will be observed for mutations
let targetNode = document.querySelector('html');

// Options for the observer (which mutations to observe)
const config = { attributes: true, childList: true, subtree: true };

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
let likeAVirgin = true;

function getInvertStyle(invert){
  invert = invert || autoInvertToogle; // temporary for better days...

  if(likeAVirgin){    
    let permStyle = document.createElement("style");
    permStyle.id = "autinvertPermanentCss";
    permStyle.innerHTML = "a > img { padding:1pt; }";
    document.getElementsByTagName("head")[0].appendChild(permStyle);

    likeAVirgin = false; // clichè
  }  

  //if(!invert) return ''; //try this way

  // Calculate filters
  let filters = [];
  filters.push("drop-shadow(0px 0px 1pt rgba(127, 127, 127, "+(invert?0.90:0)+"))")
  filters.push("invert("+(invert?1:0)+")");
  filters.push("hue-rotate("+(invert?180:0)+"deg)"); // compensate color change // todo: reflect about this
  filters.push("contrast("+(invert?0.95:1)+")");
  //filters.push("brightness("+(invert?1.05:1)+")");
  let strFilters = filters.join(" ");

  let exclFilters = [];
  exclFilters.push("invert(1)");
  exclFilters.push("hue-rotate(180deg)"); // compensate color change // todo: reflect about this
  exclFilters.push("contrast(1.15)");
  exclFilters.push("brightness(1.1)");
  //exclFilters.push("drop-shadow(0px,0px, 4px, rgba(0,0,0, 1))");
  
  //exclFilters.push("drop-shadow(0px 0px 1px rgba(0,0,0,1))");
  exclFilters.push("drop-shadow(0px 0px 2px rgba(127,127,127,0.5))");
  
  let strExclFilters = exclFilters.join(" ");

  filters.splice(3);
  //filters.push("blur(2px)");
  filters.push("contrast(1.05)");
  filters.push("drop-shadow(0px 0px 1px rgba(127,127,127,0.9))");
  let strExclBackFilter = invert ? filters.join(" ") : '';

  let curExclude = [...exclude];
  for(var e in curExclude){
    curExclude[e] += ':not(.'+classZeroFilter+')';
  }
  
  let curExcludeHover = [...exclude];
  for(var e in curExcludeHover){
    curExcludeHover[e] += '.'+classZeroFilter+':hover';
  }
  
  let style = `
    html { 
      -webkit-filter: `+strFilters +`;
      transition: -webkit-filter 0.3s;
    }
  `; 
    
  if(invert) style += `
    html {
      background-color:white;
      color: black;
    } 
    
    body {
      -webkit-text-stroke: 0.25pt rgba(127,127,127,0.25);
      text-shadow: 0px 0px 0.5px rgba(0, 0, 0, 1), 0px 0px 1px rgba(127, 127, 127, 0.75);
    } 
    
    a, button { 
      box-shadow: 0px 0px 10px rgba(127, 127, 127, 0.01);

      -webkit-text-stroke: 0.25pt rgba(127,127,127.25);
      text-shadow: 0px 0px 0.5px rgba(127,127,127, 0.95), 0px 0px 1px rgba(127, 127, 127, 0.5);
      
      border-radius: 5px;
    }

    a:hover, button:hover { 
      transition-duration: 0.3s;
      text-shadow: 0px 0px 0.5px rgba(0, 0, 0, 0.95), 0px 0px 1px rgba(127, 127, 127, 0.75);
    }    

    /* Excluded elements */
    ` // excluded elements (inverted twice => not inverted)
    +curExclude.join(', ')+` {
      /*backdrop-filter: `+ strExclBackFilter +`;*/

      -webkit-filter: `+ strExclFilters  +` !important;
      -webkit-text-stroke: 0.25pt rgba(127,127,127,0.25) !important;

      backdrop-filter: invert(0%);

      transition-duration: 0.3s;
    }

    /* Normalize an inverted image when mouse is over it */
    `+curExcludeHover.join(', ')+` {
      transition-duration: 0.3s;
      -webkit-filter: `+ strExclBackFilter  +` !important; 
    }

    img{
      border-radius: 5px;
    } 
  `; 
  
  // return final style
  return style;
}

///
/// Wait for an order from background.js
///

const inverterStyleId = "extAutoInverterRunning";

function invertCmd(toggle){
  let action = false;
  autoInvertToogle = toggle;

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
    style.setAttribute("autoInvert", autoInvertToogle);

    if(autoInvertToogle){
        waitForExceptionsFinder.tick();
        observer.observe(targetNode, config);
    }
    else{
      observer.disconnect();
    }
  }

  return action;
}

function aiLoaded(){
  let body = document.querySelector('body');

  if(body.hasAttribute('aiLoaded'))
    return;

  targetNode.setAttribute("aiLoaded", true);
  if(body) body.setAttribute("aiLoaded", true);

  if($("style").length <= 1 && $("html").css('background-color') == undefined)
    $("html").css('background-color', 'white');

}

let firstCall = false;
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {

    // listen for messages sent from background.js    
    if (request.message === 'invert!') {        

      if(request.status == 'update'){
        if(!firstCall){
          waitForExceptionsFinder.tick();
          return;
        }
      }

      if(invertCmd(request.toggle)){        
        console.info("AutoInvert extension action", request);
        firstCall = true;
      }      

      aiLoaded();
      
      //sendResponse(true); // everythin fine broh
    }
  }
);

let tabLoaded = false;
window.addEventListener("load", ()=>{
  tabLoaded = true;
  aiLoaded();
});

let stateCheck = setInterval(() => {
  if (document.readyState === 'complete') {
    clearInterval(stateCheck);
    aiLoaded();
  }
}, 1000);