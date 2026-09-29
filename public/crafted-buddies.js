/* Page-opt-in portraits. The shared catalog still owns identity and selection. */
(function(global){
  "use strict";
  var ids=["fox","bunny","dragon","cat","bee","octopus","dino","panda"];
  function source(id){
    var c=global.Sona&&Sona.characterById?Sona.characterById(id):null;
    return c&&ids.indexOf(c.id)!==-1?"/assets/crafted/buddy-"+c.id+"-v2.webp":null;
  }
  function markup(id,size){
    var px=Math.max(16,Math.min(256,Number(size)||40)),src=source(id);
    var fallback=global.Sona&&Sona.buddyMarkup?Sona.buddyMarkup(id,px):"";
    if(!src)return fallback;
    return '<span class="crafted-buddy" aria-hidden="true" style="position:relative;display:inline-block;width:'+px+'px;height:'+px+'px;vertical-align:middle;border-radius:50%;overflow:hidden">'+fallback+'<img src="'+src+'" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain" onerror="this.style.display=\'none\'" /></span>';
  }
  global.SonaCraftedBuddies={source:source,markup:markup};
})(window);
