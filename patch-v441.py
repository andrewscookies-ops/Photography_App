from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')

s=s.replace('Version 4.4.0 — September 2026','Version 4.4.1 — September 2026',1)

marker='<script src="auto-iso-v440.js?v=440"></script>'
insert=marker+'\n<script src="exposure-priority-v441.js?v=441"></script>'
if 'exposure-priority-v441.js' not in s:
    if marker not in s:
        raise SystemExit('Auto ISO script marker not found')
    s=s.replace(marker,insert,1)

p.write_text(s,encoding='utf-8')
