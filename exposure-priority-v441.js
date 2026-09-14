(function(){
  var originalRecommend=window.recommend;

  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function splitWarnings(s){return String(s||'').split(' • ').map(function(x){return x.trim();}).filter(Boolean);}
  function unique(items){var seen={};return items.filter(function(x){if(seen[x])return false;seen[x]=1;return true;});}
  function parseRecommendation(){
    var txt=document.getElementById('output')?.textContent||'';
    var iso=parseInt((txt.match(/ISO\s+(\d+)/)||[])[1],10);
    var N=parseFloat((txt.match(/f\/([0-9.]+)/)||[])[1]);
    var sm=txt.match(/(?:^|•)\s*(\d+s|1\/\d+)/);
    var t=sm?parseShutterText(sm[1]):NaN;
    return {iso:iso,N:N,t:t};
  }
  function motionGoal(ci,focal){
    var targets=[1/8,1/30,1/60,1/250,1/500,1/1000];
    var idx=Math.round(clamp(ci.freeze,0,1)*5);
    var t=targets[idx];
    if(focal&&isFinite(focal))t*=clamp(50/focal,0.25,4);
    if(ci.panning)t*=3;
    return t;
  }
  function selectedFocal(){
    var name=document.getElementById('lensSelect')?.value||'';
    var l=name?findLensByName(name):null;
    if(l){try{return focalValueForLens(l);}catch(e){}}
    var f=parseFloat(document.getElementById('focalInput')?.value);
    return isFinite(f)&&f>0?f:null;
  }
  function currentSceneEV(){
    try{return effectiveEV()+(parseFloat(document.getElementById('evBias')?.value)||0);}catch(e){return NaN;}
  }

  // Gear-specific recommendation: if the ideal exposure needs a shutter faster than
  // the selected camera can provide, first rebalance aperture so the displayed
  // recommendation remains properly exposed. Creative preference yields before exposure.
  if(typeof originalRecommend==='function'){
    window.recommend=function(ev,film,lens,focal,camera){
      var rec=originalRecommend(ev,film,lens,focal,camera);
      try{
        if(!rec||!lens||!camera||!camera.max_shutter_den)return rec;
        var iso=Math.max(1,Number(rec.iso)||getSelectedISO()||400);
        var evUse=ev+(parseFloat(document.getElementById('evBias')?.value)||0);
        var fastest=1/camera.max_shutter_den;
        var exact=requiredShutter(evUse,iso,rec.N);
        if(exact<fastest){
          var ap=lensApertureAtFocal(lens,focal);
          var needN=Math.sqrt(Math.pow(2,evUse)*(iso/100)*fastest);
          var warnings=splitWarnings(rec.warns).filter(function(x){
            return x!=='Current data exceeds camera capability.' && x.indexOf('Use ND')!==0;
          });
          if(needN<=ap.maxA+1e-9){
            var newN=nearestAperture(clamp(needN,ap.minA,ap.maxA),lens,camera);
            var newT=requiredShutter(evUse,iso,newN);
            if(newT<fastest)newT=fastest;
            rec.N=newN;
            rec.t=nearestShutterForCamera(camera,newT);
            warnings.push('Exposure priority: the aperture was adjusted to keep a proper exposure within '+camera.name+'’s shutter-speed limit.');
          }else{
            rec.N=nearestAperture(ap.maxA,lens,camera);
            rec.t=nearestShutterForCamera(camera,fastest);
            warnings.push('Proper exposure is outside the selected camera/lens range at this ISO. Lower ISO, add an ND filter, or change the lighting.');
          }
          rec.warns=unique(warnings).join(' • ');
        }
      }catch(e){}
      return rec;
    };
  }

  function creativeConflictWarnings(){
    var ci;
    try{ci=getCI();}catch(e){return [];}
    var r=parseRecommendation();
    if(!(r.iso>0)||!(r.N>0)||!(r.t>0))return [];
    var ev=currentSceneEV(),f=selectedFocal(),notes=[];
    var tGoal=motionGoal(ci,f);
    var dark=isFinite(ev)&&ev<=7;
    var bright=isFinite(ev)&&ev>=14;

    if(ci.blur<0.4 && dark){
      notes.push('Creative intent note: deep depth of field is harder in this light. Proper exposure may require a slower shutter, higher ISO, or a wider aperture. Add light or use a tripod if you want to keep a smaller aperture.');
    }
    if(ci.freeze>0.6 && r.t>tGoal*1.25){
      notes.push('Creative intent note: freezing motion is difficult at this light level with the current settings. Proper exposure is being prioritized; add light, raise ISO, or use a wider aperture to get a faster shutter.');
    }
    if(ci.freeze<0.4 && r.t<tGoal/1.25){
      notes.push('Creative intent note: the current light makes the requested motion blur difficult while keeping proper exposure. Lower ISO, stop down, or use an ND filter for a slower shutter.');
    }
    if(ci.blur>0.6 && bright){
      var camName=document.getElementById('cameraSelect')?.value||'';
      var cam=camName?findCameraByName(camName):null;
      if(cam&&cam.max_shutter_den && r.t<=1/cam.max_shutter_den*1.05){
        notes.push('Creative intent note: very shallow depth of field is difficult in this bright light within the camera’s shutter limit. Lower ISO or use an ND filter to keep the aperture wider.');
      }
    }
    if(!ci.tripod && f&&r.t>handholdLimit(f)*1.05 && ci.blur<0.5){
      notes.push('Creative intent note: keeping deeper depth of field is forcing a slower handheld shutter at '+Math.round(f)+'mm. A tripod, more light, or higher ISO would preserve depth of field with less camera-shake risk.');
    }
    return unique(notes);
  }

  function appendCreativeWarnings(){
    var warn=document.getElementById('warning');
    if(!warn)return;
    var existing=splitWarnings(warn.textContent).filter(function(x){return x.indexOf('Creative intent note:')!==0;});
    var notes=creativeConflictWarnings();
    warn.textContent=unique(existing.concat(notes)).join(' • ');
  }

  document.addEventListener('DOMContentLoaded',function(){
    // Run after the Auto ISO layer has wrapped recalc. This leaves its exposure math
    // intact and adds creative-intent conflict guidance in the existing red warning area.
    var prior=window.recalc;
    if(typeof prior==='function'){
      window.recalc=function(){
        prior();
        appendCreativeWarnings();
      };
    }
    try{window.recalc();}catch(e){}
  });
})();