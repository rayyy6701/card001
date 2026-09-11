/* Full-screen viewing and opt-in, device-local orientation controls. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const stage = $('stage'), card = $('card'), dialog = $('immersive');
  const slot = $('immersive-stage'), home = stage.parentNode;
  const marker = document.createComment('card-stage-home');
  home.insertBefore(marker, stage);
  let previousFocus, open = false, tap = null, down = null;
  let enabled = false, baseline = null, lastSample = null, timeout = 0, starting = false;
  const gyroButtons = [$('gyro'), $('immersive-gyro')];
  const tell = message => {
    $('motion-status').textContent = message;
    $('immersive-status').textContent = message;
  };
  function enter() {
    if (open) return;
    previousFocus = document.activeElement;
    open = true;
    slot.append(stage);
    document.body.classList.add('immersive-open');
    dialog.showModal();
    $('close-immersive').focus();
    window.dispatchEvent(new Event('resize'));
  }
  function leave() {
    if (!open) return;
    open = false;
    marker.parentNode.insertBefore(stage, marker.nextSibling);
    document.body.classList.remove('immersive-open');
    if (dialog.open) dialog.close();
    previousFocus?.focus({preventScroll:true});
    window.dispatchEvent(new Event('resize'));
  }
  $('expand').onclick = enter;
  $('close-immersive').onclick = leave;
  dialog.addEventListener('cancel', e => { e.preventDefault(); leave(); });
  dialog.addEventListener('close', leave);
  card.addEventListener('dblclick', e => { e.preventDefault(); if (!open) enter(); });
  card.addEventListener('pointerdown', e => { down = {id:e.pointerId,x:e.clientX,y:e.clientY,t:performance.now()}; });
  card.addEventListener('pointerup', e => {
    if (!down || down.id !== e.pointerId) return;
    const valid = performance.now()-down.t < 300 && Math.hypot(e.clientX-down.x,e.clientY-down.y)<12;
    down = null;
    if (!valid || e.pointerType==='mouse') { tap=null; return; }
    const now = performance.now();
    if (tap && now-tap.t<350 && Math.hypot(e.clientX-tap.x,e.clientY-tap.y)<30) {
      tap=null; if (!open) enter();
    } else tap={t:now,x:e.clientX,y:e.clientY};
  });
  card.addEventListener('pointercancel',()=>{down=null;tap=null;});
  function ui() {
    gyroButtons.forEach(b=>{b.setAttribute('aria-pressed',String(enabled));b.disabled=starting;b.textContent=enabled?'傾き操作をオフ':'スマホを傾けて操作';});
    $('calibrate').disabled=!enabled;
    $('immersive-calibrate').disabled=!enabled;
  }
  const wrap = angle => ((angle+180)%360+360)%360-180;
  function orientation(e) {
    if (!enabled || !Number.isFinite(e.beta) || !Number.isFinite(e.gamma)) return;
    clearTimeout(timeout);
    lastSample={beta:e.beta,gamma:e.gamma};
    if (!baseline) {baseline={...lastSample};tell('今の持ち方を中心にしました。ゆっくり傾けてみてください。');}
    if (document.hidden) return;
    const angle=(screen.orientation?.angle ?? window.orientation ?? 0)*Math.PI/180;
    const a=wrap(e.gamma-baseline.gamma),b=wrap(e.beta-baseline.beta);
    const dx=a*Math.cos(angle)+b*Math.sin(angle),dy=b*Math.cos(angle)-a*Math.sin(angle);
    window.holoControls?.tilt(Math.max(-22,Math.min(22,dy*.7)),Math.max(-30,Math.min(30,dx*.8)));
  }
  function stop(message='傾き操作をオフにしました。') {
    enabled=false;baseline=null;lastSample=null;clearTimeout(timeout);
    window.removeEventListener('deviceorientation',orientation);
    ui();tell(message);
  }
  async function toggle() {
    if (starting) return;
    if (enabled) {stop();return;}
    if (!window.isSecureContext) {tell('傾き操作はHTTPSで開いたサイトで使えます。指での操作はそのまま使えます。');return;}
    if (!window.DeviceOrientationEvent) {tell('この端末は傾き操作に対応していません。指でドラッグしてください。');return;}
    starting=true;ui();
    try {
      // Called directly by the tap gesture, as required by iOS.
      if (typeof DeviceOrientationEvent.requestPermission==='function') {
        const result=await DeviceOrientationEvent.requestPermission();
        if (result!=='granted') {tell('傾きセンサーへのアクセスが許可されませんでした。指での操作は使えます。');return;}
      }
      enabled=true;baseline=null;
      window.holoControls?.stopAuto();
      window.addEventListener('deviceorientation',orientation,{passive:true});
      tell('スマホを楽な角度で持ってください…');
      timeout=setTimeout(()=>stop('傾きの情報を受信できませんでした。対応端末のSafariやChromeで開き、センサーの設定を確認してください。'),5000);
    } catch(e) {tell('傾き操作を開始できませんでした。端末のセンサー許可を確認してください。');}
    finally {starting=false;ui();}
  }
  function calibrate() {if(!enabled)return;baseline=lastSample?{...lastSample}:null;window.holoControls?.tilt(0,0);tell('今の持ち方を中心にしました。');}
  gyroButtons.forEach(b=>b.onclick=toggle);
  $('calibrate').onclick=$('immersive-calibrate').onclick=calibrate;
  window.addEventListener('orientationchange',()=>{baseline=null;});
  screen.orientation?.addEventListener('change',()=>{baseline=null;});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)baseline=null;});
  window.addEventListener('pagehide',()=>{if(enabled)stop();});
  $('immersive-flip').onclick=()=>$('flip').click();
  $('immersive-reset').onclick=()=>$('reset').click();
  // The same canvas and handlers remain in use in both views.
  ui();
})();
