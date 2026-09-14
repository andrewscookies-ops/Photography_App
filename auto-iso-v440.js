(function(){
  var AUTO_STEPS=[25,32,40,50,64,80,100,125,160,200,250,320,400,500,640,800,1000,1250,1600,2000,2500,3200,4000,5000,6400,8000,10000,12800,16000,20000,25600,32000,40000,51200];
  var autoOn=true, autoCtx=null;

  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function interp(vals,x){
    x=clamp(Number(x)||0,0,1)*(vals.length-1);
    var i=Math.floor(x),j=Math.min(vals.length-1,i+1),f=x-i;
    return vals[i]+(vals[j]-vals[i])*f;
  }
  function snapISO(v){
    v=clamp(Number(v)||400,AUTO_STEPS[0],AUTO_STEPS[AUTO_STEPS.length-1]);
    var best=AUTO_STEPS[0],d=Infinity;
    AUTO_STEPS.forEach(function(x){
      var q=Math.abs(Math.log2(x/v));
      if(q<d){d=q;best=x;}
    });
    return best;
  }
  function isFilm(){return currentCaptureMode()==='film';}
  function camera(){
    var v=document.getElementById('cameraSelect')?.value||'';
    return v?findCameraByName(v)||null:null;
  }
  function lens(){
    var v=document.getElementById('lensSelect')?.value||'';
    return v?findLensByName(v)||null:null;
  }
  function focal(l){
    if(l){try{return focalValueForLens(l);}catch(e){}}
    var v=parseFloat(document.getElementById('focalInput')?.value);
    return isFinite(v)&&v>0?v:null;
  }
  function targetAperture(l,f,ci){
    var N;
    if(l){
      var ap=lensApertureAtFocal(l,f||focalValueForLens(l));
      var deep=Math.min(Math.max(11,ap.minA),ap.maxA);
      N=deep+(ap.minA-deep)*ci.blur;
      if(f&&isFinite(f))N*=Math.pow(Math.SQRT2,Math.log2(clamp(f,20,200)/50)*0.5);
      return clamp(N,ap.minA,ap.maxA);
    }
    N=interp([16,11,8,4,2],ci.blur);
    if(f&&isFinite(f))N*=Math.pow(Math.SQRT2,Math.log2(clamp(f,20,200)/50)*0.5);
    return clamp(N,1,32);
  }
  function targetShutter(c,f,ci){
    var t=interp([1/15,1/30,1/125,1/500,1/1000],ci.freeze);
    if(f&&isFinite(f))t*=clamp(50/f,0.25,4);
    if(ci.panning)t*=3;
    if(ci.tripod&&!ci.panning&&ci.freeze<=0.5)t*=4;
    if(c&&c.max_shutter_den)t=Math.max(t,1/c.max_shutter_den);
    return t;
  }
  function filmISO(){
    return Math.max(1,parseInt(document.getElementById('isoSelect')?.value,10)||400);
  }
  function manualISO(){
    return Math.max(1,parseInt(document.getElementById('quickISO')?.value,10)||parseInt(document.getElementById('isoNumeric')?.value,10)||400);
  }
  function calculate(){
    var ev=effectiveEV()+(parseFloat(document.getElementById('evBias')?.value)||0);
    var ci=getCI(),c=camera(),l=lens(),f=focal(l);
    var N=targetAperture(l,f,ci),t=targetShutter(c,f,ci);
    var raw=100*N*N/(Math.pow(2,ev)*Math.max(t,1/32000));
    raw*=Math.pow(2,(ci.grain-0.5)*1.33);
    var lo=(c&&c.iso_min)||AUTO_STEPS[0],hi=(c&&c.iso_max)||AUTO_STEPS[AUTO_STEPS.length-1];
    lo=clamp(lo,AUTO_STEPS[0],AUTO_STEPS[AUTO_STEPS.length-1]);
    hi=clamp(hi,lo,AUTO_STEPS[AUTO_STEPS.length-1]);
    var clipped=raw<lo?'low':(raw>hi?'high':'');
    var iso=snapISO(clamp(raw,lo,hi));
    autoCtx={iso:iso,raw:raw,ev:ev,N:N,t:t,camera:c,lens:l,focal:f,ci:ci,clipped:clipped,lo:lo,hi:hi};
    return iso;
  }
  function putISO(v){
    var q=document.getElementById('quickISO'),n=document.getElementById('isoNumeric');
    if(q)q.value=String(v);
    if(n)n.value=String(v);
  }
  function updateUI(){
    var q=document.getElementById('quickISO'),b=document.getElementById('isoAutoBtn'),h=document.getElementById('autoISOHint');
    if(!q||!b)return;
    if(isFilm()){
      b.style.display='none';q.readOnly=false;
      if(h)h.textContent='Film speed stays fixed to the selected film ISO.';
      return;
    }
    b.style.display='';
    if(autoOn){
      var iso=autoCtx?autoCtx.iso:calculate();
      putISO(iso);q.readOnly=true;q.setAttribute('aria-readonly','true');
      b.classList.add('active');b.setAttribute('aria-pressed','true');b.textContent='AUTO';
      q.title='Auto ISO is choosing this value from the light and your active shooting choices.';
      if(h)h.textContent='Auto ISO changes with light, focal length, gear limits, and Creative Intent.';
    }else{
      q.readOnly=false;q.removeAttribute('aria-readonly');
      b.classList.remove('active');b.setAttribute('aria-pressed','false');b.textContent='Auto';
      q.title='Manual ISO';
      if(h)h.textContent='Manual ISO — tap Auto to let the app choose sensitivity.';
    }
  }
  function enhanceWhy(){
    var host=document.getElementById('whyDetails');
    if(!host)return;
    host.querySelectorAll('[data-v440-note]').forEach(function(n){n.remove();});
    var ul=host.querySelector('ul');
    if(!ul)return;
    if(!isFilm()&&autoOn&&autoCtx){
      var li=document.createElement('li');
      li.dataset.v440Note='1';
      li.textContent='Auto ISO chose ISO '+autoCtx.iso+' to balance the current light with the aperture and shutter targets created by your active settings'+(autoCtx.focal?' at '+Math.round(autoCtx.focal)+'mm':'')+'.';
      ul.insertBefore(li,ul.children[1]||null);
      if(autoCtx.clipped){
        var lim=document.createElement('li');lim.dataset.v440Note='1';
        lim.textContent=autoCtx.clipped==='high'?'Auto ISO reached the current upper ISO limit; a wider aperture, slower shutter, or more light may be needed.':'Auto ISO reached the current lower ISO limit; a smaller aperture, faster shutter, or ND filter may be needed.';
        ul.appendChild(lim);
      }
    }
    if(isFilm()){
      var f=null;try{f=currentFilm();}catch(e){}
      if(f){
        var g=document.createElement('li');g.dataset.v440Note='1';
        if(f.box_iso<=100)g.textContent=f.name+' is a slower ISO '+f.box_iso+' film, which generally favors finer grain than faster film; exact grain depends on the emulsion and development.';
        else if(f.box_iso>=800)g.textContent=f.name+' is a fast ISO '+f.box_iso+' film, which generally shows more grain than slower film; exact grain depends on the emulsion and development.';
        else g.textContent=f.name+' is an ISO '+f.box_iso+' film; its grain is generally more visible than slower film and less pronounced than very fast film, though emulsion and development matter.';
        ul.appendChild(g);
      }
    }
  }
  function install(){
    var g=document.getElementById('quickISOGroup'),q=document.getElementById('quickISO');
    if(!g||!q)return;
    g.classList.add('auto-iso-group');
    if(!document.getElementById('isoAutoBtn')){
      var b=document.createElement('button');b.type='button';b.id='isoAutoBtn';b.className='iso-auto-btn';b.textContent='AUTO';b.setAttribute('aria-label','Toggle Auto ISO');b.setAttribute('aria-pressed','true');g.appendChild(b);
    }
    if(!document.getElementById('autoISOHint')){
      var h=document.createElement('div');h.id='autoISOHint';h.className='sub auto-iso-hint';g.appendChild(h);
    }
  }
  function styles(){
    if(document.getElementById('v440AutoISOStyle'))return;
    var s=document.createElement('style');s.id='v440AutoISOStyle';
    s.textContent='.auto-iso-group{display:flex;align-items:flex-end;gap:8px;flex-wrap:wrap}.auto-iso-group label{flex:0 1 150px}.iso-auto-btn{width:auto!important;min-width:68px;min-height:42px;padding:8px 12px!important;font-weight:750;letter-spacing:.3px}.iso-auto-btn.active{background:var(--accent);color:var(--accent-contrast);border-color:var(--accent)}.auto-iso-hint{flex:1 1 100%;margin-top:-2px}.auto-iso-group input[readonly]{background:var(--chipBg);font-weight:700}';
    document.head.appendChild(s);
  }

  document.addEventListener('DOMContentLoaded',function(){
    styles();install();
    getSelectedISO=function(){
      if(isFilm())return filmISO();
      if(autoOn){var v=calculate();putISO(v);return v;}
      autoCtx=null;return manualISO();
    };
    var baseRecalc=recalc;
    recalc=function(){baseRecalc();updateUI();enhanceWhy();};
    var b=document.getElementById('isoAutoBtn');
    if(b&&!b.dataset.v440){
      b.dataset.v440='1';
      b.addEventListener('click',function(){if(isFilm())return;autoOn=!autoOn;autoCtx=null;recalc();});
    }
    var mode=document.getElementById('captureMode');
    if(mode&&!mode.dataset.v440){
      mode.dataset.v440='1';
      mode.addEventListener('change',function(){autoCtx=null;setTimeout(recalc,0);});
    }
    var reset=document.getElementById('gearReset');
    if(reset&&!reset.dataset.v440){
      reset.dataset.v440='1';
      reset.addEventListener('click',function(){autoOn=true;autoCtx=null;setTimeout(recalc,0);});
    }
    autoOn=true;autoCtx=null;recalc();
  });
})();