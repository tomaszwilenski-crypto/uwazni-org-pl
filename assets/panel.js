/* Panel panelisty: klient API, formularz zapisu (#regForm, 2 kroki) i strony konta. Wymaga assets/forms.js (CONFIG, IS_EN, tsRender). */
(function(){
'use strict';
var EN = IS_EN;
var PATHS = EN
  ? {home:'/en/', join:'/en/#join', login:'/en/login/', check:'/en/join/check-email/', account:'/en/account/', profile:'/en/account/profile/', settings:'/en/account/settings/', terms:'/en/panel-terms.html'}
  : {home:'/', join:'/#dolacz', login:'/zaloguj/', check:'/dolacz/sprawdz-poczte/', account:'/konto/', profile:'/konto/profil/', settings:'/konto/ustawienia/', terms:'/regulamin-panelu.html'};

var T = EN ? {
  err:{
    invalid_email:'Check the email address.', invalid_birth_year:'Choose your year of birth.', underage:'Only adults can join the panel.',
    invalid_interests:'Choose 3 to 5 topics.', consent_required:'Accept the panel terms and the privacy policy to continue.',
    turnstile_failed:'Verification failed. Try again.', turnstile_unconfigured:'Sign-up is temporarily unavailable. Try again later.',
    rate_limited:'Too many attempts. Try again in an hour.', origin_not_allowed:'This page is not allowed to talk to the server. Open uwazni.org.pl without www.',
    unauthorized:'Your session has ended. Log in again.', phone_in_use:'This phone number is already in use.',
    invalid_first_name:'Enter your first name (up to 60 characters).', invalid_last_name:'Enter your last name (up to 60 characters).',
    invalid_account:'Check the bank account number (26 digits).', invalid_gender:'Choose one of the options.', invalid_voivodeship:'Choose one of the options.',
    invalid_town_size:'Choose one of the options.', invalid_device:'Choose one of the options.', deletion_in_progress:'Account deletion is already in progress.',
    balance_changed:'Your balance changed while we were deleting the account. Try again.', network:'No connection to the server. Check your internet and try again.',
    generic:'Something went wrong. Try again in a moment.'
  },
  step:'Step {n} of {m}', next:'Next', back:'Back', skip:'Skip', saveNext:'Save and continue', saving:'Saving…', sending:'Sending…',
  join:'Join the panel', joinFail:'Could not sign you up.',
  needEmail:'Enter your email address.', needYear:'Choose your year of birth.', needTopics:'Choose 3 to 5 topics.', needConsent:'Accept the panel terms and the privacy policy.', needVerify:'Complete the verification first.',
  pts:'pts', zl:function(n){ return 'PLN ' + n.toFixed(2); }
} : {
  err:{
    invalid_email:'Sprawdź adres e-mail.', invalid_birth_year:'Wybierz rok urodzenia.', underage:'Panelistą może zostać tylko osoba pełnoletnia.',
    invalid_interests:'Wybierz od 3 do 5 tematów.', consent_required:'Zaznacz zgodę na regulamin i politykę prywatności.',
    turnstile_failed:'Weryfikacja nie powiodła się. Spróbuj ponownie.', turnstile_unconfigured:'Zapis jest chwilowo niedostępny. Spróbuj ponownie później.',
    rate_limited:'Zbyt wiele prób. Spróbuj ponownie za godzinę.', origin_not_allowed:'Ta strona nie może połączyć się z serwerem. Otwórz uwazni.org.pl bez www.',
    unauthorized:'Sesja wygasła. Zaloguj się ponownie.', phone_in_use:'Ten numer telefonu jest już używany.',
    invalid_first_name:'Wpisz imię (do 60 znaków).', invalid_last_name:'Wpisz nazwisko (do 60 znaków).',
    invalid_account:'Sprawdź numer rachunku (26 cyfr).', invalid_gender:'Wybierz jedną z opcji.', invalid_voivodeship:'Wybierz jedną z opcji.',
    invalid_town_size:'Wybierz jedną z opcji.', invalid_device:'Wybierz jedną z opcji.', deletion_in_progress:'Usuwanie konta już trwa.',
    balance_changed:'Saldo zmieniło się w trakcie usuwania konta. Spróbuj ponownie.', network:'Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.',
    generic:'Coś poszło nie tak. Spróbuj ponownie za chwilę.'
  },
  step:'Krok {n} z {m}', next:'Dalej', back:'Wstecz', skip:'Pomiń', saveNext:'Zapisz i dalej', saving:'Zapisuję…', sending:'Wysyłam…',
  join:'Dołącz do panelu', joinFail:'Nie udało się zapisać.',
  needEmail:'Wpisz adres e-mail.', needYear:'Wybierz rok urodzenia.', needTopics:'Wybierz od 3 do 5 tematów.', needConsent:'Zaznacz zgodę na regulamin i politykę prywatności.', needVerify:'Najpierw wykonaj weryfikację.',
  pts:'pkt', zl:function(n){ return n.toFixed(2).replace('.', ',') + ' zł'; }
};

/* ===== Klient API ===== */
function api(method, path, body){
  var opt = {method: method, credentials: 'include', headers: {}};
  if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
  return fetch(CONFIG.apiBase + path, opt).then(function(r){
    return r.text().then(function(t){
      var d = {}; try { d = t ? JSON.parse(t) : {}; } catch (e) {}
      return {ok: r.ok, status: r.status, data: d || {}, text: t};
    });
  }, function(){ return {ok: false, status: 0, data: {error: 'network'}, text: ''}; });
}
function errText(res){
  var c = res.data && res.data.error;
  if (res.status === 0) return T.err.network;
  return T.err[c] || T.err.generic;
}

/* ===== Pomocnicze ===== */
function $(id){ return document.getElementById(id); }
function h(tag, attrs){
  var e = document.createElement(tag);
  if (attrs) Object.keys(attrs).forEach(function(k){
    var v = attrs[k];
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v;
    else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, ''); else if (v !== false && v != null) e.setAttribute(k, v);
  });
  (function add(list){ list.forEach(function(c){ if (c == null || c === false) return; if (Array.isArray(c)) add(c); else e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }); })(Array.prototype.slice.call(arguments, 2));
  return e;
}
function say(el, cls, text){ if (!el) return; el.className = 'msg ' + cls; el.textContent = text; }
function store(k, v){ try { if (v === undefined) return JSON.parse(sessionStorage.getItem(k) || 'null'); if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} return null; }
function pl(n, one, few, many){ var a = n % 10, b = n % 100; return n === 1 ? one : (a >= 2 && a <= 4 && (b < 12 || b > 14)) ? few : many; }

/* Kod polecający z ?ref= (ukryte pole formularza, pamiętany w sessionStorage) */
function refCode(){
  var m = /[?&]ref=([A-Za-z0-9]{4,16})(?:&|#|$)/.exec(location.search);
  if (m) store('uwazni_ref', m[1].toUpperCase());
  return store('uwazni_ref');
}

/* ===== Powrót z linku w mailu: ?konto= / ?account= na stronie głównej ===== */
var RETURN = {
  'potwierdzone':'confirmed', 'zalogowano':'signed-in', 'potwierdzone-zaloguj':'confirmed-sign-in', 'link-nieaktywny':'link-expired',
  'confirmed':'confirmed', 'signed-in':'signed-in', 'confirmed-sign-in':'confirmed-sign-in', 'link-expired':'link-expired'
};
function returnKey(){
  var m = /[?&](?:konto|account)=([a-z-]+)/.exec(location.search);
  return m && RETURN[m[1]] ? RETURN[m[1]] : null;
}
function handleReturn(){
  var k = returnKey(); if (!k) return false;
  var to = (k === 'confirmed' || k === 'signed-in') ? PATHS.account : PATHS.login;
  location.replace(to + '?' + (EN ? 'account' : 'konto') + '=' + k);
  return true;
}

/* ===== Formularz zapisu #regForm (2 kroki) ===== */
function initSignup(){
  var f = $('regForm'); if (!f) return;
  var steps = f.querySelectorAll('.step'), cur = 1;
  var msg = f.querySelector('.msg');
  var ref = refCode(); if ($('pref') && ref) $('pref').value = ref;

  function fieldErr(step, text){
    var s = steps[step - 1], e = s.querySelector('.field-err');
    if (!e) { e = h('p', {class: 'field-err', role: 'alert'}); s.insertBefore(e, s.querySelector('.actions')); }
    e.textContent = text;
  }
  function clearErr(){ f.querySelectorAll('.field-err').forEach(function(e){ e.remove(); }); say(msg, 'hidden', ''); }
  function show(n){
    cur = n; clearErr();
    for (var i = 0; i < steps.length; i++) steps[i].classList.toggle('hidden', i !== n - 1);
    if (n === 2) tsRender(f);
    var first = steps[n - 1].querySelector('input:not([type=hidden]):not([tabindex="-1"]),select');
    if (first && n === 2) first.focus({preventScroll: true});
  }
  function topics(){ return Array.prototype.slice.call(f.querySelectorAll('#topics input[name=interest]')).filter(function(c){ return c.checked; }).map(function(c){ return c.value; }); }
  function step1Ok(){
    var email = $('pmail').value.trim();
    if (!email || !$('pmail').checkValidity()) { fieldErr(1, email ? T.err.invalid_email : T.needEmail); $('pmail').focus(); return false; }
    if (!$('pyear').value) { fieldErr(1, T.needYear); $('pyear').focus(); return false; }
    return true;
  }
  f.querySelector('[data-next]').addEventListener('click', function(){ clearErr(); if (step1Ok()) show(2); });
  f.querySelector('[data-back]').addEventListener('click', function(){ show(1); });
  // Enter w kroku 1 przechodzi dalej, nie wysyła formularza
  f.addEventListener('keydown', function(e){ if (e.key === 'Enter' && cur === 1 && e.target.tagName !== 'BUTTON') { e.preventDefault(); clearErr(); if (step1Ok()) show(2); } });

  f.addEventListener('submit', function(e){
    e.preventDefault();
    if (cur === 1) { clearErr(); if (step1Ok()) show(2); return; }
    clearErr();
    var btn = f.querySelector('button[type=submit]');
    var picked = topics();
    if (picked.length < 3 || picked.length > 5) { fieldErr(2, T.needTopics); return; }
    if (!$('zgodaP').checked) { fieldErr(2, T.needConsent); $('zgodaP').focus(); return; }
    var hp = $('pweb');
    if (hp && hp.value) { store('uwazni_pending', {email: $('pmail').value.trim().toLowerCase()}); location.href = PATHS.check; return; }  // spam: udajemy sukces, nic nie wysyłamy
    if (!f.dataset.tsToken) { fieldErr(2, T.needVerify); return; }
    var email = $('pmail').value.trim();
    var body = {
      email: email, birth_year: +$('pyear').value, interests: picked,
      consents: {terms: true, privacy: true, marketing: $('mktP').checked},
      lang: EN ? 'en' : 'pl', turnstile_token: f.dataset.tsToken
    };
    if ($('pgrp') && $('pgrp').value) body.group = $('pgrp').value;
    if ($('pref') && $('pref').value) body.ref = $('pref').value;
    btn.disabled = true; var label = btn.textContent; btn.textContent = T.sending;
    api('POST', '/register', body).then(function(res){
      if (res.status === 202) { store('uwazni_pending', {email: email.toLowerCase()}); location.href = PATHS.check; return; }
      btn.disabled = false; btn.textContent = label; tsReset(f);
      var m = errText(res);
      if (res.data.error === 'invalid_email' || res.data.error === 'invalid_birth_year' || res.data.error === 'underage') { show(1); fieldErr(1, m); }
      else fieldErr(2, m);
    });
  });
}

/* ===== Strony aplikacji ===== */
var PAGE = document.body ? document.body.dataset.page : '';
var app = function(){ return $('app'); };
function mount(){ var a = app(); a.textContent = ''; for (var i = 0; i < arguments.length; i++) if (arguments[i]) a.appendChild(arguments[i]); a.removeAttribute('aria-busy'); }
function linkBtn(href, text, cls){ return h('a', {class: 'btn ' + (cls || 'btn-line'), href: href, text: text}); }
function loadError(retry){
  mount(h('div', {class: 'card'}, h('p', {class: 'msg err', role: 'alert', text: T.err.network}), h('button', {type: 'button', class: 'btn btn-navy', text: EN ? 'Try again' : 'Spróbuj ponownie', onclick: retry})));
}
function toLogin(extra){ location.replace(PATHS.login + (extra || '')); }

/* /zaloguj, /login */
var LOGIN = EN ? {
  title:'Log in', lead:'Enter your email. We will send you a one-time link, so you do not need a password.', label:'Email address', ph:'you@example.com', send:'Send me the link',
  sent:'If this address has an account, the link is on its way. Open it in this same browser, the one you are using now.',
  n:{'confirmed-sign-in':'Your account is confirmed, but the link was opened in a different browser from the one you signed up in. Enter your email and we will send a login link. Open it in the same browser in which you request it.',
     'link-expired':'This link has expired or was already used. Enter your email and we will send a new one.',
     'confirmed':'Your account is confirmed. Log in to enter.'}
} : {
  title:'Zaloguj się', lead:'Podaj e-mail, a wyślemy Ci jednorazowy link. Nie potrzebujesz hasła.', label:'Adres e-mail', ph:'ty@przyklad.pl', send:'Wyślij link',
  sent:'Jeśli ten adres ma konto, link jest w drodze. Otwórz go w tej samej przeglądarce, z której teraz korzystasz.',
  n:{'confirmed-sign-in':'Konto jest potwierdzone, ale link otwarto w innej przeglądarce niż ta, w której się zapisałeś. Podaj e-mail, a wyślemy link do logowania. Otwórz go w tej samej przeglądarce, w której o niego poprosisz.',
     'link-expired':'Ten link wygasł albo został już użyty. Podaj e-mail, a wyślemy nowy.',
     'confirmed':'Konto jest potwierdzone. Zaloguj się, żeby wejść.'}
};
function pageLogin(){
  var k = returnKey();
  api('GET', '/me').then(function(res){
    if (res.ok) { location.replace(PATHS.account); return; }
    var msg = h('p', {class: 'msg hidden', role: 'status'});
    var inp = h('input', {id: 'lmail', type: 'email', autocomplete: 'email', required: true, placeholder: LOGIN.ph});
    var btn = h('button', {type: 'submit', class: 'btn btn-navy', text: LOGIN.send});
    var form = h('form', {novalidate: true, onsubmit: function(e){
      e.preventDefault();
      var email = inp.value.trim();
      if (!email || !inp.checkValidity()) { say(msg, 'err', email ? T.err.invalid_email : T.needEmail); return; }
      btn.disabled = true; btn.textContent = T.sending;
      api('POST', '/login', {email: email}).then(function(r){
        btn.disabled = false; btn.textContent = LOGIN.send;
        if (r.status === 202) { store('uwazni_pending', {email: email.toLowerCase()}); say(msg, 'ok', LOGIN.sent); } else say(msg, 'err', errText(r));
      });
    }}, h('label', {for: 'lmail', text: LOGIN.label}), inp, btn, msg);
    mount(h('h1', {text: LOGIN.title}), k && LOGIN.n[k] ? h('p', {class: 'notice', role: 'status', text: LOGIN.n[k]}) : null,
      h('p', {class: 'lead', text: LOGIN.lead}), h('div', {class: 'card'}, form),
      h('p', {class: 'small muted'}, EN ? 'No account yet? ' : 'Nie masz jeszcze konta? ', h('a', {href: PATHS.join, text: EN ? 'Join the panel' : 'Dołącz do panelu'})));
  });
}

/* /dolacz/sprawdz-poczte, /en/join/check-email */
var CHECK = EN ? {
  title:'Check your inbox', sent:'We sent a link to {e}. Click it to confirm your address and enter the panel.',
  same:'Open the link in the same browser you signed up in. If you open it elsewhere, we will confirm the account but you will have to log in again.',
  spam:'Nothing yet? Look in spam or promotions, and give it a minute.', resend:'Send the link again', wait:'You can resend in {s} s', resent:'Sent again. Check your inbox.',
  change:'Change email address', noemail:'Enter the address you signed up with and we will send the link again.', label:'Email address'
} : {
  title:'Sprawdź skrzynkę', sent:'Wysłaliśmy link na adres {e}. Kliknij go, żeby potwierdzić adres i wejść do panelu.',
  same:'Otwórz link w tej samej przeglądarce, w której się zapisałeś. Jeśli otworzysz go gdzie indziej, potwierdzimy konto, ale trzeba będzie zalogować się od nowa.',
  spam:'Nic nie przyszło? Zajrzyj do spamu lub folderu Oferty i poczekaj minutę.', resend:'Wyślij link ponownie', wait:'Ponowna wysyłka za {s} s', resent:'Wysłane ponownie. Sprawdź skrzynkę.',
  change:'Zmień adres e-mail', noemail:'Podaj adres, z którym się zapisałeś, a wyślemy link jeszcze raz.', label:'Adres e-mail'
};
function pageCheck(){
  var pend = store('uwazni_pending'), email = pend && pend.email;
  var msg = h('p', {class: 'msg hidden', role: 'status'});
  var inp = email ? null : h('input', {id: 'cmail', type: 'email', autocomplete: 'email', required: true});
  var btn = h('button', {type: 'button', class: 'btn btn-navy', text: CHECK.resend});
  var timer = null;
  function cooldown(s){
    clearInterval(timer); btn.disabled = true;
    function tick(){ if (s <= 0) { clearInterval(timer); btn.disabled = false; btn.textContent = CHECK.resend; } else { btn.textContent = CHECK.wait.replace('{s}', s); s--; } }
    tick(); timer = setInterval(tick, 1000);
  }
  btn.addEventListener('click', function(){
    var to = email || (inp && inp.value.trim());
    if (!to || (inp && !inp.checkValidity())) { say(msg, 'err', to ? T.err.invalid_email : T.needEmail); return; }
    btn.disabled = true; btn.textContent = T.sending;
    api('POST', '/login', {email: to}).then(function(r){
      if (r.status === 202) { if (!email) store('uwazni_pending', {email: to.toLowerCase()}); say(msg, 'ok', CHECK.resent); cooldown(60); }
      else { btn.disabled = false; btn.textContent = CHECK.resend; say(msg, 'err', errText(r)); }
    });
  });
  mount(
    h('h1', {text: CHECK.title}),
    email ? h('p', {class: 'lead'}, CHECK.sent.split('{e}')[0], h('b', {text: email}), CHECK.sent.split('{e}')[1] || '') : h('p', {class: 'lead', text: CHECK.noemail}),
    h('div', {class: 'card soft'}, h('p', {text: CHECK.same}), h('p', {class: 'small muted', text: CHECK.spam})),
    h('div', {class: 'card'}, inp ? h('label', {for: 'cmail', text: CHECK.label}) : null, inp, btn, msg,
      h('a', {class: 'txtbtn', href: PATHS.join, onclick: function(){ store('uwazni_pending', null); }, text: CHECK.change}))
  );
}

/* Wspólne: pobranie /me z przekierowaniem na logowanie przy 401 */
function needMe(cb){
  api('GET', '/me').then(function(res){
    if (res.status === 401) { var k = returnKey(); toLogin(k ? '?' + (EN ? 'account' : 'konto') + '=' + (k === 'confirmed' ? 'confirmed-sign-in' : k) : ''); return; }
    if (!res.ok) { loadError(function(){ needMe(cb); }); return; }
    cb(res.data);
  });
}

/* /konto, /en/account */
var ACC = EN ? {
  title:'You are in the panel', hi:'Hi, {n}.', lead:'Your account is confirmed. We will email you when a task matching your profile appears.',
  profile:'Your profile', pct:'{p}% complete', fill:'Complete your profile', fillDone:'Edit profile', fillHint:'The fuller your profile, the better the tasks we can match to you.',
  sample:'Sample task', sampleTitle:'Read an article and answer three questions', sampleMeta:['About 4 min','Up to PLN 3'], sampleNote:'This is an example of what a task looks like.',
  pick:'Choose a task: coming soon', points:'Your points', rate:'100 pts = PLN 1.', terms:'Payout rules are in the panel terms.',
  ref:'Invite friends', refText:'For every person who signs up with your link and withdraws their first PLN 20, you get 300 pts (PLN 3).', copy:'Copy link', copied:'Copied',
  settings:'Settings and data', confirmed:'Account confirmed. Welcome to the panel.', signed:'You are logged in.'
} : {
  title:'Jesteś w panelu', hi:'Cześć, {n}.', lead:'Konto jest potwierdzone. Napiszemy do Ciebie, gdy pojawi się zadanie dopasowane do Twojego profilu.',
  profile:'Twój profil', pct:'Uzupełniony w {p}%', fill:'Uzupełnij profil', fillDone:'Edytuj profil', fillHint:'Im pełniejszy profil, tym lepiej dopasujemy zadania.',
  sample:'Przykładowe zadanie', sampleTitle:'Przeczytaj artykuł i odpowiedz na trzy pytania', sampleMeta:['Ok. 4 min','Do 3 zł'], sampleNote:'Tak będzie wyglądać zadanie. To tylko przykład.',
  pick:'Wybierz zadanie: wkrótce', points:'Twoje punkty', rate:'100 pkt = 1 zł.', terms:'Zasady wypłat znajdziesz w regulaminie.',
  ref:'Zaproś znajomych', refText:'Za każdą osobę, która zapisze się z Twojego linku i wypłaci swoje pierwsze 20 zł, dostajesz 300 pkt (3 zł).', copy:'Kopiuj link', copied:'Skopiowano',
  settings:'Ustawienia i dane', confirmed:'Konto potwierdzone. Witaj w panelu.', signed:'Jesteś zalogowany.'
};
function pageAccount(){
  var k = returnKey();
  needMe(function(me){
    var link = location.origin + PATHS.home + '?ref=' + encodeURIComponent(me.referral_code || '');
    var rin = h('input', {type: 'text', readonly: true, value: link, 'aria-label': ACC.ref});
    var cbtn = h('button', {type: 'button', class: 'btn btn-navy', text: ACC.copy, onclick: function(){
      var done = function(){ cbtn.textContent = ACC.copied; setTimeout(function(){ cbtn.textContent = ACC.copy; }, 2000); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(done, function(){ rin.select(); });
      else { rin.select(); try { document.execCommand('copy'); done(); } catch (e) {} }
    }});
    var pct = me.completion_pct || 0;
    var pts = me.balance_points || 0;
    mount(
      k === 'confirmed' ? h('p', {class: 'notice', role: 'status', text: ACC.confirmed}) : (k === 'signed-in' ? h('p', {class: 'notice', role: 'status', text: ACC.signed}) : null),
      h('h1', {text: ACC.title}),
      h('p', {class: 'lead', text: (me.first_name ? ACC.hi.replace('{n}', me.first_name) + ' ' : '') + ACC.lead}),
      h('div', {class: 'card', id: 'profilebar'}, h('h2', {text: ACC.profile}),
        h('div', {class: 'pbar'}, h('span', {text: ACC.pct.replace('{p}', pct)})),
        h('div', {class: 'progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct, 'aria-label': ACC.profile}, h('i', {style: 'width:' + pct + '%'})),
        h('p', {class: 'small muted', text: ACC.fillHint}),
        linkBtn(PATHS.profile, pct >= 100 ? ACC.fillDone : ACC.fill, pct >= 100 ? 'btn-line' : 'btn-red')),
      h('div', {class: 'sample', id: 'sampletask'}, h('span', {class: 'chip live', text: ACC.sample}), h('h2', {text: ACC.sampleTitle}),
        h('div', {class: 'meta'}, ACC.sampleMeta.map(function(m){ return h('span', {class: 'chip', text: m}); })),
        h('p', {class: 'small muted', text: ACC.sampleNote}),
        h('button', {type: 'button', class: 'btn btn-navy', disabled: true, text: ACC.pick})),
      h('div', {class: 'card', id: 'balance'}, h('h2', {text: ACC.points}),
        h('div', {class: 'stat'}, h('b', {id: 'ptsval', text: String(pts) + ' ' + T.pts}), h('span', {id: 'zlval', text: '= ' + T.zl(pts / 100)})),
        h('p', {class: 'small muted'}, ACC.rate + ' ', h('a', {href: PATHS.terms, text: ACC.terms}))),
      h('div', {class: 'card soft', id: 'referral'}, h('h2', {text: ACC.ref}), h('p', {text: ACC.refText}), h('div', {class: 'reflink'}, rin, cbtn)),
      h('p', {}, h('a', {href: PATHS.settings, text: ACC.settings}))
    );
  });
}

/* /konto/profil, /en/account/profile */
var OPT = EN ? {
  gender:{kobieta:'Woman', mezczyzna:'Man', inna:'Other', brak:'Prefer not to say'},
  voivodeship:{dolnoslaskie:'Lower Silesia', kujawsko_pomorskie:'Kuyavia-Pomerania', lubelskie:'Lublin', lubuskie:'Lubusz', lodzkie:'Łódź', malopolskie:'Lesser Poland', mazowieckie:'Masovia', opolskie:'Opole',
    podkarpackie:'Subcarpathia', podlaskie:'Podlaskie', pomorskie:'Pomerania', slaskie:'Silesia', swietokrzyskie:'Holy Cross', warminsko_mazurskie:'Warmia-Masuria', wielkopolskie:'Greater Poland', zachodniopomorskie:'West Pomerania'},
  town_size:{wies:'Village', do_20k:'Town up to 20,000', '20_100k':'20,000 to 100,000', '100_500k':'100,000 to 500,000', '500k_plus':'Over 500,000'},
  device:{smartfon_android:'Android phone', smartfon_ios:'iPhone', komputer:'Computer', tablet:'Tablet'}
} : {
  gender:{kobieta:'Kobieta', mezczyzna:'Mężczyzna', inna:'Inna', brak:'Wolę nie podawać'},
  voivodeship:{dolnoslaskie:'Dolnośląskie', kujawsko_pomorskie:'Kujawsko-pomorskie', lubelskie:'Lubelskie', lubuskie:'Lubuskie', lodzkie:'Łódzkie', malopolskie:'Małopolskie', mazowieckie:'Mazowieckie', opolskie:'Opolskie',
    podkarpackie:'Podkarpackie', podlaskie:'Podlaskie', pomorskie:'Pomorskie', slaskie:'Śląskie', swietokrzyskie:'Świętokrzyskie', warminsko_mazurskie:'Warmińsko-mazurskie', wielkopolskie:'Wielkopolskie', zachodniopomorskie:'Zachodniopomorskie'},
  town_size:{wies:'Wieś', do_20k:'Miasto do 20 tys.', '20_100k':'20 do 100 tys.', '100_500k':'100 do 500 tys.', '500k_plus':'Powyżej 500 tys.'},
  device:{smartfon_android:'Smartfon z Androidem', smartfon_ios:'iPhone', komputer:'Komputer', tablet:'Tablet'}
};
var PROF = EN ? {
  title:'Your profile', q:{gender:'Your gender', voivodeship:'Where do you live?', town_size:'How big is your town?', device:'What do you mostly browse on?', first_name:'What should we call you?'},
  nameLabel:'First name (optional)', done:'Your profile is complete', doneText:'Thank you. We will use it to match tasks to you.', bonus:'We added {n} pts to your balance.', toAccount:'Back to my account', saved:'Saved'
} : {
  title:'Twój profil', q:{gender:'Twoja płeć', voivodeship:'Gdzie mieszkasz?', town_size:'Jak duża jest Twoja miejscowość?', device:'Na czym najczęściej przeglądasz internet?', first_name:'Jak mamy się do Ciebie zwracać?'},
  nameLabel:'Imię (opcjonalnie)', done:'Profil uzupełniony', doneText:'Dziękujemy. Dzięki temu dopasujemy do Ciebie zadania.', bonus:'Dopisaliśmy {n} pkt do Twojego salda.', toAccount:'Wróć do konta', saved:'Zapisano'
};
var STEPS = ['gender', 'voivodeship', 'town_size', 'device', 'first_name'];
function pageProfile(){
  needMe(function(me){
    api('GET', '/me/profile').then(function(pr){
      if (pr.status === 401) { toLogin(); return; }
      if (!pr.ok) { loadError(pageProfile); return; }
      var profile = pr.data, name = me.first_name || '', pct = me.completion_pct || 0, bonus = 0;
      function filled(k){ return k === 'first_name' ? !!name : !!profile[k]; }
      var idx = 0; while (idx < STEPS.length && filled(STEPS[idx])) idx++;
      function render(){
        if (idx >= STEPS.length) {
          mount(h('h1', {text: PROF.done}), h('div', {class: 'card'}, h('p', {text: PROF.doneText}), bonus ? h('p', {class: 'msg ok', role: 'status', text: PROF.bonus.replace('{n}', bonus)}) : null,
            linkBtn(PATHS.account, PROF.toAccount, 'btn-navy')));
          return;
        }
        var key = STEPS[idx], msg = h('p', {class: 'msg hidden', role: 'status'}), form, getVal, field;
        if (key === 'first_name') {
          var inp = h('input', {id: 'pname', type: 'text', maxlength: 60, autocomplete: 'given-name', value: name});
          field = h('div', {class: 'stack', style: 'gap:8px'}, h('label', {for: 'pname', text: PROF.nameLabel}), inp);
          getVal = function(){ return inp.value.trim(); };
        } else {
          var opts = OPT[key], two = key === 'voivodeship' || key === 'gender';
          field = h('div', {class: 'choices' + (key === 'voivodeship' ? ' two' : '')});
          Object.keys(opts).forEach(function(v){
            field.appendChild(h('label', {class: 'choice'}, h('input', {type: 'radio', name: key, value: v, checked: profile[key] === v}), h('span', {text: opts[v]})));
          });
          getVal = function(){ var c = form.querySelector('input[name=' + key + ']:checked'); return c ? c.value : ''; };
        }
        var save = h('button', {type: 'submit', class: 'btn btn-red', text: T.saveNext});
        var back = idx > 0 ? h('button', {type: 'button', class: 'btn btn-line', text: T.back, onclick: function(){ idx--; render(); }}) : null;
        var skip = h('button', {type: 'button', class: 'txtbtn', text: T.skip, onclick: function(){ idx++; render(); }});
        form = h('form', {novalidate: true, onsubmit: function(e){
          e.preventDefault();
          var v = getVal();
          if (!v) { say(msg, 'err', key === 'first_name' ? T.err.invalid_first_name : T.err.invalid_gender); return; }
          save.disabled = true; save.textContent = T.saving;
          var req = key === 'first_name' ? api('PUT', '/me', {first_name: v}) : api('PUT', '/me/profile', (function(o){ o[key] = v; return o; })({}));
          req.then(function(r){
            save.disabled = false; save.textContent = T.saveNext;
            if (r.status === 401) { toLogin(); return; }
            if (!r.ok) { say(msg, 'err', errText(r)); return; }
            if (key === 'first_name') { name = v; if (typeof r.data.completion_pct === 'number') pct = r.data.completion_pct; }
            else { profile[key] = v; if (typeof r.data.completion_pct === 'number') pct = r.data.completion_pct; if (r.data.bonus_awarded) bonus = 200; }
            idx++; render();
            var m = $('app').querySelector('[data-saved]'); if (m) m.textContent = PROF.saved;
          });
        }}, h('fieldset', {}, h('legend', {text: PROF.q[key]}), field), msg,
          h('div', {class: 'acts'}, back, save, h('span', {class: 'spacer'}), skip));
        mount(h('h1', {text: PROF.title}),
          h('div', {class: 'pbar'}, h('span', {text: T.step.replace('{n}', idx + 1).replace('{m}', STEPS.length)}), h('span', {'data-saved': true, role: 'status', text: ''})),
          h('div', {class: 'progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct, 'aria-label': PROF.title}, h('i', {style: 'width:' + pct + '%'})),
          h('div', {class: 'card'}, form));
        var first = form.querySelector('input'); if (first) first.focus({preventScroll: true});
      }
      render();
    });
  });
}

/* /konto/ustawienia, /en/account/settings */
var SET = EN ? {
  title:'Settings and data', consents:'Consents', terms:'Panel terms', privacy:'Privacy policy', granted:'accepted', version:'version', marketing:'I want to receive emails about bonuses and panel news.',
  required:'Required for the account. Withdrawing it means deleting the account (below).', saved:'Saved',
  data:'Your data', dataText:'Download everything we store about you as a JSON file.', download:'Download my data', downloading:'Preparing…',
  del:'Delete account', delText:'Deleting the account is permanent. We remove your profile and personal data.', delBtn:'Delete my account…', sure:'I understand that this cannot be undone.', delGo:'Delete account permanently', cancel:'Cancel',
  balTitle:'You still have points on your account', balText:'Your balance is {p} pts ({z}). Choose what to do with it.',
  payTitle:'Withdraw the balance', payText:'Enter the details for the final payout. We pay the whole balance out when the account is deleted.', fn:'First name', ln:'Last name', acc:'Bank account number (26 digits)', payGo:'Withdraw and delete account',
  forfeitTitle:'Give up the balance', forfeitText:'I give up {z} and want to delete the account without a payout.', forfeitGo:'Give up the balance and delete account',
  deleted:'Your account has been deleted', deletedText:'Thank you for being with us. Your data was removed.', home:'Back to the home page', payout:'The final payout has been requested.'
} : {
  title:'Ustawienia i dane', consents:'Zgody', terms:'Regulamin panelu', privacy:'Polityka prywatności', granted:'zaakceptowano', version:'wersja', marketing:'Chcę dostawać e-mailem informacje o bonusach i nowościach w panelu.',
  required:'Wymagana do prowadzenia konta. Jej cofnięcie oznacza usunięcie konta (poniżej).', saved:'Zapisano',
  data:'Twoje dane', dataText:'Pobierz wszystko, co o Tobie przechowujemy, jako plik JSON.', download:'Pobierz moje dane', downloading:'Przygotowuję…',
  del:'Usunięcie konta', delText:'Usunięcia konta nie da się cofnąć. Usuwamy Twój profil i dane osobowe.', delBtn:'Usuń moje konto…', sure:'Rozumiem, że tego nie da się cofnąć.', delGo:'Usuń konto na stałe', cancel:'Anuluj',
  balTitle:'Masz jeszcze punkty na koncie', balText:'Saldo to {p} pkt ({z}). Wybierz, co z nim zrobić.',
  payTitle:'Wypłać saldo', payText:'Podaj dane do ostatniej wypłaty. Przy usunięciu konta wypłacamy całe saldo.', fn:'Imię', ln:'Nazwisko', acc:'Numer rachunku (26 cyfr)', payGo:'Wypłać i usuń konto',
  forfeitTitle:'Zrezygnuj z salda', forfeitText:'Rezygnuję z {z} i chcę usunąć konto bez wypłaty.', forfeitGo:'Zrezygnuj z salda i usuń konto',
  deleted:'Konto zostało usunięte', deletedText:'Dziękujemy, że byłeś z nami. Twoje dane usunęliśmy.', home:'Wróć na stronę główną', payout:'Zleciliśmy ostatnią wypłatę.'
};
function fmtDate(ms){ try { return new Date(ms).toLocaleDateString(EN ? 'en-GB' : 'pl-PL'); } catch (e) { return ''; } }
function pageSettings(){
  needMe(function(me){
    api('GET', '/me/consents').then(function(cr){
      if (cr.status === 401) { toLogin(); return; }
      if (!cr.ok) { loadError(pageSettings); return; }
      var cur = cr.data.current || {};
      function row(kind, label){ var c = cur[kind]; return h('div', {}, h('dt', {text: label}), h('dd', {text: c && c.granted ? SET.granted + ', ' + SET.version + ' ' + c.doc_version + ', ' + fmtDate(c.at) : '-'})); }
      var cmsg = h('p', {class: 'msg hidden', role: 'status'});
      var mk = h('input', {type: 'checkbox', id: 'mkt', checked: !!(cur.marketing && cur.marketing.granted), onchange: function(){
        mk.disabled = true;
        api('PUT', '/me/consents', {marketing: mk.checked}).then(function(r){
          mk.disabled = false;
          if (r.status === 401) { toLogin(); return; }
          if (r.ok) say(cmsg, 'ok', SET.saved); else { mk.checked = !mk.checked; say(cmsg, 'err', errText(r)); }
        });
      }});
      var dmsg = h('p', {class: 'msg hidden', role: 'status'});
      var dbtn = h('button', {type: 'button', class: 'btn btn-line', text: SET.download, onclick: function(){
        dbtn.disabled = true; dbtn.textContent = SET.downloading;
        api('GET', '/me/export').then(function(r){
          dbtn.disabled = false; dbtn.textContent = SET.download;
          if (r.status === 401) { toLogin(); return; }
          if (!r.ok) { say(dmsg, 'err', errText(r)); return; }
          var url = URL.createObjectURL(new Blob([r.text], {type: 'application/json'}));
          var a = h('a', {href: url, download: 'uwazni-moje-dane.json'}); document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
          say(dmsg, 'ok', SET.saved);
        });
      }});

      /* usunięcie konta */
      var zone = h('div', {class: 'stack', id: 'delzone'});
      var delMsg = h('p', {class: 'msg hidden', role: 'alert'});
      function finish(r, payout){
        store('uwazni_pending', null);
        mount(h('h1', {text: SET.deleted}), h('div', {class: 'card'}, h('p', {text: SET.deletedText}), payout ? h('p', {class: 'msg ok', text: SET.payout}) : null, linkBtn(PATHS.home, SET.home, 'btn-navy')));
      }
      function doDelete(body, onFail){
        api('DELETE', '/me', body).then(function(r){
          if (r.ok) { finish(r, !!r.data.payout_id); return; }
          if (r.status === 401) { toLogin(); return; }
          onFail(r);
        });
      }
      function showBalance(pts, zl){
        zone.textContent = '';
        var pmsg = h('p', {class: 'msg hidden', role: 'alert'}), fmsg = h('p', {class: 'msg hidden', role: 'alert'});
        var fn = h('input', {id: 'pfn', type: 'text', maxlength: 60, autocomplete: 'given-name', value: me.first_name || ''});
        var ln = h('input', {id: 'pln', type: 'text', maxlength: 60, autocomplete: 'family-name', value: me.last_name || ''});
        var ac = h('input', {id: 'pac', type: 'text', inputmode: 'numeric', autocomplete: 'off'});
        var pgo = h('button', {type: 'submit', class: 'btn btn-red', text: SET.payGo});
        var ok = h('input', {type: 'checkbox', id: 'forf'});
        var fgo = h('button', {type: 'button', class: 'btn btn-line', text: SET.forfeitGo, disabled: true, onclick: function(){
          fgo.disabled = true;
          doDelete({forfeit_balance: true}, function(r){ fgo.disabled = !ok.checked; say(fmsg, 'err', errText(r)); });
        }});
        ok.addEventListener('change', function(){ fgo.disabled = !ok.checked; });
        zone.appendChild(h('div', {class: 'card danger'}, h('h2', {text: SET.balTitle}), h('p', {text: SET.balText.replace('{p}', pts).replace('{z}', T.zl(zl))}),
          h('form', {novalidate: true, onsubmit: function(e){
            e.preventDefault();
            if (!fn.value.trim() || !ln.value.trim() || !ac.value.trim()) { say(pmsg, 'err', T.err.invalid_account); return; }
            pgo.disabled = true; pgo.textContent = T.saving;
            api('PUT', '/me', {first_name: fn.value.trim(), last_name: ln.value.trim(), account_number: ac.value.trim()}).then(function(r){
              if (r.status === 401) { toLogin(); return; }
              if (!r.ok) { pgo.disabled = false; pgo.textContent = SET.payGo; say(pmsg, 'err', errText(r)); return; }
              doDelete({}, function(r2){ pgo.disabled = false; pgo.textContent = SET.payGo; say(pmsg, 'err', errText(r2)); });
            });
          }}, h('h2', {text: SET.payTitle}), h('p', {class: 'small muted', text: SET.payText}),
            h('label', {for: 'pfn', text: SET.fn}), fn, h('label', {for: 'pln', text: SET.ln}), ln, h('label', {for: 'pac', text: SET.acc}), ac, pgo, pmsg)));
        zone.appendChild(h('div', {class: 'card'}, h('h2', {text: SET.forfeitTitle}),
          h('div', {class: 'consent'}, ok, h('label', {for: 'forf', text: SET.forfeitText.replace('{z}', T.zl(zl))})), fgo, fmsg));
      }
      var go = h('button', {type: 'button', class: 'btn btn-red', disabled: true, text: SET.delGo, onclick: function(){
        go.disabled = true;
        doDelete({}, function(r){
          go.disabled = false;
          if (r.status === 409 && r.data.error === 'balance_pending') showBalance(r.data.balance_points, r.data.balance_pln);
          else say(delMsg, 'err', errText(r));
        });
      }});
      var sure = h('input', {type: 'checkbox', id: 'sure', onchange: function(){ go.disabled = !sure.checked; }});
      var confirmBox = h('div', {class: 'stack hidden', id: 'delconfirm'}, h('div', {class: 'consent'}, sure, h('label', {for: 'sure', text: SET.sure})),
        h('div', {class: 'acts'}, go, h('button', {type: 'button', class: 'btn btn-line', text: SET.cancel, onclick: function(){ confirmBox.classList.add('hidden'); delBtn.classList.remove('hidden'); sure.checked = false; go.disabled = true; }})), delMsg);
      var delBtn = h('button', {type: 'button', class: 'btn btn-line', id: 'delstart', text: SET.delBtn, onclick: function(){ delBtn.classList.add('hidden'); confirmBox.classList.remove('hidden'); sure.focus(); }});

      mount(h('h1', {text: SET.title}),
        h('div', {class: 'card'}, h('h2', {text: SET.consents}),
          h('dl', {}, row('terms', SET.terms), row('privacy', SET.privacy)), h('p', {class: 'small muted', text: SET.required}),
          h('div', {class: 'consent'}, mk, h('label', {for: 'mkt', text: SET.marketing})), cmsg),
        h('div', {class: 'card'}, h('h2', {text: SET.data}), h('p', {text: SET.dataText}), dbtn, dmsg),
        h('div', {class: 'card danger'}, h('h2', {text: SET.del}), h('p', {text: SET.delText}), delBtn, confirmBox, zone),
        h('p', {}, h('a', {href: PATHS.account, text: EN ? 'Back to my account' : 'Wróć do konta'})));
    });
  });
}

/* ===== Start ===== */
document.addEventListener('DOMContentLoaded', function(){
  if (PAGE === 'login') pageLogin();
  else if (PAGE === 'check') pageCheck();
  else if (PAGE === 'account') pageAccount();
  else if (PAGE === 'profile') pageProfile();
  else if (PAGE === 'settings') pageSettings();
  else { if (handleReturn()) return; initSignup(); }
  document.querySelectorAll('nav.links a[data-nav]').forEach(function(a){ if (a.dataset.nav === PAGE) a.setAttribute('aria-current', 'page'); });
});
})();
