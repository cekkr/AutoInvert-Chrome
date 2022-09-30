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

///
/// Script
///

///
/// Excluded element from brightness inverting list
///
const invertExceptionClass = "autoInvertException";
const alreadyCheckedElement = "autoInvertChecked";
const applyBackgroundExceptionOnElements = ['div', 'figure', 'a'];
const dontCheckContentOn = ['a', 'figure'];

const exclude = []; 

// background-image exceptions
exclude.push('.'+invertExceptionClass);

/*for(let el of applyBackgroundExceptionOnElements)
  exclude.push(el + '[style*="background-image"]:empty');*/ // leave it to exceptionsFinder function

exclude.push('img'); // directly handled in the CSS
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
      el.removeAttribute(invertExceptionClass); 	  
	  }
  }
}

///
/// Canvas and images analyzing
///
function analyzeContext($el, ctx){
  $el.attr('aiAnalyzed', true); 

  let el = $el[0];
  
  const pixelsPerIncrement = 50;
  let increment = Math.round(((el.width + el.height)/2)/pixelsPerIncrement) || 1;    

  let diffs = {};
  const round = 1;
  let avgs = {};
  let totPixels = 0;

  for(let x=0; x<el.width; x+=increment){
    for(let y=0; y<el.height; y+=increment){
      let p = ctx.getImageData(x, y, 1, 1).data; 

      if(p[3]>250){
        let avg = (p[0]+p[1]+p[2])/3;
        let diff = (Math.abs(avg-p[0])+Math.abs(avg-p[1])+Math.abs(avg-p[2]))/3;

        let iavg = Math.round(avg/round);
        let idiff = Math.round(diff/round);

        let arr = avgs[iavg] = avgs[iavg] || {};
        arr['totPixels'] = (arr['totPixels'] || 0) + 1;
        arr[idiff] = (arr[idiff] || 0)+1;        
        totPixels++;

        //diffs[idiff] = (diffs[idiff] || 0)+1;
      }
    }
  }

  let indexes = Object.keys(avgs);
  let indexesLen = indexes.length;

  let numDiffs = Object.keys(diffs).length;

  let justInvert = true;

  const maxShades = 3;
  if(indexesLen > maxShades){ 
    justInvert = false;
  }
  else {
    const minMix = 0.01; //it works, even if i don't know why. Hey, but it works.

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

    totMixPower /= totPixels;
    let variety = totMix * totMixPower;    

    console.log('totMix', totMixPower, variety, el);

    if(variety < minMix && variety != 0)
      justInvert = false;
  }

  if(justInvert){
    if($el.is('img'))
      $el.addClass('imposeZeroFilter');    
  }
  else{
    if($el.is('canvas'))
      $el.addClass(invertExceptionClass);
  }     

  // console.log('avgs', avgs, el);
}

function analyzeImg(img){
  let el = $(img);
  
  if(el.attr('aiAnalyzed'))
    return;

  let ctx = undefined;
  if(el.is('img')){
    let canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d');

    let base_image = new Image();
    base_image.src = img.src;
    base_image.crossOrigin = "Anonymous";
    base_image.onload = function(){
      ctx.drawImage(base_image, 0, 0);
      analyzeContext(el, ctx);        
    }
  }
  else {
    let canvas = img;
    canvas.crossOrigin = "Anonymous";
    ctx = canvas.getContext('2d');
    analyzeContext(el, ctx);
  }
}

///
///
let classes = {};

function exceptionsFinder(){
  for(let el of applyBackgroundExceptionOnElements){
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
        let hasBackgroundImage = elStyle.includes("background-image:url(")

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
            if(style && (backgroundImage = style.getPropertyValue('background-image'))){
              backgroundImage = backgroundImage.replaceAll(' ','');
              hasBackgroundImage = backgroundImage.startsWith('url(');
              break;
            }
          }
        }

        if(hasBackgroundImage){          
          let isEmpty = true;

          if(checkContent){
            let text = node.innerText;

            for(let c in text){
              const ch = text[c];

              if(emptyChars.indexOf(ch)<0){  // Check if there are just useless char
                isEmpty = false;
                break;
              }
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

  ///
  /// Check for canvas (and images)
  ///
  let els = $("canvas, img");
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

let waitForExceptionsFinder = new WaitMoment(30, ()=>{
  exceptionsFinder();

  // GitHub exception
  if(tabLoaded)
    aiLoaded();
});

// Select the node that will be observed for mutations
let targetNode = document.querySelector('html');

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

  //if(!invert) return ''; //try this way

  // Calculate filters
  let filters = [];
  filters.push("drop-shadow(0px 0px 3px rgba(127, 127, 127, "+(invert?0.90:0)+"))")
  filters.push("invert("+(invert?1:0)+")");
  filters.push("hue-rotate("+(invert?180:0)+"deg)"); // compensate color change // todo: reflect about this
  filters.push("contrast("+(invert?0.95:1)+")");
  //filters.push("brightness("+(invert?1.05:1)+")");
  let strFilters = filters.join(" ");

  let exclFilters = [];
  exclFilters.push("invert("+(invert?1:0)+")");
  exclFilters.push("hue-rotate("+(invert?180:0)+"deg)"); // compensate color change // todo: reflect about this
  exclFilters.push("contrast("+(invert?1.2:1)+")");
  exclFilters.push("brightness("+(invert?1.1:1)+")");
  let strExclFilters = exclFilters.join(" ");

  filters.splice(3);
  filters.push("blur(2px)");
  filters.push("contrast(0.85)");
  let strExclBackFilter = invert ? filters.join(" ") : '';

  let invertCss = invert ? 'html {background-color:white} body{text-shadow: 0px 0px 2px rgba(127, 127, 127, 0.9);} a{ /*color: #031d38;*/ -webkit-text-stroke: 0.25px black; }' : ''; // removed: text-shadow: 0px 0px 1px rgba(127, 127, 127, 1);

  let curExclude = [...exclude];
  for(var e in curExclude){
    curExclude[e] += ':not(.imposeZeroFilter)';
  }
  
  let curExcludeHover = [...exclude];
  for(var e in curExcludeHover){
    curExcludeHover[e] += '.imposeZeroFilter::hover';
  }
  
  let style = `
    html { 
      -webkit-filter: `+strFilters +`; 
      transition: -webkit-filter 0.3s;
    }
  `; 
    
  if(invert) style += `
    html {
      background-color:white
    } 
    
    body {
      text-shadow: 0px 0px 2px rgba(127, 127, 127, 0.9);
    } 
    
    a { 
      /*color: #031d38;*/ 
      -webkit-text-stroke: 0.25px black; 
    }

    /* Excluded elements */
    ` // excluded elements (inverted twice => not inverted)
    +curExclude.join(', ')+` {
      /*backdrop-filter: `+ strExclBackFilter +`;*/
      -webkit-filter: `+ strExclFilters  +`; 

      transition-duration: 0.3s;
    }

    /* Doesn't works */
    `+curExcludeHover.join(', ')+` {
      backdrop-filter: invert(0) drop-shadow(0,0, 3px, rgb(127,127,127)) !important;
      transition-duration: 0.3s;
      -webkit-filter: `+ strExclFilters  +` !important; 
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

  targetNode.setAttribute("aiLoaded", true);
  if(body) body.setAttribute("aiLoaded", true);

  if($("style").length <= 1)
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