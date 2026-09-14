from pathlib import Path
import re

p = Path('index.html')
s = p.read_text(encoding='utf-8')


def sub_once(pattern, repl, label, flags=0):
    global s
    s, n = re.subn(pattern, repl, s, count=1, flags=flags)
    if n != 1:
        raise SystemExit(f'{label}: expected 1 replacement, got {n}')

# ---------- Light section styling ----------
sub_once(
    r"  \.ev-headline\{.*?\n  @media \(max-width: 480px\)\{#evDescLabel\{flex-basis:100%;min-width:0\}\}",
    r'''  .ev-headline{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .descriptor-tag{font-size:10px;font-weight:650;letter-spacing:.7px;text-transform:uppercase;color:var(--muted);border:1px solid var(--border);border-radius:999px;padding:4px 9px;background:var(--card)}
  #evDescLabel{
    flex:1 1 100%; font-weight:750; font-size:20px; color:var(--text);
    display:flex;align-items:center;min-height:54px;padding:8px 12px;
    border:1px solid var(--border);border-radius:10px;background:var(--card);
    line-height:1.25;
  }
  .meter-source-line{font-size:12px;color:var(--muted);margin-top:-4px}
  .meter-source-line.incident-active{color:var(--accent);font-weight:650}
  .incident-explain{font-size:13px;line-height:1.45;color:var(--text);padding:8px 10px;border:1px solid var(--border);border-radius:10px;background:var(--card)}
  .incident-entry{display:grid;grid-template-columns:minmax(120px,1fr) auto;gap:8px;align-items:end;margin-top:2px}
  .incident-entry label{margin:0}
  .incident-entry button{width:auto;white-space:nowrap}
  .meter-exposure-entry{display:grid;grid-template-columns:repeat(3,minmax(82px,1fr)) auto;gap:8px;align-items:end;margin-top:2px}
  .meter-exposure-entry label{margin:0}
  .meter-exposure-entry button{width:auto;white-space:nowrap}
  @media(max-width:640px){
    #evDescLabel{font-size:19px}
    .incident-entry,.meter-exposure-entry{grid-template-columns:1fr}
    .incident-entry button,.meter-exposure-entry button{width:100%}
  }''',
    'light descriptor styling',
    re.S
)

# ---------- Advanced styling ----------
sub_once(
    r"  /\* Highlight expandable section headers on hover \*/.*?\.info-inline\{margin:4px 0 6px 0;font-size:12px;color:var\(--muted\);font-style:italic;min-height:1em\}",
    r'''  /* Advanced tools: compact, obvious and touch-friendly */
  #advancedDrawer details{border-top:1px solid var(--border);margin:0}
  #advancedDrawer details:last-child{border-bottom:1px solid var(--border)}
  #advancedDrawer details > summary{
    list-style:none;display:flex;align-items:center;gap:10px;cursor:pointer;
    border-radius:8px;padding:12px 6px;min-height:48px;user-select:none;-webkit-user-select:none;
  }
  #advancedDrawer details > summary::-webkit-details-marker{display:none}
  #advancedDrawer details > summary::marker{display:none}
  #advancedDrawer details > summary:hover{background:var(--rowHover)}
  .adv-chevron{flex:0 0 18px;width:18px;display:inline-flex;justify-content:center;color:var(--muted);font-size:20px;line-height:1;transition:transform .15s ease}
  details[open] > summary .adv-chevron{transform:rotate(90deg)}
  .summary-label{flex:1 1 auto;font-weight:650}
  button.info-btn{width:28px !important;height:28px !important;padding:0 !important}
  .info-btn{flex:0 0 28px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;font-size:13px;font-weight:750;line-height:1;background:var(--btn-bg);color:var(--text);border:1px solid var(--border);pointer-events:auto}
  .info-btn:hover{background:var(--btn-bg-hover);border-color:var(--accent)}
  .info-inline{margin:0 8px 10px 34px;font-size:13px;line-height:1.45;color:var(--muted);min-height:0}
  .advanced-intro{margin:0 0 8px 0;line-height:1.45}''',
    'advanced styling',
    re.S
)

# ---------- Help copy ----------
s = s.replace(
    '<b>2. Meter the light:</b> Use the EV slider for ambient (reflected) light, or open the Incident Meter for direct subject light.<br>',
    '<b>2. Match the light:</b> Move the scene-light slider until the description matches what you see. If you have a handheld meter, you can enter its incident reading instead.<br>',
    1
)
s = s.replace(
    '<li>Tap <b>Calibrate to camera meter</b> to match your camera’s reading.</li>',
    '<li>The real-world light description is the easiest way to set scene brightness; EV is shown alongside it so you learn the relationship naturally.</li>\n        <li>Tap <b>Match camera meter</b> if you want the slider to match a reflected reading from your camera.</li>',
    1
)

# ---------- Replace Light Input card ----------
light_pattern = re.compile(r'''  <div class="card"><div class="section-header">Light Input</div>.*?\n  </div>\n\n  <div class="card" id="recommendedCard">''', re.S)
light_block = r'''  <div class="card" id="lightCard"><div class="section-header">Light in the Scene</div>
    <div class="sub" style="margin-bottom:8px;">
      Move the slider until the description best matches the light you are seeing. The EV number updates with it.
    </div>
    <div id="evCtrl" class="ev-control" role="slider"
      aria-label="Scene light exposure value" aria-valuemin="-4" aria-valuemax="16" aria-valuenow="13" tabindex="0">
      <div class="ev-track"></div>
      <div class="ev-ticks"></div>
      <div class="ev-handle"></div>
    </div>
    <input type="range" id="evSlider" min="-4" max="16" step="0.1" value="13"
      style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0" aria-hidden="true">

    <div id="evDescriptor" class="ev-descriptor">
      <div class="ev-headline">
        <span class="descriptor-tag">Scene light</span>
        <span id="evDescLabel">—</span>
      </div>
      <div id="meterSourceLine" class="meter-source-line">Using scene-light estimate for recommendations</div>
      <div class="ev-numeric">
        <label>EV<input type="number" id="evInput" value="13" step="0.1"></label>
        <label>≈ lux<input type="number" id="luxInput" value="20480"></label>
      </div>
      <div class="sub" style="margin-top:-6px">Lux is an approximate reference here; EV is the exposure value used by the app.</div>
      <div class="ambient-actions">
        <div class="ambient-buttons">
          <button id="calBtn" style="width:auto;padding:6px 9px">Match camera meter</button>
          <button id="incidentToggle" style="width:auto;padding:6px 9px;min-width:unset;" class="secondary" aria-label="Enter an incident meter reading">Use incident meter reading</button>
        </div>
      </div>

      <div id="incidentDrawer" style="display:none;" class="incident-wrap incident-compact">
        <div class="incident-explain">
          <strong>Incident light</strong> is the light falling on your subject. If you have a handheld light meter, enter its reading here and the app will use it instead of the scene-light estimate.
        </div>

        <div class="incident-entry">
          <label>Incident EV
            <input id="incidentExactInput" type="number" min="-4" max="20" step="0.1" inputmode="decimal" placeholder="e.g. 12.3">
          </label>
          <button type="button" id="incidentUseExact">Use EV</button>
        </div>

        <div class="sub">Or enter the exposure combination shown by your meter:</div>
        <div class="meter-exposure-entry">
          <label>Meter ISO<input id="incidentMeterISO" type="number" min="1" step="1" value="100"></label>
          <label>Aperture<input id="incidentMeterN" type="number" min="0.7" max="128" step="0.1" value="4"></label>
          <label>Shutter<input id="incidentMeterT" type="text" value="1/125" inputmode="text"></label>
          <button type="button" id="incidentUseExposure">Use meter exposure</button>
        </div>

        <div class="sub">No meter? You can also estimate subject light with the dial.</div>
        <div class="incident-dial-box">
          <div id="incidentDial" class="incident-dial" role="slider" aria-label="Incident EV estimate" aria-valuemin="-4" aria-valuemax="16" aria-valuenow="13" tabindex="0">
            <div class="incident-pointer" id="incidentPointer"></div>
            <div class="incident-center"></div>
          </div>
          <div class="incident-readouts">
            <div><span class="label">Incident EV</span><span class="value" id="incidentEvReadout">—</span></div>
            <div><span class="label">≈ Lux</span><span class="value" id="incidentLuxReadout">—</span></div>
            <button type="button" id="incidentClear">Use scene light instead</button>
          </div>
        </div>
        <input type="hidden" id="incidentEvInput">
        <input type="hidden" id="incidentLuxInput">
        <div class="incident-descriptor-group">
          <div class="incident-note" id="incidentNote">No incident reading is active.</div>
        </div>
      </div>
    </div>
  </div>

  <div class="card" id="recommendedCard">'''
s, n = light_pattern.subn(light_block, s, count=1)
if n != 1:
    raise SystemExit(f'Light card replacement failed: {n}')

# ---------- Replace Advanced UI ----------
adv_pattern = re.compile(r'''  <button id="advancedToggle">Open Advanced</button>\n  <div class="card" id="advancedDrawer" style="display:none;">.*?\n  </div>\n</div>\n<!-- Calibrate Modal -->''', re.S)
adv_block = r'''  <button id="advancedToggle">Open Advanced</button>
  <div class="card" id="advancedDrawer" style="display:none;">
    <div class="section-header">Advanced</div>
    <div class="sub advanced-intro">Optional tools for specific situations. Open only what you need; tap ? for a quick explanation.</div>

    <details>
      <summary><span class="adv-chevron" aria-hidden="true">›</span><span class="summary-label">Depth of Field</span><button type="button" class="info-btn" data-info="dof" aria-label="What is depth of field?">?</button></summary>
      <div class="info-inline" data-info-desc="dof"></div>
      <div id="dofOut">—</div>
    </details>
    <details>
      <summary><span class="adv-chevron" aria-hidden="true">›</span><span class="summary-label">Motion &amp; Panning</span><button type="button" class="info-btn" data-info="motion" aria-label="What are motion and panning settings?">?</button></summary>
      <div class="info-inline" data-info-desc="motion"></div>
      <div id="motOut">—</div>
    </details>
    <details>
      <summary><span class="adv-chevron" aria-hidden="true">›</span><span class="summary-label">Bracketing</span><button type="button" class="info-btn" data-info="bracket" aria-label="What is bracketing?">?</button></summary>
      <div class="info-inline" data-info-desc="bracket"></div>
      <div id="brOut">—</div>
    </details>
    <details>
      <summary><span class="adv-chevron" aria-hidden="true">›</span><span class="summary-label">Long Exposure (Reciprocity)</span><button type="button" class="info-btn" data-info="reciprocity" aria-label="What is reciprocity correction?">?</button></summary>
      <div class="info-inline" data-info-desc="reciprocity"></div>
      <div id="recipOut">—</div>
    </details>
    <details>
      <summary><span class="adv-chevron" aria-hidden="true">›</span><span class="summary-label">Push / Pull Film</span><button type="button" class="info-btn" data-info="pushpull" aria-label="What is push or pull film processing?">?</button></summary>
      <div class="info-inline" data-info-desc="pushpull"></div>
      <div id="ppOut">—</div>
    </details>
  </div>
</div>
<!-- Calibrate Modal -->'''
s, n = adv_pattern.subn(adv_block, s, count=1)
if n != 1:
    raise SystemExit(f'Advanced block replacement failed: {n}')

# ---------- Meter source logic: do not average reflected/scene and incident ----------
sub_once(
    r'''var ambientEvStored = 13;\nvar incidentEvStored = null;\nvar headerRecommendationObserver = null;\nfunction storeAmbientEV\(ev\)\{.*?\nfunction effectiveEV\(\)\{.*?\n\}''',
    r'''var ambientEvStored = 13;
var incidentEvStored = null;
var exposureMeterSource = 'scene';
var headerRecommendationObserver = null;
function storeAmbientEV(ev){
  ambientEvStored = Math.max(EV_MIN, Math.min(EV_MAX, parseFloat(ev)||ambientEvStored));
}
function ambientEV(){
  return Math.max(EV_MIN, Math.min(EV_MAX, parseFloat(document.getElementById('evInput')?.value)||ambientEvStored));
}
function incidentEV(){
  return isFinite(incidentEvStored)?incidentEvStored:null;
}
function effectiveEV(){
  var inc=incidentEV();
  if(exposureMeterSource==='incident' && inc!==null) return inc;
  return ambientEV();
}
function updateMeterSourceUI(){
  var line=document.getElementById('meterSourceLine');
  if(!line) return;
  var inc=incidentEV();
  var usingIncident=(exposureMeterSource==='incident' && inc!==null);
  line.textContent=usingIncident
    ? 'Using incident meter reading (EV '+inc.toFixed(1)+') for recommendations'
    : 'Using scene-light estimate for recommendations';
  line.classList.toggle('incident-active',usingIncident);
}''',
    'meter source logic',
    re.S
)

# ---------- More useful incident note ----------
sub_once(
    r'''function updateIncidentNote\(\)\{.*?\n\}''',
    r'''function updateIncidentNote(){
  var note=document.getElementById('incidentNote');
  if(!note) return;
  var inc=incidentEV();
  if(!(typeof inc === 'number' && isFinite(inc))){
    note.textContent='No incident reading is active. Recommendations are using the scene-light estimate.';
  }else{
    var desc = INCIDENT_DESC[String(Math.round(inc))] || ('Incident EV '+inc.toFixed(1));
    var diff = inc - ambientEV();
    var diffText = Math.abs(diff) < 0.05 ? 'Matches the scene estimate.' : ('Difference from scene estimate: '+(diff>0?'+':'')+diff.toFixed(1)+' stops.');
    note.textContent='Incident EV '+inc.toFixed(1)+' • '+desc+' • '+diffText;
  }
  updateMeterSourceUI();
}''',
    'incident note',
    re.S
)

# ---------- Incident set/clear switches source explicitly ----------
sub_once(
    r'''function setIncidentEV\(ev, opts\)\{.*?\n\}''',
    r'''function setIncidentEV(ev, opts){
  var evInput=document.getElementById('incidentEvInput');
  var luxInput=document.getElementById('incidentLuxInput');
  var exactInput=document.getElementById('incidentExactInput');
  if(ev===null || !isFinite(ev)){
    incidentEvStored = null;
    exposureMeterSource='scene';
    if(evInput) evInput.value='';
    if(luxInput) luxInput.value='';
    if(exactInput) exactInput.value='';
  }else{
    var clamped=Math.max(EV_MIN, Math.min(20, ev));
    incidentEvStored = clamped;
    exposureMeterSource='incident';
    if(evInput) evInput.value=clamped.toFixed(1);
    if(luxInput) luxInput.value=Math.round(evToLux(clamped));
    if(exactInput && document.activeElement!==exactInput) exactInput.value=clamped.toFixed(1);
  }
  updateIncidentDial(incidentEvStored);
  updateIncidentNote();
  updateMeterSourceUI();
  if(!opts || !opts.skipRecalc){ recalc(); }
}''',
    'setIncidentEV',
    re.S
)

# ---------- Exact incident meter entry ----------
anchor = 'function initIncidentDial(){'
if anchor not in s:
    raise SystemExit('initIncidentDial anchor missing')
incident_entry_js = r'''function initIncidentExactEntry(){
  var exact=document.getElementById('incidentExactInput');
  var useExact=document.getElementById('incidentUseExact');
  var iso=document.getElementById('incidentMeterISO');
  var n=document.getElementById('incidentMeterN');
  var t=document.getElementById('incidentMeterT');
  var useExposure=document.getElementById('incidentUseExposure');
  if(exact && exact.getAttribute('data-meter-init')!=='1'){
    exact.setAttribute('data-meter-init','1');
    exact.addEventListener('keydown',function(e){
      if(e.key==='Enter' && useExact){ useExact.click(); e.preventDefault(); }
    });
  }
  if(useExact && useExact.getAttribute('data-meter-init')!=='1'){
    useExact.setAttribute('data-meter-init','1');
    useExact.addEventListener('click',function(){
      var ev=parseFloat(exact?.value);
      if(!isFinite(ev)){ alert('Enter an incident EV, such as 12.3.'); return; }
      setIncidentEV(ev);
    });
  }
  if(useExposure && useExposure.getAttribute('data-meter-init')!=='1'){
    useExposure.setAttribute('data-meter-init','1');
    useExposure.addEventListener('click',function(){
      var ISO=Math.max(1,parseFloat(iso?.value)||100);
      var N=parseFloat(n?.value);
      var T=parseShutterText(t?.value);
      if(!(N>0) || !(T>0)){ alert('Enter a valid aperture and shutter, such as f/4 and 1/125.'); return; }
      var ev=evFromExposure(N,T,ISO);
      if(!isFinite(ev)){ alert('Could not calculate an EV from that meter reading.'); return; }
      setIncidentEV(ev);
    });
  }
}

'''
s = s.replace(anchor, incident_entry_js + anchor, 1)

# Ensure exact entry gets initialized.
s = s.replace(
    "function initIncidentDial(){\n  var dial=document.getElementById('incidentDial');",
    "function initIncidentDial(){\n  initIncidentExactEntry();\n  var dial=document.getElementById('incidentDial');",
    1
)

# ---------- Slider tooltip no longer reports a mathematical average ----------
sub_once(
    r'''      if\(inc===null\)\{\n        tip\.textContent   = 'Ambient EV '\+ev\.toFixed\(1\)\+' • '\+fmtLux\(ev\)\+' lx';\n      \}else\{\n        var eff=effectiveEV\(\);\n        tip\.textContent   = 'Ambient '\+ev\.toFixed\(1\)\+' / Incident '\+inc\.toFixed\(1\)\+' → Eff '\+eff\.toFixed\(1\)\+' • '\+fmtLux\(eff\)\+' lx';\n      \}''',
    r'''      if(exposureMeterSource==='incident' && inc!==null){
        tip.textContent='Scene EV '+ev.toFixed(1)+' • using incident EV '+inc.toFixed(1);
      }else{
        tip.textContent='Scene EV '+ev.toFixed(1)+' • ≈ '+fmtLux(ev)+' lx';
      }''',
    'EV tooltip source display'
)

# ---------- Scene descriptions: practical, monotonic brightness references ----------
sub_once(
    r'''var EV_DESC = \{.*?\n\};''',
    r'''var EV_DESC = {
  "-4":"Very dark night / faint starlight",
  "-3":"Dark night outdoors",
  "-2":"Moonlit night",
  "-1":"Very dim candlelit scene",
  "0":"Candlelight / very dim room",
  "1":"Dim night street",
  "2":"Dim indoor lighting",
  "3":"Typical home at night",
  "4":"Bright home interior",
  "5":"Very bright interior",
  "6":"Bright indoor / stage lighting",
  "7":"Bright window-lit room",
  "8":"Dusk / deep outdoor shade",
  "9":"Just after sunset / heavy overcast",
  "10":"Overcast daylight",
  "11":"Open shade / bright overcast",
  "12":"Bright open shade",
  "13":"Cloudy-bright / soft daylight",
  "14":"Hazy or weak direct sun",
  "15":"Bright direct sun",
  "16":"Bright sun on snow or sand"
};''',
    'EV descriptions',
    re.S
)
sub_once(
    r'''var INCIDENT_DESC = \{.*?\n\};''',
    r'''var INCIDENT_DESC = {
  "-4":"Extremely low subject illumination",
  "-3":"Very dark subject illumination",
  "-2":"Moonlight on subject",
  "-1":"Very dim candlelight on subject",
  "0":"Candlelight on subject",
  "1":"Very dim indoor light on subject",
  "2":"Dim indoor light on subject",
  "3":"Home interior light on subject",
  "4":"Bright home light on subject",
  "5":"Strong indoor light on subject",
  "6":"Bright interior / stage light on subject",
  "7":"Window light on subject",
  "8":"Dusk or deep shade on subject",
  "9":"Heavy overcast light on subject",
  "10":"Overcast daylight on subject",
  "11":"Open-shade light on subject",
  "12":"Bright shade on subject",
  "13":"Soft daylight on subject",
  "14":"Hazy direct sun on subject",
  "15":"Bright direct sun on subject",
  "16":"Very bright sun / snow-sand light"
};''',
    'incident descriptions',
    re.S
)

# Add an explicit aria value description while the scene description changes.
s = s.replace(
    "  lbl.textContent=desc;\n  var ambientNote=document.getElementById('reflectedNote');",
    "  lbl.textContent=desc;\n  var ctrl=document.getElementById('evCtrl'); if(ctrl){ ctrl.setAttribute('aria-valuetext', desc+', EV '+ev.toFixed(1)); }\n  var ambientNote=document.getElementById('reflectedNote');",
    1
)

# ---------- Advanced help text ----------
wire_anchor = 'function wireInfoButtons(){'
if wire_anchor not in s:
    raise SystemExit('wireInfoButtons anchor missing')
if 'window.INFO={' not in s:
    info = r'''window.INFO={
  dof:'Shows how much of the scene is expected to look acceptably sharp around the focus distance.',
  motion:'Shows whether the current exposure is better suited to freezing movement, showing motion blur, or panning.',
  bracket:'Shows a short set of exposures above and below the recommendation when you want extra exposure insurance.',
  reciprocity:'Film can need extra exposure time during long exposures. This shows the correction when the selected film has known reciprocity data.',
  pushpull:'Shows how rating film above or below box speed affects the push or pull processing you should request.'
};

'''
    s = s.replace(wire_anchor, info + wire_anchor, 1)

# ---------- Incident drawer button wording and ISO prefill ----------
s = s.replace("btn.textContent=open?'Close Incident Meter':'Open Incident Meter';", "btn.textContent=open?'Close incident meter':'Use incident meter reading';", 1)
s = s.replace(
    "      btn.addEventListener('click',function(){\n        drawer.style.display=(drawer.style.display==='none'||drawer.style.display==='')?'block':'none';\n        setLabel();\n      });",
    "      btn.addEventListener('click',function(){\n        drawer.style.display=(drawer.style.display==='none'||drawer.style.display==='')?'block':'none';\n        if(drawer.style.display==='block'){ var mi=document.getElementById('incidentMeterISO'); if(mi){ mi.value=String(getSelectedISO()||100); } }\n        setLabel();\n      });",
    1
)

# ---------- Version ----------
if 'Version 4.1.0 — September 2026' in s:
    s = s.replace('Version 4.1.0 — September 2026', 'Version 4.2.0 — September 2026', 1)
elif 'Version 4.2.0 — September 2026' not in s:
    raise SystemExit('Expected v4.1.0 version string not found')

# ---------- Sanity checks ----------
required = [
    'Version 4.2.0 — September 2026',
    'Light in the Scene',
    'Using scene-light estimate for recommendations',
    'incidentExactInput',
    'incidentUseExposure',
    "exposureMeterSource = 'scene'",
    "if(exposureMeterSource==='incident' && inc!==null) return inc;",
    'class="adv-chevron"',
    'data-info="dof"',
    'window.INFO={',
    'Bright direct sun',
]
missing = [x for x in required if x not in s]
if missing:
    raise SystemExit('Missing required v4.2.0 elements: ' + repr(missing))
if '(amb+inc)/2' in s:
    raise SystemExit('Old scene/incident averaging logic is still present')
if 'id="exposureTriangle"' in s:
    raise SystemExit('Old static exposure triangle is still present')

p.write_text(s, encoding='utf-8')
print('v4.2.0 patch complete')
