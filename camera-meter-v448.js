
/* Optional phone camera meter. No images are uploaded or retained. */
(function(){
  'use strict';
  var stream=null, capture=null, token=0, reading=null, measuring=false;
  var el=function(id){return document.getElementById(id);};
  var active=function(){return el('cameraMeterModal')?.style.display==='flex';};
  function msg(text,bad){var e=el('cameraMeterStatus');if(e){e.textContent=text;e.style.color=bad?'#b00020':'var(--muted)';}}
  function busy(b){measuring=b;var x=el('cameraMeterMeasure');if(x){x.disabled=b;x.textContent=b?'Measuring…':'Measure live';}}
  function clear(){reading=null;el('cameraMeterValue').textContent='EV —';el('cameraMeterMeta').textContent='';el('cameraMeterUse').disabled=true;}
  function stop(){
    ++token;
    if(stream){stream.getTracks().forEach(function(t){try{t.stop();}catch(_){};});}
    stream=null;capture=null;
    var v=el('cameraMeterVideo');if(v){try{v.pause();}catch(_){};v.srcObject=null;}
    busy(false);
  }
  function close(){if(el('cameraMeterModal'))el('cameraMeterModal').style.display='none';stop();}
  async function open(){
    el('cameraMeterModal').style.display='flex';clear();msg('Requesting camera access…');
    await start();
  }
  async function start(){
    stop();var current=token;
    if(!navigator.mediaDevices?.getUserMedia){msg('Camera preview is not available in this browser. Try Take meter photo instead.',true);return;}
    try{
      var media=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:960}},audio:false});
      if(!active()||current!==token){media.getTracks().forEach(function(t){t.stop();});return;}
      stream=media;
      var track=stream.getVideoTracks()[0];
      var video=el('cameraMeterVideo');video.srcObject=stream;video.muted=true;video.setAttribute('playsinline','');
      await video.play();
      if(typeof ImageCapture==='function'){try{capture=new ImageCapture(track);}catch(_){}}
      msg(capture?.takePhoto?'Aim at the scene, let the exposure settle, then tap Measure live.':'Preview is available, but this browser cannot read exposure from the live camera. Tap Take meter photo instead.');
    }catch(e){
      if(!active())return;
      if(e?.name==='NotAllowedError')msg('Camera access was denied. Enable camera permission, or use Take meter photo.',true);
      else msg('Camera preview is unavailable. You can still try Take meter photo.',true);
    }
  }
  function parseJpeg(arrayBuffer){
    var v=new DataView(arrayBuffer);
    if(v.byteLength<4||v.getUint16(0,false)!==0xFFD8)return null;
    var at=2;
    while(at+4<=v.byteLength){
      if(v.getUint8(at)!==255){at++;continue;}
      var mark=v.getUint16(at,false);at+=2;
      if(mark===0xFFDA||mark===0xFFD9)break;
      if(at+2>v.byteLength)break;
      var len=v.getUint16(at,false);
      if(len<2||at+len>v.byteLength)break;
      if(mark===0xFFE1&&len>=14){
        var exif='';for(var j=0;j<6;j++)exif+=String.fromCharCode(v.getUint8(at+2+j));
        if(exif==='Exif\x00\x00')return parseTiff(v,at+8);
      }
      at+=len;
    }
    return null;
  }
  function parseTiff(v,start){
    if(start+8>v.byteLength)return null;
    var mark=v.getUint16(start,false);
    if(mark!==0x4949&&mark!==0x4D4D)return null;
    var little=mark===0x4949;
    var U16=function(p){return v.getUint16(p,little);};
    var U32=function(p){return v.getUint32(p,little);};
    var I32=function(p){return v.getInt32(p,little);};
    if(U16(start+2)!==42)return null;
    var out={}, visited={};
    function read(rel,depth){
      if(depth>3||visited[rel])return;visited[rel]=1;
      var p=start+rel;if(p<start||p+2>v.byteLength)return;
      var count=U16(p);if(count>512)return;
      for(var i=0;i<count;i++){
        var q=p+2+i*12;if(q+12>v.byteLength)break;
        var tag=U16(q),type=U16(q+2),num=U32(q+4);
        var size=({1:1,2:1,3:2,4:4,5:8,7:1,9:4,10:8})[type]||0;
        if(!size||num===0||num>10000)continue;
        var bytes=size*num;
        var a=bytes<=4?q+8:start+U32(q+8);
        if(a<0||a+Math.min(bytes,8)>v.byteLength)continue;
        var value=null;
        if(type===3)value=U16(a);
        else if(type===4)value=U32(a);
        else if(type===9)value=I32(a);
        else if(type===5){var d=U32(a+4);value=d?U32(a)/d:null;}
        else if(type===10){var d2=I32(a+4);value=d2?I32(a)/d2:null;}
        if(tag===0x8769 && value!==null)read(value,depth+1);
        else if(tag===0x829A)out.t=value;
        else if(tag===0x829D)out.N=value;
        else if(tag===0x8827)out.iso=value;
        else if(tag===0x8832 && !out.iso)out.iso=value;
        else if(tag===0x9201)out.shutterAPEX=value;
        else if(tag===0x9202)out.apertureAPEX=value;
        else if(tag===0x9204)out.exposureBias=value;
        else if(tag===0x9209)out.flash=value;
      }
    }
    try{read(U32(start+4),0);}catch(e){return null;}
    if(!out.t&&Number.isFinite(out.shutterAPEX))out.t=Math.pow(2,-out.shutterAPEX);
    if(!out.N&&Number.isFinite(out.apertureAPEX))out.N=Math.pow(2,out.apertureAPEX/2);
    return out;
  }
  async function readPhoto(blob){
    if(!blob||blob.size<12)throw new Error('No photo was captured.');
    var head=await blob.slice(0,16).arrayBuffer(),v=new DataView(head);
    if(v.getUint16(0,false)!==0xFFD8)throw new Error('This photo format does not expose readable JPEG EXIF data here. Try a JPEG camera photo.');
    return parseJpeg(await blob.arrayBuffer());
  }
  function show(meta,origin){
    var N=Number(meta?.N),t=Number(meta?.t),iso=Number(meta?.iso);
    if(Number.isFinite(meta?.flash) && (meta.flash&1)){msg('Flash fired, so this cannot be treated as an ambient-light reading. Try again without flash.',true);return;}
    if(!(N>0&&t>0&&iso>0)){
      var available=[];if(N>0)available.push('f/'+N.toFixed(1));if(t>0)available.push('shutter available');if(iso>0)available.push('ISO '+Math.round(iso));
      el('cameraMeterMeta').textContent=available.length?'Partial camera metadata: '+available.join(' • '):'No usable exposure metadata was found.';
      msg('This camera/browser did not provide all three settings (aperture, shutter, ISO). The app cannot calculate a trustworthy EV from brightness alone. Try Take meter photo or use the scene slider.',true);
      return;
    }
    var bias=Number.isFinite(meta.exposureBias)?meta.exposureBias:0;
    var ev=Math.log2(N*N/t)-Math.log2(iso/100)+bias;
    if(!Number.isFinite(ev)){msg('The exposure data was invalid. Try another reading.',true);return;}
    reading={ev:ev,origin:origin};
    el('cameraMeterValue').textContent='EV '+ev.toFixed(1);
    var shutter=t>=1?t.toFixed(2)+' s':'1/'+Math.round(1/t)+' s';
    el('cameraMeterMeta').textContent=origin+': f/'+N.toFixed(1)+' • '+shutter+' • ISO '+Math.round(iso)+(bias?(' • compensation '+(bias>0?'+':'')+bias.toFixed(1)):'')+' • EV100';
    el('cameraMeterUse').disabled=false;
    msg('Reading ready. Tap Use reading to update the slider and recommended settings.');
  }
  async function measure(){
    if(measuring)return;
    if(!capture?.takePhoto){msg('Live exposure metadata is not supported in this browser. Try Take meter photo instead.',true);return;}
    busy(true);clear();msg('Measuring phone camera exposure…');
    try{
      var photo=await capture.takePhoto();
      var meta=await readPhoto(photo);
      if(!active())return;
      show(meta,'Live camera');
    }catch(e){
      if(active())msg('Could not extract exposure settings from the live camera. Try Take meter photo instead.',true);
    }finally{busy(false);}
  }
  async function fileChanged(){
    var input=el('cameraMeterFile'), file=input?.files?.[0];
    if(!file)return;
    clear();msg('Reading exposure data from the photo…');
    try{
      var meta=await readPhoto(file);
      if(active())show(meta,'Camera photo');
    }catch(e){if(active())msg(e.message||'Unable to read this photo’s exposure data.',true);}
    finally{input.value='';}
  }
  function takePhoto(){
    stop();msg('Take a photo of the scene. The photo remains on your phone and is not uploaded.');
    var input=el('cameraMeterFile');if(input)input.click();
  }
  function apply(){
    if(!reading)return;
    var ev=Math.max(-4,Math.min(16,reading.ev));
    if(typeof exposureMeterSource!=='undefined')exposureMeterSource='scene';
    window.__phoneMeterApplying=true;
    window.__phoneMeterEV=ev;
    try{
      if(typeof window.setEvControlValue==='function')window.setEvControlValue(ev,'api');
      else{
        var s=el('evSlider');if(s){s.value=ev.toFixed(1);s.dispatchEvent(new Event('input',{bubbles:true}));}
      }
      if(typeof updateMeterSourceUI==='function')updateMeterSourceUI();
      if(typeof recalc==='function')recalc();
    }finally{window.__phoneMeterApplying=false;}
    close();
  }
  function bind(){
    el('cameraMeterOpen')?.addEventListener('click',open);
    el('cameraMeterClose')?.addEventListener('click',close);
    el('cameraMeterMeasure')?.addEventListener('click',measure);
    el('cameraMeterTakePhoto')?.addEventListener('click',takePhoto);
    el('cameraMeterFile')?.addEventListener('change',fileChanged);
    el('cameraMeterUse')?.addEventListener('click',apply);
    el('cameraMeterModal')?.addEventListener('click',function(e){if(e.target===this)close();});
    document.addEventListener('keydown',function(e){if(e.key==='Escape'&&active())close();});
    document.addEventListener('visibilitychange',function(){if(document.hidden&&active())stop();});
    window.addEventListener('pagehide',stop);
    var clearManual=function(){if(!window.__phoneMeterApplying){window.__phoneMeterEV=null;if(typeof updateMeterSourceUI==='function')updateMeterSourceUI();}};
    el('evCtrl')?.addEventListener('pointerdown',clearManual);
    el('evCtrl')?.addEventListener('keydown',clearManual);
    el('evInput')?.addEventListener('input',clearManual);
    el('luxInput')?.addEventListener('input',clearManual);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();