/* ===== Konfiguracja wdrożenia: uzupełnić przed publikacją ===== */
var CONFIG = {
  demo: false,                        // true = formularze symulują wysyłkę (podgląd lokalny)
  web3formsKey: '710eb010-e277-4c4c-98ab-de7fca9685ff',                   // klucz z web3forms.com (publiczny z założenia); puste = formularze pokażą adres e-mail
  gaId: '',                           // np. 'G-XXXXXXX'; puste = brak GA
  submitUrl: 'https://api.web3forms.com/submit',  // adres wysyłki formularzy (po przepięciu na własne API: adres Workera)
  turnstileSiteKey: '',               // klucz witryny Cloudflare Turnstile; puste = widget się nie renderuje
  endpoints: { lead: 'lead', sampleReport: 'sampleReport', register: 'register', support: 'support' },
  loginClient: '',                    // puste = link „Zaloguj” ukryty do czasu uruchomienia panelu
  loginPanelist: '',
  salesEmail: 'kontakt@uwazni.org.pl',
  supportEmail: 'pomoc@uwazni.org.pl'
};

/* ===== Google Consent Mode v2: domyślnie wszystko odrzucone ===== */
window.dataLayer = window.dataLayer || [];
function gtag(){ dataLayer.push(arguments); }
gtag('consent', 'default', {
  ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
  analytics_storage: 'denied', functionality_storage: 'granted', security_storage: 'granted',
  wait_for_update: 500
});

(function(){
  var KEY = 'uwazni_consent_v1';
  function read(){ try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch(e){ return null; } }
  function save(v){ try { localStorage.setItem(KEY, JSON.stringify(v)); } catch(e){} }

  var gaLoaded = false;
  function loadGA(){
    if (gaLoaded || !CONFIG.gaId) return;
    gaLoaded = true;
    var s = document.createElement('script');
    s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(CONFIG.gaId);
    document.head.appendChild(s);
    gtag('js', new Date()); gtag('config', CONFIG.gaId);
  }
  function apply(c){
    gtag('consent', 'update', {
      analytics_storage: c.analytics ? 'granted' : 'denied',
      ad_storage: c.marketing ? 'granted' : 'denied',
      ad_user_data: c.marketing ? 'granted' : 'denied',
      ad_personalization: c.marketing ? 'granted' : 'denied'
    });
    if (c.analytics) loadGA();
  }

  function banner(){ return document.getElementById('cookie'); }
  function show(settings){
    var b = banner(); if (!b) return;
    b.classList.remove('hidden');
    document.getElementById('cookieSettings').classList.toggle('hidden', !settings);
    var c = read() || {analytics:false, marketing:false};
    document.getElementById('ckAnalytics').checked = !!c.analytics;
    document.getElementById('ckMarketing').checked = !!c.marketing;
  }
  function decide(c){ c.date = new Date().toISOString(); save(c); apply(c); banner().classList.add('hidden'); }

  document.addEventListener('DOMContentLoaded', function(){
    var c = read();
    var optional = !!CONFIG.gaId;
    if (!optional) document.querySelectorAll('[data-cookie-settings]').forEach(function(el){ el.remove(); });
    if (c) apply(c); else if (optional) show(false);
    document.getElementById('ckAll').addEventListener('click', function(){ decide({analytics:true, marketing:true}); });
    document.getElementById('ckNone').addEventListener('click', function(){ decide({analytics:false, marketing:false}); });
    document.getElementById('ckMore').addEventListener('click', function(){ show(true); });
    document.getElementById('ckSave').addEventListener('click', function(){
      decide({analytics: document.getElementById('ckAnalytics').checked, marketing: document.getElementById('ckMarketing').checked});
    });
    document.querySelectorAll('[data-cookie-settings]').forEach(function(el){
      el.addEventListener('click', function(e){ e.preventDefault(); show(true); });
    });
    document.querySelectorAll('[data-email=sales]').forEach(function(el){ el.textContent = CONFIG.salesEmail; el.href = 'mailto:' + CONFIG.salesEmail; });
    document.querySelectorAll('[data-email=support]').forEach(function(el){ el.textContent = CONFIG.supportEmail; el.href = 'mailto:' + CONFIG.supportEmail; });
    document.querySelectorAll('[data-login]').forEach(function(el){ var u = el.dataset.login === 'client' ? CONFIG.loginClient : CONFIG.loginPanelist; if (u) el.href = u; else el.remove(); });
  });
})();

/* ===== Wysyłka formularzy: walidacja, honeypot, stany ===== */
function submitForm(form, endpoint, payload, okText, onOk){
  var msg = form.querySelector('.msg');
  var btn = form.querySelector('button[type=submit]');
  function say(cls, text){ msg.className = 'msg ' + cls; msg.textContent = text; }
  if (!form.checkValidity()) { form.reportValidity(); return; }
  var hp = form.querySelector('.hp input');
  if (hp && hp.value) { say('ok', okText); if (onOk) onOk(msg); return; }            // spam: udajemy sukces, nic nie wysyłamy
  if (CONFIG.turnstileSiteKey && !form.dataset.tsToken) { say('err', IS_EN ? 'Please complete the verification first.' : 'Najpierw wykonaj weryfikację.'); return; }
  btn.disabled = true;
  var done = function(){ btn.disabled = false; say('ok', okText); form.reset(); tsReset(form); if (onOk) onOk(msg); };
  var fail = function(){ btn.disabled = false; tsReset(form); say('err', (IS_EN ? 'Sending failed. Please try again or write to ' : 'Nie udało się wysłać. Spróbuj ponownie albo napisz na ') + CONFIG.salesEmail + '.'); };
  if (CONFIG.demo) { setTimeout(done, 600); return; }
  if (!CONFIG.web3formsKey) { fail(); return; }
  var SUBJ = {lead:'Zapytanie o badanie', sampleReport:'Prośba o wzór raportu', register:'Nowy panelista', support:'Pytanie od panelisty', publisher:'Ruch panelu: wiadomość od wydawcy', pilot:'Pilotaż dla wydawcy', raport:'Pobranie raportu B2B'};
  var body = {access_key: CONFIG.web3formsKey, subject: 'uwazni.org.pl' + (IS_EN ? ' [EN]' : '') + ': ' + (SUBJ[endpoint] || endpoint), from_name: 'uwazni.org.pl', strona: location.href};
  Object.keys(payload).forEach(function(k){ var v = payload[k]; body[k] = (v && typeof v === 'object') ? JSON.stringify(v) : v; });
  if (payload.email) body.replyto = payload.email;
  if (CONFIG.turnstileSiteKey) body['cf-turnstile-response'] = form.dataset.tsToken;
  fetch(CONFIG.submitUrl, {method:'POST', headers:{'Content-Type':'application/json', 'Accept':'application/json'}, body: JSON.stringify(body)})
    .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ if (r.ok && j.success !== false) done(); else fail(); }); })
    .catch(fail);
}


/* ===== Cloudflare Turnstile: widget renderuje się tylko, gdy CONFIG.turnstileSiteKey nie jest pusty ===== */
function tsReset(form){
  delete form.dataset.tsToken;
  if (window.turnstile && form._tsId != null) { try { window.turnstile.reset(form._tsId); } catch (e) {} }
}
window.uwazniTurnstileReady = function(){
  document.querySelectorAll('form').forEach(function(form){
    var btn = form.querySelector('button[type=submit]');
    if (!btn || !form.querySelector('.msg')) return;
    var slot = document.createElement('div'); slot.className = 'ts-slot';
    btn.parentNode.insertBefore(slot, btn);
    form._tsId = window.turnstile.render(slot, {
      sitekey: CONFIG.turnstileSiteKey, language: IS_EN ? 'en' : 'pl',
      callback: function(t){ form.dataset.tsToken = t; },
      'expired-callback': function(){ delete form.dataset.tsToken; },
      'error-callback': function(){ delete form.dataset.tsToken; }
    });
  });
};
document.addEventListener('DOMContentLoaded', function(){
  if (!CONFIG.turnstileSiteKey) return;
  var s = document.createElement('script');
  s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=uwazniTurnstileReady';
  s.async = true; s.defer = true; document.head.appendChild(s);
});

var IS_EN = document.documentElement.lang === 'en';
