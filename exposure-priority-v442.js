(function(){
  var originalRecommend=window.recommend;

  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function splitWarnings(s){return String(s||'').split(' • ').map(function(x){return x.trim();}).filter(Boolean);}
  function unique(items){var seen={};return items.filter(function(x){if(!x||seen[x])return false;seen[x]=1;return true;});}
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
  function sharpHandheldLimit(ci,focal){
    if(ci.tripod||ci.panning)return Infinity;
    var safe=focal&&isFinite(focal)?1/Math.max(60,2*focal):1/125;
    // Neutral / Sharp / Frozen all preserve the conservative sharp-handheld floor.
    // Moving toward intentional blur progressively relaxes it.
    if(ci.freeze<0.5)safe*=Math.pow(2,(0.5-ci.freeze)*6);
    return safe;
  }
  function cameraFastest(camera){return camera&&camera.max_shutter_den?1/camera.max_shutter_den:1/8000;}
  function shutterList(camera){return camera&&camera.shutter_step==='full'?shuttersFull:shuttersThird;}
  function shutterAtOrFaster(camera,desired){
    var fastest=cameraFastest(camera),limit=Math.max(desired,fastest),list=shutterList(camera),best=fastest;
    for(var i=0;i<list.length;i++){
      var s=list[i];
      if(s<fastest-1e-12)continue;
      if(s<=limit+1e-12 && s>best)best=s;
    }
    return best;
  }
  function bounds(lens,focal){
    if(lens){
      try{return lensApertureAtFocal(lens,focal||focalValueForLens(lens));}catch(e){}
    }
    return {minA:1,maxA:32};
  }
  function snapApertureSafe(N,lens,camera,focal,maxTime,ev,iso){
    var ap=bounds(lens,focal),out;
    if(lens){
      try{out=nearestAperture(clamp(N,ap.minA,ap.maxA),lens,camera);}catch(e){out=clamp(N,ap.minA,ap.maxA);}
    }else{
      var q=(camera&&camera.aperture_step==='full')?0.5:(1/6);
      out=Math.pow(2,Math.round(Math.log2(clamp(N,ap.minA,ap.maxA))/q)*q);
      out=parseFloat(clamp(out,ap.minA,ap.maxA).toFixed(1));
    }
    var step=(camera&&camera.aperture_step==='full')?Math.SQRT2:Math.pow(2,1/6);
    while(out>ap.minA+1e-9 && requiredShutter(ev,iso,out)>maxTime*1.001){
      out=Math.max(ap.minA,out/step);
      if(lens){
        try{out=nearestAperture(out,lens,camera);}catch(e){}
      }else out=parseFloat(out.toFixed(1));
    }
    return clamp(out,ap.minA,ap.maxA);
  }
  function autoISOActive(){
    var b=document.getElementById('isoAutoBtn');
    return currentCaptureMode()!=='film' && !!(b&&b.classList.contains('active'));
  }
  function modeAdvice(){
    if(currentCaptureMode()==='film')return 'use faster film / push processing';
    return 'raise ISO';
  }
  function rebalance(rec,ev,lens,focal,camera){
    try{
      if(!rec)return rec;
      var ci=getCI(),safe=sharpHandheldLimit(ci,focal);
      if(!isFinite(safe)||!(rec.t>safe*1.03))return rec;

      var iso=Math.max(1,Number(rec.iso)||getSelectedISO()||400);
      var fastest=cameraFastest(camera);
      var target=Math.max(safe,fastest);
      var targetShutter=shutterAtOrFaster(camera,target);
      var ap=bounds(lens,focal);
      var originalN=Number(rec.N)||5.6;
      var needN=Math.sqrt(Math.pow(2,ev)*(iso/100)*targetShutter);
      var warnings=splitWarnings(rec.warns).filter(function(x){
        return x.indexOf('Handheld risk.')!==0 && x.indexOf('Creative intent note:')!==0 && x.indexOf('Sharp handheld')!==0 && x.indexOf('Exposure/sharpness priority:')!==0;
      });

      if(needN>=ap.minA-1e-9){
        var newN=snapApertureSafe(needN,lens,camera,focal,targetShutter,ev,iso);
        var exactT=requiredShutter(ev,iso,newN);
        var newT=shutterAtOrFaster(camera,Math.min(targetShutter,exactT));
        rec.N=parseFloat(newN.toFixed(1));
        rec.t=newT;
        if(ci.blur<0.5 && rec.N<originalN/1.12){
          warnings.push('Creative intent note: the aperture was opened to about f/'+rec.N.toFixed(1)+' to keep the shot both properly exposed and comfortably sharp handheld. Deeper depth of field will be harder; add light, '+modeAdvice()+', or use a tripod if you want to stop down more.');
        }else{
          warnings.push('Exposure/sharpness priority: shutter speed was kept near '+fmtSh(targetShutter)+' or faster to make a sharp handheld shot easier.');
        }
        if(!lens && rec.N<1.8){
          warnings.push('This general recommendation requires a lens capable of about f/'+rec.N.toFixed(1)+'.');
        }
      }else{
        var useN=ap.minA;
        rec.N=parseFloat(useN.toFixed(1));
        rec.t=targetShutter;
        var neededISO=100*(useN*useN)/(Math.pow(2,ev)*targetShutter);
        var deficit=Math.max(0,Math.log2(neededISO/iso));
        if(autoISOActive()){
          warnings.push('Sharp handheld exposure is at the limit of the current light/gear. About ISO '+Math.ceil(neededISO/100)*100+' would be needed at f/'+rec.N.toFixed(1)+' and '+fmtSh(targetShutter)+'. Add light, use a wider-capability lens, or use a tripod if Auto ISO cannot reach it.');
        }else{
          warnings.push('Sharp handheld exposure is not possible at the current ISO and available aperture. Holding '+fmtSh(targetShutter)+' protects sharpness but would be about '+deficit.toFixed(1)+' stop'+(Math.abs(deficit-1)<0.05?'':'s')+' underexposed. Add light, '+modeAdvice()+', or use a tripod.');
        }
      }
      rec.warns=unique(warnings).join(' • ');
      return rec;
    }catch(e){return rec;}
  }

  if(typeof originalRecommend==='function'){
    window.recommend=function(ev,film,lens,focal,camera){
      var rec=originalRecommend(ev,film,lens,focal,camera);
      var evUse=ev+(parseFloat(document.getElementById('evBias')?.value)||0);
      return rebalance(rec,evUse,lens,focal,camera);
    };
  }

  function parseRecommendation(){
    var txt=document.getElementById('output')?.textContent||'';
    var iso=parseInt((txt.match(/ISO\s+(\d+)/)||[])[1],10);
    var N=parseFloat((txt.match(/f\/([0-9.]+)/)||[])[1]);
    var sm=txt.match(/(?:^|•)\s*(\d+s|1\/\d+)/);
    var t=sm?parseShutterText(sm[1]):NaN;
    return {iso:iso,N:N,t:t};
  }
  function postProcessGeneral(){
    var lensName=document.getElementById('lensSelect')?.value||'';
    if(lensName)return; // gear-specific path is handled by wrapped recommend()
    var r=parseRecommendation();
    if(!(r.iso>0)||!(r.N>0)||!(r.t>0))return;
    var ci=getCI(),focal=selectedFocal(),safe=sharpHandheldLimit(ci,focal);
    if(!isFinite(safe)||!(r.t>safe*1.03))return;
    var ev=currentSceneEV();if(!isFinite(ev))return;
    var target=shutterAtOrFaster(null,safe);
    var originalN=r.N;
    var needN=Math.sqrt(Math.pow(2,ev)*(r.iso/100)*target);
    var N=snapApertureSafe(needN,null,null,focal,target,ev,r.iso);
    var warning=document.getElementById('warning');
    var notes=splitWarnings(warning?.textContent).filter(function(x){return x.indexOf('Creative intent note:')!==0 && x.indexOf('Sharp handheld')!==0 && x.indexOf('Exposure/sharpness priority:')!==0;});
    var impossible=needN<1;
    if(impossible){
      N=1;
      var neededISO=100/(Math.pow(2,ev)*target),deficit=Math.max(0,Math.log2(neededISO/r.iso));
      notes.push('Sharp handheld exposure is not possible at the current ISO without assuming an unusually fast lens. Holding '+fmtSh(target)+' protects sharpness but would be about '+deficit.toFixed(1)+' stop'+(Math.abs(deficit-1)<0.05?'':'s')+' underexposed. Add light, '+modeAdvice()+', select a faster lens, or use a tripod.');
    }else if(ci.blur<0.5 && N<originalN/1.12){
      notes.push('Creative intent note: the aperture was opened to about f/'+N.toFixed(1)+' to keep the shot both properly exposed and comfortably sharp handheld. Deeper depth of field will be harder; add light, '+modeAdvice()+', or use a tripod if you want to stop down more.');
    }else{
      notes.push('Exposure/sharpness priority: shutter speed was kept near '+fmtSh(target)+' or faster to make a sharp handheld shot easier.');
    }
    if(N<1.8)notes.push('This general recommendation requires a lens capable of about f/'+N.toFixed(1)+'.');
    var t=target;
    var txt='ISO '+r.iso+' • f/'+N.toFixed(1)+' • '+fmtSh(t);
    var out=document.getElementById('output');if(out)out.textContent=txt;
    var hr=document.getElementById('headerRecommendation');if(hr)hr.textContent=txt;
    if(warning)warning.textContent=unique(notes).join(' • ');
  }

  document.addEventListener('DOMContentLoaded',function(){
    var prior=window.recalc;
    if(typeof prior==='function'){
      window.recalc=function(){
        prior();
        postProcessGeneral();
      };
    }
    try{window.recalc();}catch(e){}
  });
})();