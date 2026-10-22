/* Page-opt-in portraits. The shared catalog still owns identity and selection. */
(function(global){
  "use strict";
  // Every buddy in the catalog: one is listed only once its painted portrait
  // is on disk (BUDDY2, 11 Oct 2026). The eight below are the fallback for an
  // older sona.js still cached on a phone.
  var OLD=["fox","bunny","dragon","cat","bee","octopus","dino","panda"];
  var ids=(function(){ try{ var c=global.Sona&&Sona.CHARACTERS; if(c&&c.length){ var out=[]; for(var i=0;i<c.length;i++)if(c[i]&&c[i].id)out.push(c[i].id); if(out.length)return out; } }catch(e){} return OLD.slice(); })();
  function source(id){
    try{ if(global.Sona&&Sona.buddySprite){ var p=Sona.buddySprite(id,"portrait"); if(typeof p==="string"&&p)return p; } }catch(e){}
    var c=global.Sona&&Sona.characterById?Sona.characterById(id):null;
    return c&&OLD.indexOf(c.id)!==-1?"/assets/crafted/buddy-"+c.id+"-v2.webp":null;
  }
  function markup(id,size){
    var px=Math.max(16,Math.min(256,Number(size)||40)),src=source(id);
    var fallback=global.Sona&&Sona.buddyMarkup?Sona.buddyMarkup(id,px):"";
    if(!src)return fallback;
    return '<span class="crafted-buddy" aria-hidden="true" style="position:relative;display:inline-block;width:'+px+'px;height:'+px+'px;vertical-align:middle;border-radius:50%;overflow:hidden">'+fallback+'<img src="'+src+'" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain" onerror="this.style.display=\'none\'" /></span>';
  }
  // The picture of a pose (after its own fallback pose, Sona.buddySprite), or
  // null when the buddy has none.
  function poseSrc(id,pose){
    if(!pose||pose==="portrait")return source(id);
    try{ if(global.Sona&&Sona.buddySprite){ var s=Sona.buddySprite(id,pose); if(s&&typeof s.src==="string")return s.src; } }catch(e){}
    return null;
  }
  // One Image per file, shared by every caller on the page. A pose with no
  // picture gives the portrait instead; img.buddyPose says which it is
  // ("portrait" for the badge), so a game can draw each the right way.
  var cache={};
  function image(id,pose,onload){
    var src=poseSrc(id,pose),got=src?(pose||"portrait"):"portrait";
    if(!src)src=source(id);
    if(!src)return null;
    var im=cache[src];
    if(!im){ im=new Image(); im.buddyPose=got; cache[src]=im; im.src=src; }
    if(typeof onload==="function"){
      if(im.complete&&im.naturalWidth)onload(im);
      else im.addEventListener("load",function(){ onload(im); });
    }
    return im;
  }
  // The round badge, clipped to a circle so no square corner shows behind a
  // rope, a rim or a porthole. False (and nothing drawn) until it has loaded.
  function drawCircle(ctx,img,x,y,size){
    if(!ctx||!img||!img.complete||!img.naturalWidth||!(size>0))return false;
    ctx.save();
    ctx.beginPath(); ctx.arc(x,y,size/2,0,Math.PI*2); ctx.closePath(); ctx.clip();
    ctx.drawImage(img,x-size/2,y-size/2,size,size);
    ctx.restore();
    return true;
  }
  // The flat sticker as a picture a canvas can draw: an SVG loads as an image
  // only with its xmlns, which the catalog's own strings leave out.
  function svgSrc(id){
    var c=global.Sona&&Sona.characterById?Sona.characterById(id):null;
    if(!c||!c.svg)return null;
    return "data:image/svg+xml;utf8,"+encodeURIComponent(c.svg.replace("<svg ",'<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" '));
  }
  // An <img> beside Echo (Hoops, Soccer Goal, Dino Dig, Feed Echo): the buddy
  // standing (its rest pose), else its badge (class "badge", made round by the
  // page), else its sticker; hidden if none of them loads. Answers {rest,
  // cheer} when it has both standing pictures, for the 900 ms cheer swap, and
  // calls onLost() if the swap must stop: the standing picture failed and the
  // badge took over, or the cheering one won't load (the buddy then simply
  // stays standing). The cheering picture is fetched now and held here, so the
  // first swap does not wait on the network (an unheld Image is thrown away).
  function stand(img,id,onLost){
    if(!img)return null;
    var rest=poseSrc(id,"rest"),cheer=poseSrc(id,"cheer"),pt=source(id),sv=svgSrc(id),list=[],at=-1,swap=!!(rest&&cheer);
    if(rest)list.push(rest);
    if(pt&&pt!==rest)list.push(pt);
    if(sv)list.push(sv);
    function lose(){ swap=false; if(typeof onLost==="function"){ var f=onLost; onLost=null; try{ f(); }catch(e){} } }
    function next(){
      at++;
      if(at>0&&rest&&list[0]===rest)lose();
      if(at>=list.length){ img.removeAttribute("src"); img.style.display="none"; return; }
      if(list[at]===rest)img.classList.remove("badge"); else img.classList.add("badge");
      img.src=list[at];
    }
    img.onerror=function(){
      if(cheer&&cheer!==rest&&img.getAttribute("src")===cheer){ lose(); if(at<list.length)img.src=list[at]; return; }
      next();
    };
    next();
    if(swap&&cheer!==rest){
      var held=image(id,"cheer");
      if(!held||(held.complete&&!held.naturalWidth&&held.getAttribute("src")))lose();
      else held.addEventListener("error",lose);
    }
    return swap?{rest:rest,cheer:cheer}:null;
  }
  global.SonaCraftedBuddies={ids:ids,source:source,markup:markup,image:image,drawCircle:drawCircle,svgSrc:svgSrc,stand:stand};
})(window);
