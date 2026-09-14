from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')

# Make direct EV entry technically explicit: the app's exposure engine uses EV100.
s=s.replace('<label>Incident EV\n            <input id="incidentExactInput"', '<label>Incident EV (EV100)\n            <input id="incidentExactInput"', 1)
s=s.replace('<div class="sub">Or enter the exposure combination shown by your meter:</div>', '<div class="sub">If your meter does not report EV100, enter the exposure combination it shows instead:</div>', 1)

# Use scene-light source when the user deliberately matches the camera's reflected meter.
s=s.replace(
    "          ev = Math.max(-4, Math.min(16, ev));\n          if(typeof window.setEvControlValue==='function')",
    "          ev = Math.max(-4, Math.min(16, ev));\n          exposureMeterSource='scene'; updateMeterSourceUI();\n          if(typeof window.setEvControlValue==='function')",
    1
)
s=s.replace(
    "          var ev=13; // default EV\n          if(typeof window.setEvControlValue==='function')",
    "          var ev=13; // default EV\n          exposureMeterSource='scene'; updateMeterSourceUI();\n          if(typeof window.setEvControlValue==='function')",
    1
)

# Practical scene descriptions aligned monotonically with the app's approximate lux scale.
pat=re.compile(r'var EV_DESC = \{.*?\n\};',re.S)
new='''var EV_DESC = {
  "-4":"Starlight / very dark night",
  "-3":"Dark night outdoors",
  "-2":"Moonlit landscape",
  "-1":"Very dim candlelit scene",
  "0":"Candlelight / very dark room",
  "1":"Dark night street / very low light",
  "2":"Very dim interior",
  "3":"Dim interior",
  "4":"Dim home interior",
  "5":"Typical home interior",
  "6":"Bright home interior",
  "7":"Office / bright indoor light",
  "8":"Very bright indoor / stage light",
  "9":"Dusk / just after sunset",
  "10":"Heavy overcast / deep outdoor shade",
  "11":"Overcast daylight / shade",
  "12":"Open shade / bright overcast",
  "13":"Cloudy-bright daylight",
  "14":"Hazy or weak direct sun",
  "15":"Bright direct sun",
  "16":"Bright sun on snow or sand"
};'''
s,n=pat.subn(new,s,count=1)
if n!=1: raise SystemExit(f'EV_DESC replacement failed: {n}')

# Keep incident descriptions on the same brightness ladder.
pat2=re.compile(r'var INCIDENT_DESC = \{.*?\n\};',re.S)
new2='''var INCIDENT_DESC = {
  "-4":"Starlight-level illumination on subject",
  "-3":"Very dark night illumination on subject",
  "-2":"Moonlight on subject",
  "-1":"Very dim candlelight on subject",
  "0":"Candlelight on subject",
  "1":"Very low light on subject",
  "2":"Very dim indoor light on subject",
  "3":"Dim indoor light on subject",
  "4":"Dim home light on subject",
  "5":"Typical home light on subject",
  "6":"Bright home light on subject",
  "7":"Office / bright indoor light on subject",
  "8":"Very bright indoor / stage light on subject",
  "9":"Dusk-level light on subject",
  "10":"Heavy overcast / deep shade on subject",
  "11":"Overcast / shade light on subject",
  "12":"Open-shade light on subject",
  "13":"Cloudy-bright daylight on subject",
  "14":"Hazy direct sun on subject",
  "15":"Bright direct sun on subject",
  "16":"Very bright sun / snow-sand illumination"
};'''
s,n=pat2.subn(new2,s,count=1)
if n!=1: raise SystemExit(f'INCIDENT_DESC replacement failed: {n}')

# Patch version.
if 'Version 4.2.0 — September 2026' in s:
    s=s.replace('Version 4.2.0 — September 2026','Version 4.2.1 — September 2026',1)
elif 'Version 4.2.1 — September 2026' not in s:
    raise SystemExit('v4.2.0 version marker not found')

checks=[
    'Version 4.2.1 — September 2026',
    'Incident EV (EV100)',
    "exposureMeterSource='scene'; updateMeterSourceUI();",
    'Typical home interior',
    'Bright direct sun'
]
missing=[x for x in checks if x not in s]
if missing: raise SystemExit('Missing v4.2.1 checks: '+repr(missing))

p.write_text(s,encoding='utf-8')
print('v4.2.1 accuracy polish complete')
