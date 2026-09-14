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
  function sharpHandheldLimit(f,ci){
    if(ci.tripod||ci.panning)return Infinity;
    var safe=f&&isFinite(f)?1/Math.max(60,2*f):1/125;
    if(ci.freeze<0.5)safe*=Math.pow(2,(0.5-ci.freeze)*6);
    return safe;
  }
  function targetShutter(c,f,ci){
    var t=interp([1/15,1/30,1/125,1/500,1/1000],ci.freeze);
    if(f&&isFinite(f))t*=clamp(50/f,0.25,4);
    if(ci.panning)t*=3;
    if(ci.tripod&&!ci.panning&&ci.freeze<=0.5)t*=4;
    var safe=sharpHandheldLimit(f,ci);
    if(isFinite(safe))t=Math.min(t,safe);
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
    autoCtx={iso:iso,raw:raw,ev:ev,N:N,t:t,camera:c,lens:l,focal:f,ci:ci,clipped:clipped,lo:lo,hi:hi,safe:sharpHandheldLimit(f,ci)};
    return iso;
  }
  function putISO(v){
    var q=document.getElementById('quickISO'),n=document.getElementById('isoNumeric');
    if(q)q.value=String(v);
    if(n)n.value=String(v);
  }
  function setStepVisibility(show){
    var minus=document.getElementById('isoStepDown'),plus=document.getElementById('isoStepUp');
    [minus,plus].forEach(function(btn){
      if(!btn)return;
      btn.classList.toggle('iso-step-hidden',!show);
      btn.tabIndex=show?0:-1;
      btn.setAttribute('aria-hidden',show?'false':'true');
    });
  }
  function updateUI(){
    var g=document.getElementById('quickISOGroup'),q=document.getElementById('quickISO'),b=document.getElementById('isoAutoBtn'),h=document.getElementById('autoISOHint');
    if(!q||!b)return;
    if(isFilm()){
      b.style.display='none';q.readOnly=false;setStepVisibility(false);
      if(g)g.classList.remove('manual-iso-mode');
      if(h)h.textContent='Film speed stays fixed to the selected film ISO.';
      return;
    }
    b.style.display='';
    if(autoOn){
      var iso=autoCtx?autoCtx.iso:calculate();
      putISO(iso);q.readOnly=true;q.setAttribute('aria-readonly','true');
      b.classList.add('active');b.setAttribute('aria-pressed','true');b.textContent='Manual';
      b.setAttribute('aria-label','Switch to manual ISO');
      if(g)g.classList.remove('manual-iso-mode');
      setStepVisibility(false);
      q.title='Auto ISO is choosing this value from the light and your active shooting choices.';
      if(h)h.textContent='Auto ISO favors a properly exposed, comfortably sharp handheld shot unless you intentionally choose motion blur.';
    }else{
      q.readOnly=false;q.removeAttribute('aria-readonly');
      b.classList.remove('active');b.setAttribute('aria-pressed','false');b.textContent='Auto';
      b.setAttribute('aria-label','Switch to Auto ISO');
      if(g)g.classList.add('manual-iso-mode');
      setStepVisibility(true);
      q.title='Manual ISO';
      if(h)h.textContent='Manual ISO — use − / + or type a value. Tap Auto to let the app choose sensitivity.';
    }
  }
  function stepManual(dir){
    if(autoOn||isFilm())return;
    var v=manualISO(),next=v;
    if(dir>0){
      next=AUTO_STEPS[AUTO_STEPS.length-1];
      for(var i=0;i<AUTO_STEPS.length;i++){if(AUTO_STEPS[i]>v){next=AUTO_STEPS[i];break;}}
    }else{
      next=AUTO_STEPS[0];
      for(var j=AUTO_STEPS.length-1;j>=0;j--){if(AUTO_STEPS[j]<v){next=AUTO_STEPS[j];break;}}
    }
    putISO(next);autoCtx=null;recalc();
  }
  function enhanceWhy(){
    var host=document.getElementById('whyDetails');
    if(!host)return;
    host.querySelectorAll('[data-v443-note],[data-v442-note],[data-v440-note]').forEach(function(n){n.remove();});
    var ul=host.querySelector('ul');
    if(!ul)return;
    if(!isFilm()&&autoOn&&autoCtx){
      var li=document.createElement('li');
      li.dataset.v443Note='1';
      li.textContent='Auto ISO chose ISO '+autoCtx.iso+' to balance proper exposure with aperture intent and a comfortably sharp handheld shutter'+(autoCtx.focal?' at '+Math.round(autoCtx.focal)+'mm':'')+'.';
      ul.insertBefore(li,ul.children[1]||null);
      if(autoCtx.clipped){
        var lim=document.createElement('li');lim.dataset.v443Note='1';
        lim.textContent=autoCtx.clipped==='high'?'Auto ISO reached the current upper ISO limit; more light, a wider aperture, or a tripod may be needed.':'Auto ISO reached the current lower ISO limit; a smaller aperture, faster shutter, or ND filter may be needed.';
        ul.appendChild(lim);
      }
    }
    if(isFilm()){
      var f=null;try{f=currentFilm();}catch(e){}
      if(f){
        var grain=document.createElement('li');grain.dataset.v443Note='1';
        if(f.box_iso<=100)grain.textContent=f.name+' is a slower ISO '+f.box_iso+' film, which generally favors finer grain than faster film; exact grain depends on the emulsion and development.';
        else if(f.box_iso>=800)grain.textContent=f.name+' is a fast ISO '+f.box_iso+' film, which generally shows more grain than slower film; exact grain depends on the emulsion and development.';
        else grain.textContent=f.name+' is an ISO '+f.box_iso+' film; its grain is generally more visible than slower film and less pronounced than very fast film, though emulsion and development matter.';
        ul.appendChild(grain);
      }
    }
  }
  function install(){
    var g=document.getElementById('quickISOGroup'),q=document.getElementById('quickISO');
    if(!g||!q)return;
    g.classList.add('auto-iso-group');
    var label=q.closest('label');
    if(label)label.classList.add('iso-value-label');
    if(!document.getElementById('isoStepDown')){
      var minus=document.createElement('button');minus.type='button';minus.id='isoStepDown';minus.className='iso-step-btn iso-step-hidden';minus.textContent='−';minus.setAttribute('aria-label','Lower ISO one step');
      g.insertBefore(minus,label||g.firstChild);
    }
    if(!document.getElementById('isoStepUp')){
      var plus=document.createElement('button');plus.type='button';plus.id='isoStepUp';plus.className='iso-step-btn iso-step-hidden';plus.textContent='+';plus.setAttribute('aria-label','Raise ISO one step');
      if(label&&label.nextSibling)g.insertBefore(plus,label.nextSibling);else g.appendChild(plus);
    }
    if(!document.getElementById('isoAutoBtn')){
      var b=document.createElement('button');b.type='button';b.id='isoAutoBtn';b.className='iso-auto-btn';b.textContent='Manual';b.setAttribute('aria-label','Switch to manual ISO');b.setAttribute('aria-pressed','true');g.appendChild(b);
    }
    if(!document.getElementById('autoISOHint')){
      var h=document.createElement('div');h.id='autoISOHint';h.className='sub auto-iso-hint';g.appendChild(h);
    }
  }
  function styles(){
    if(document.getElementById('v443AutoISOStyle'))return;
    var s=document.createElement('style');s.id='v443AutoISOStyle';
    s.textContent='.auto-iso-group{display:grid!important;grid-template-columns:42px minmax(100px,150px) 42px 82px;align-items:end;gap:8px;width:max-content;max-width:100%;margin-bottom:10px}.auto-iso-group .iso-value-label{grid-column:2;margin:0!important;max-width:none!important}.auto-iso-group .iso-value-label input{width:100%;margin-top:4px}.iso-step-btn{grid-row:1;width:42px!important;min-width:42px;height:42px;padding:0!important;font-size:22px;font-weight:700;align-self:end}.iso-step-btn#isoStepDown{grid-column:1}.iso-step-btn#isoStepUp{grid-column:3}.iso-step-hidden{visibility:hidden;pointer-events:none}.iso-auto-btn{grid-column:4;grid-row:1;width:82px!important;min-width:82px;min-height:42px;padding:8px 8px!important;font-weight:750;letter-spacing:.2px;align-self:end}.iso-auto-btn.active{background:var(--accent);color:var(--accent-contrast);border-color:var(--accent)}.auto-iso-hint{grid-column:1/-1;margin-top:0}.auto-iso-group input[readonly]{background:var(--chipBg);font-weight:700}@media(max-width:380px){.auto-iso-group{grid-template-columns:36px minmax(88px,1fr) 36px 74px;gap:6px;width:100%}.iso-step-btn{width:36px!important;min-width:36px}.iso-auto-btn{width:74px!important;min-width:74px;padding-left:5px!important;padding-right:5px!important}}';
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
    if(b&&!b.dataset.v443){
      b.dataset.v443='1';
      b.addEventListener('click',function(){if(isFilm())return;autoOn=!autoOn;autoCtx=null;recalc();});
    }
    var minus=document.getElementById('isoStepDown'),plus=document.getElementById('isoStepUp');
    if(minus&&!minus.dataset.v443){minus.dataset.v443='1';minus.addEventListener('click',function(){stepManual(-1);});}
    if(plus&&!plus.dataset.v443){plus.dataset.v443='1';plus.addEventListener('click',function(){stepManual(1);});}
    var mode=document.getElementById('captureMode');
    if(mode&&!mode.dataset.v443){
      mode.dataset.v443='1';
      mode.addEventListener('change',function(){autoCtx=null;setTimeout(recalc,0);});
    }
    var reset=document.getElementById('gearReset');
    if(reset&&!reset.dataset.v443){
      reset.dataset.v443='1';
      reset.addEventListener('click',function(){autoOn=true;autoCtx=null;setTimeout(recalc,0);});
    }
    autoOn=true;autoCtx=null;recalc();
  });
})();