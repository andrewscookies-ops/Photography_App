(function(){
  'use strict';

  function byId(id){ return document.getElementById(id); }
  function num(id,fallback){
    var el=byId(id),v=el?parseFloat(el.value):NaN;
    return isFinite(v)?v:fallback;
  }
  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
  function parseShutterTextLocal(s){
    if(typeof window.parseShutterText==='function'){
      try{return window.parseShutterText(s);}catch(e){}
    }
    s=String(s||'').trim();
    if(/s$/i.test(s)){
      var sec=parseFloat(s);
      return sec>0?sec:NaN;
    }
    var m=s.match(/^1\/(\d+(?:\.\d+)?)$/);
    return m?1/parseFloat(m[1]):NaN;
  }
  function fmtShLocal(t){
    if(typeof window.fmtSh==='function'){
      try{return window.fmtSh(t);}catch(e){}
    }
    if(!(t>0))return '—';
    if(t>=1)return (Math.round(t*10)/10)+'s';
    return '1/'+Math.max(1,Math.round(1/t));
  }
  function currentRecommendation(){
    var txt=byId('output')?.textContent||'';
    var iso=parseInt((txt.match(/ISO\s+(\d+)/i)||[])[1],10);
    var N=parseFloat((txt.match(/f\/([0-9.]+)/i)||[])[1]);
    var sm=txt.match(/(?:^|•)\s*(\d+(?:\.\d+)?s|1\/\d+(?:\.\d+)?)/);
    var t=sm?parseShutterTextLocal(sm[1]):NaN;
    return {iso:iso,N:N,t:t,text:txt};
  }
  function selectedLens(){
    var name=byId('lensSelect')?.value||'';
    if(!name||name==='__custom__'||typeof window.findLensByName!=='function')return null;
    try{return window.findLensByName(name)||null;}catch(e){return null;}
  }
  function focalMm(){
    var l=selectedLens();
    if(l&&typeof window.focalValueForLens==='function'){
      try{
        var lf=window.focalValueForLens(l);
        if(isFinite(lf)&&lf>0)return lf;
      }catch(e){}
    }
    var f=parseFloat(byId('focalInput')?.value);
    return isFinite(f)&&f>0?f:null;
  }
  function currentFilmSafe(){
    if(typeof window.currentFilm!=='function')return null;
    try{return window.currentFilm()||null;}catch(e){return null;}
  }
  function captureMode(){
    if(typeof window.currentCaptureMode==='function'){
      try{return window.currentCaptureMode();}catch(e){}
    }
    return byId('captureMode')?.value||'general';
  }
  function setOutput(id,text,warning){
    var el=byId(id);if(!el)return;
    el.textContent=text;
    el.classList.toggle('mt-warning',!!warning);
  }
  function cocValue(){ return num('mtDofFormat',0.03); }

  function dofCalc(N,focal,distM,coc){
    var f=focal,s=distM*1000;
    if(!(N>0&&f>0&&s>f&&coc>0))return null;
    var H=(f*f)/(N*coc)+f;
    var near=(H*s)/(H+(s-f));
    var far=(H<=(s-f))?Infinity:(H*s)/(H-(s-f));
    return {
      H:H/1000,
      near:near/1000,
      far:far===Infinity?Infinity:far/1000,
      total:far===Infinity?Infinity:(far-near)/1000
    };
  }
  function fmtM(v){
    if(v===Infinity)return '∞';
    if(!(isFinite(v)))return '—';
    if(v<1)return Math.round(v*100)+' cm';
    return (v<10?v.toFixed(2):v.toFixed(1))+' m';
  }
  function updateDOF445(){
    var out=byId('dofOut');if(!out)return;
    var rec=currentRecommendation(),f=focalMm(),dist=num('mtDofDistance',3),coc=cocValue();
    if(!(f>0)){
      setOutput('dofOut','Enter a focal length under Gear to calculate depth of field.',true);return;
    }
    if(!(rec.N>0)){
      setOutput('dofOut','A current aperture recommendation is needed first.',true);return;
    }
    var d=dofCalc(rec.N,f,dist,coc);
    if(!d){setOutput('dofOut','Check the focus distance and format settings.',true);return;}
    var total=d.total===Infinity?'∞':fmtM(d.total);
    setOutput('dofOut','At '+Math.round(f)+'mm, f/'+rec.N.toFixed(1)+' and '+dist.toFixed(1)+' m focus: near '+fmtM(d.near)+' • far '+fmtM(d.far)+' • total '+total+' • hyperfocal '+fmtM(d.H)+'.',false);
  }

  function updateMotion445(){
    var out=byId('motOut');if(!out)return;
    var f=focalMm(),assumed=false;
    if(!(f>0)){f=50;assumed=true;}
    var speed=num('mtMotionSpeed',1.4),dist=num('mtMotionDistance',10),dir=byId('mtMotionDirection')?.value||'across';
    var factor=dir==='across'?1:(dir==='diagonal'?0.7:0.25);
    var omega=(speed/Math.max(dist,0.1))*factor;
    var blurMm=cocValue();
    var tFreeze=omega>1e-8?blurMm/(f*omega):1;
    tFreeze=clamp(tFreeze,1/32000,4);
    var tPan=clamp(tFreeze*8,1/4000,1);
    var rec=currentRecommendation();
    var compare='';
    if(rec.t>0){
      compare=rec.t<=tFreeze*1.05?' Current recommendation ('+fmtShLocal(rec.t)+') is at or faster than that freeze target.':' Current recommendation ('+fmtShLocal(rec.t)+') is slower, so subject blur is more likely unless you pan intentionally.';
    }
    var note=assumed?' Assuming 50mm because no focal length is entered.':'';
    setOutput('motOut','Approx. freeze target '+fmtShLocal(tFreeze)+' or faster • panning starting point about '+fmtShLocal(tPan)+'.'+compare+note,false);
  }

  function apertureBounds(){
    var l=selectedLens(),f=focalMm();
    if(!l||typeof window.lensApertureAtFocal!=='function')return null;
    try{return window.lensApertureAtFocal(l,f||window.focalValueForLens(l));}catch(e){return null;}
  }
  function cameraFastest(){
    var name=byId('cameraSelect')?.value||'';
    if(!name||name==='__custom__'||typeof window.findCameraByName!=='function')return null;
    try{
      var c=window.findCameraByName(name);
      return c&&c.max_shutter_den?1/c.max_shutter_den:null;
    }catch(e){return null;}
  }
  function signed(v){return v>0?'+'+v.toFixed(v%1?1:0):v.toFixed(v%1?1:0);}
  function updateBracket445(){
    var rec=currentRecommendation();
    if(!(rec.t>0&&rec.N>0)){
      setOutput('brOut','A current exposure recommendation is needed first.',true);return;
    }
    var span=num('mtBracketSpan',1),step=num('mtBracketStep',1),param=byId('mtBracketParam')?.value||'shutter';
    var vals=[];
    for(var e=-span;e<=span+1e-9;e+=step)vals.push(parseFloat(e.toFixed(3)));
    var limits=false,ap=apertureBounds(),fast=cameraFastest();
    var parts=vals.map(function(ev){
      if(param==='aperture'){
        var N=rec.N/Math.pow(2,ev/2),bad=ap&&(N<ap.minA-1e-6||N>ap.maxA+1e-6);
        if(bad)limits=true;
        return signed(ev)+' EV: f/'+N.toFixed(1)+(bad?'*':'');
      }
      var t=rec.t*Math.pow(2,ev),bad=fast&&t<fast-1e-12;
      if(bad)limits=true;
      return signed(ev)+' EV: '+fmtShLocal(t)+(bad?'*':'');
    });
    var extra=limits?' *One or more frames exceed the selected gear limits.':'';
    setOutput('brOut',parts.length+' frames • '+parts.join(' • ')+extra,limits);
  }

  function updateReciprocity445(){
    var out=byId('recipOut');if(!out)return;
    var film=currentFilmSafe(),mode=captureMode();
    if(mode!=='film'&&!film){
      setOutput('recipOut','Reciprocity correction is a film-specific tool. Switch to Film and select a stock under Gear.',false);return;
    }
    if(!film){setOutput('recipOut','Select a film stock under Gear to use reciprocity correction.',true);return;}
    var manual=num('mtRecipSeconds',NaN),rec=currentRecommendation(),t=isFinite(manual)&&manual>0?manual:rec.t;
    if(!(t>0)){setOutput('recipOut','Enter the metered exposure time in seconds.',true);return;}
    if(t<1){setOutput('recipOut','At '+fmtShLocal(t)+', reciprocity correction is usually not needed in this app’s built-in data.',false);return;}
    var table=window.RECIP_TABLE||null,fn=table&&table[film.name];
    if(typeof fn!=='function'){
      setOutput('recipOut','No stock-specific reciprocity curve is stored for '+film.name+'. Check the film manufacturer’s current data for long exposures.',true);return;
    }
    var corr;
    try{corr=fn(t);}catch(e){corr=NaN;}
    if(!(corr>0)){setOutput('recipOut','Could not calculate reciprocity correction for this exposure.',true);return;}
    setOutput('recipOut','Metered '+fmtShLocal(t)+' → corrected ≈ '+fmtShLocal(corr)+'. Built-in reciprocity data is approximate; verify manufacturer data for critical work.',false);
  }

  function updatePushPull445(){
    var film=currentFilmSafe();
    if(!film){setOutput('ppOut','Select a film stock under Gear to plan push/pull processing.',true);return;}
    var stops=num('mtPushPullStops',0),box=Number(film.box_iso)||400;
    if(Math.abs(stops)<0.01){setOutput('ppOut','Shoot at box speed (ISO '+box+') and develop normally.',false);return;}
    var effective=Math.max(1,Math.round(box*Math.pow(2,stops)));
    var push=stops>0,limit=push?Number(film.push_limit||0):Number(film.pull_limit||0);
    var action=push?'push +'+stops:'pull '+Math.abs(stops);
    var instruction=push?'Rate the film faster (less exposure) and ask for longer development.':'Rate the film slower (more exposure) and ask for shorter development.';
    var warning='';
    if(limit>0&&Math.abs(stops)>limit)warning=' This is beyond the built-in '+(push?'push':'pull')+' limit for this stock.';
    else if(!(limit>0))warning=' No verified '+(push?'push':'pull')+' limit is stored for this stock; confirm with your lab/film data.';
    setOutput('ppOut',film.name+' at '+action+': meter around EI '+effective+'. '+instruction+warning,!!warning);
  }

  function updateAll(){
    updateDOF445();
    updateMotion445();
    updateBracket445();
    updateReciprocity445();
    updatePushPull445();
  }

  function detailsMarkup(){
    return ''+
      '<div class="section-header">More Tools</div>'+
      '<div class="sub mt-intro">Optional tools for specific situations. Open only what you need.</div>'+
      '<details id="mtIncident"><summary><span class="adv-chevron" aria-hidden="true">›</span><span class="summary-label">Incident Meter</span></summary><div class="mt-body"><div class="mt-help">Use a handheld incident meter reading instead of estimating the scene light.</div><div id="mtIncidentHost"></div></div></details>'+
      '<details id="mtDof"><summary><span class="adv-chevron" aria-hidden="true">›</span><span class="summary-label">Depth of Field</span></summary><div class="mt-body"><div class="mt-help">Uses the current recommended aperture plus focal length and focus distance.</div><div class="mt-grid"><label>Focus distance (m)<input id="mtDofDistance" type="number" min="0.1" step="0.1" value="3" inputmode="decimal"></label><label>Format / circle of confusion<select id="mtDofFormat"><option value="0.03" selected>35mm / full frame</option><option value="0.02">APS-C</option><option value="0.015">Micro Four Thirds</option></select></label></div><div id="dofOut" class="mt-output">—</div></div></details>'+
      '<details id="mtMotion"><summary><span class="adv-chevron" aria-hidden="true">›</span><span class="summary-label">Motion &amp; Panning</span></summary><div class="mt-body"><div class="mt-help">Estimates a shutter-speed target from subject speed, distance, direction and focal length.</div><div class="mt-grid"><label>Subject speed<select id="mtMotionSpeed"><option value="0.7">Slow walk</option><option value="1.4" selected>Walking</option><option value="3">Jogging</option><option value="5">Running</option><option value="8">Bicycle</option><option value="15">City car</option><option value="27">Highway car</option></select></label><label>Subject distance (m)<input id="mtMotionDistance" type="number" min="0.5" step="0.5" value="10" inputmode="decimal"></label><label>Direction<select id="mtMotionDirection"><option value="across" selected>Across the frame</option><option value="diagonal">Diagonal</option><option value="toward">Toward / away</option></select></label></div><div id="motOut" class="mt-output">—</div></div></details>'+
      '<details id="mtBracket"><summary><span class="adv-chevron" aria-hidden="true">›</span><span class="summary-label">Bracketing</span></summary><div class="mt-body"><div class="mt-help">Builds a bracket around the current recommendation. Positive EV is brighter; negative EV is darker.</div><div class="mt-grid"><label>Range<select id="mtBracketSpan"><option value="1" selected>±1 stop</option><option value="2">±2 stops</option><option value="3">±3 stops</option></select></label><label>Step<select id="mtBracketStep"><option value="0.333333">1/3 stop</option><option value="0.5">1/2 stop</option><option value="1" selected>1 stop</option></select></label><label>Change<select id="mtBracketParam"><option value="shutter" selected>Shutter speed</option><option value="aperture">Aperture</option></select></label></div><div id="brOut" class="mt-output">—</div></div></details>'+
      '<details id="mtReciprocity"><summary><span class="adv-chevron" aria-hidden="true">›</span><span class="summary-label">Long Exposure / Reciprocity</span></summary><div class="mt-body"><div class="mt-help">Film only. Leave the time blank to use the current recommended shutter, or enter a metered time yourself.</div><div class="mt-grid"><label>Metered seconds (optional)<input id="mtRecipSeconds" type="number" min="0.1" step="0.1" placeholder="Use current recommendation" inputmode="decimal"></label></div><div id="recipOut" class="mt-output">—</div></div></details>'+
      '<details id="mtPushPull"><summary><span class="adv-chevron" aria-hidden="true">›</span><span class="summary-label">Push / Pull Film</span></summary><div class="mt-body"><div class="mt-help">Film only. Shows the effective exposure index and lab-development direction.</div><div class="mt-grid"><label>Processing<select id="mtPushPullStops"><option value="-2">Pull 2 stops</option><option value="-1">Pull 1 stop</option><option value="0" selected>Normal</option><option value="1">Push 1 stop</option><option value="2">Push 2 stops</option><option value="3">Push 3 stops</option></select></label></div><div id="ppOut" class="mt-output">—</div></div></details>';
  }

  function install(){
    var drawer=byId('advancedDrawer'),oldBtn=byId('advancedToggle');
    if(!drawer||!oldBtn)return;

    // Replace the old button node to remove the legacy Advanced/More Tools click handlers.
    var btn=oldBtn.cloneNode(true);
    oldBtn.replaceWith(btn);
    btn.id='advancedToggle';
    btn.textContent='More Tools';
    btn.setAttribute('aria-expanded','false');
    btn.setAttribute('aria-controls','advancedDrawer');
    drawer.style.display='none';
    drawer.classList.add('more-tools-v445');
    drawer.innerHTML=detailsMarkup();

    btn.addEventListener('click',function(){
      var open=drawer.style.display!=='none';
      drawer.style.display=open?'none':'block';
      btn.textContent=open?'More Tools':'Close More Tools';
      btn.setAttribute('aria-expanded',String(!open));
      if(!open)updateAll();
    });

    // Put the existing, already-wired incident meter inside More Tools.
    var incident=byId('incidentDrawer'),host=byId('mtIncidentHost'),incidentToggle=byId('incidentToggle');
    if(incident&&host){
      incident.style.display='block';
      host.appendChild(incident);
    }
    if(incidentToggle)incidentToggle.style.display='none';

    drawer.querySelectorAll('input,select').forEach(function(el){
      el.addEventListener('input',updateAll);
      el.addEventListener('change',updateAll);
    });
    drawer.querySelectorAll('details').forEach(function(d){
      d.addEventListener('toggle',function(){if(d.open)updateAll();});
    });

    // Replace the legacy tool calculators, which depended on hidden defaults and full gear selections.
    window.updateDOF=updateDOF445;
    window.updateMotion=updateMotion445;
    window.updateBracket=updateBracket445;
    window.updateReciprocity=updateReciprocity445;
    window.updatePushPull=updatePushPull445;

    updateAll();
  }

  document.addEventListener('DOMContentLoaded',install);
})();