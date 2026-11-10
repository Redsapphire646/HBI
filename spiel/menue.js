/* ============================================================
   MENÜ TEIL A — oben links auf Kampagnenkarte, allen Szenen und Sidequests.
   Wird von spielstand.js nachgeladen (zusammen mit spickzettel.js), die Seiten selbst
   müssen dafür nicht angepasst werden. Gleiche Einträge wie in Teil B, ohne Spielanleitung:
   Spielstand speichern · Neu starten · SQL-Spickzettel · Zum Startbildschirm
   ============================================================ */
(function(){
  var datei = location.pathname.split('/').pop();
  var aufKarte = datei === 'kampagnenkarte.html';
  var szene = /^szene_/.test(datei);

  /* ---- Aussehen: Knopf wie „Ton: an“, Liste und Spickzettel wie in Teil B ---- */
  var css = document.createElement('style');
  css.textContent =
    // Der Menüknopf belegt die Ecke oben links → Auftragszettel und Energieanzeige rücken etwas nach unten
    '#buehne > #auftrag, #buehne > #gehirn-hud{top:11%;}' +
    // In der SQL-Maske („Dein Hirn“) sind Menü- und Ton-Knopf ausgeblendet
    '#buehne:has(#terminal:not([hidden])) .a-menue, #buehne:has(#terminal:not([hidden])) #ton{display:none;}' +
    '.a-menue{position:absolute;top:3%;left:2%;z-index:9;font-family:Georgia,"Times New Roman",serif;}' +
    '.a-menue > button{font-family:inherit;font-size:max(11px,1cqw);background:rgba(10,15,36,.8);color:#d4af37;' +
      'border:1px solid #8f7a3f;padding:.4cqw .9cqw;cursor:pointer;}' +
    '.a-menue > button:hover,.a-menue > button:focus-visible{border-color:#d4af37;outline:none;box-shadow:0 0 12px rgba(212,175,55,.25);}' +
    '.a-menue ul{position:absolute;top:calc(100% + 6px);left:0;margin:0;padding:6px 0;list-style:none;min-width:230px;' +
      'background:#0b1020;border:1px solid #8f7a3f;box-shadow:0 8px 24px rgba(0,0,0,.5);}' +
    '.a-menue li button{width:100%;text-align:left;background:none;border:none;color:#eae6d8;padding:9px 16px;cursor:pointer;' +
      'font-family:inherit;font-size:.92rem;}' +
    '.a-menue li button:hover,.a-menue li button:focus-visible{background:rgba(212,175,55,.12);color:#d4af37;outline:none;}' +
    '.a-meldung{position:absolute;top:3%;left:50%;transform:translateX(-50%);z-index:11;max-width:60%;padding:10px 18px;' +
      'background:#0b1020;border:1px solid #d4af37;color:#eae6d8;font-family:Georgia,serif;font-size:max(12px,1.05cqw);' +
      'line-height:1.45;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,.5);}' +
    '.a-meldung b{color:#9fe59f;}' +
    '.a-spick{position:absolute;top:0;right:0;bottom:0;z-index:10;width:min(430px,48%);display:flex;flex-direction:column;' +
      'background:#0a0f24;border-left:1px solid #8f7a3f;box-shadow:-10px 0 30px rgba(0,0,0,.5);text-align:left;' +
      'font-family:Georgia,serif;color:#eae6d8;}' +
    '.a-spick header{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;' +
      'border-bottom:1px solid rgba(143,122,63,.5);color:#d4af37;letter-spacing:.15em;font-size:.85rem;}' +
    '.a-spick header button{background:none;border:1px solid #8f7a3f;color:#d4af37;cursor:pointer;padding:3px 10px;font-size:.9rem;}' +
    '.a-spick .inhalt{flex:1;overflow:auto;padding:6px 18px 24px;}' +
    '.a-spick .gruppe{margin:18px 0 8px;font-size:.7rem;letter-spacing:.25em;color:#8f7a3f;text-transform:uppercase;}' +
    '.a-spick .gruppe small{display:block;letter-spacing:0;text-transform:none;font-size:.78rem;color:#b9b6ad;font-style:italic;margin-top:3px;}' +
    '.a-spick .eintrag{margin-bottom:10px;padding:10px 12px;background:#efe6cf;color:#2b1d14;border-top:4px solid #b0463a;' +
      'box-shadow:0 3px 8px rgba(0,0,0,.4);font-size:.86rem;line-height:1.4;}' +
    '.a-spick .eintrag code{display:block;margin-bottom:4px;font-family:Consolas,"Courier New",monospace;font-weight:bold;font-size:.9rem;}' +
    '.a-spick .eintrag pre{margin:8px 0 0;padding:8px 10px;background:#0b1020;color:#9fe59f;' +
      'font-family:Consolas,"Courier New",monospace;font-size:.8rem;white-space:pre-wrap;word-break:break-word;}' +
    '.a-spick .eintrag .hinweis{margin-top:6px;font-size:.8rem;font-style:italic;color:#6b4a2a;}';
  document.head.appendChild(css);

  /* ---- Aufbau ---- */
  var buehne = document.getElementById('buehne') || document.body;
  var menue = document.createElement('div');
  menue.className = 'a-menue';
  menue.innerHTML =
    '<button type="button" aria-haspopup="true" aria-expanded="false">☰ Menü</button>' +
    '<ul hidden>' +
      (aufKarte ? '' : '<li><button type="button" data-aktion="karte">Zur Kampagnenkarte</button></li>') +
      '<li><button type="button" data-aktion="speichern">💾 Spielstand speichern</button></li>' +
      '<li><button type="button" data-aktion="neustart">Neu starten</button></li>' +
      '<li><button type="button" data-aktion="spick">📇 SQL-Spickzettel</button></li>' +
      '<li><button type="button" data-aktion="start">Zum Startbildschirm</button></li>' +
    '</ul>';
  var spick = document.createElement('aside');
  spick.className = 'a-spick'; spick.hidden = true;
  spick.setAttribute('role', 'dialog'); spick.setAttribute('aria-label', 'SQL-Spickzettel');
  spick.innerHTML = '<header><span>📇 SQL-SPICKZETTEL</span><button type="button" aria-label="Spickzettel schliessen">✕</button></header>' +
                    '<div class="inhalt"></div>';
  var meldung = document.createElement('div');
  meldung.className = 'a-meldung'; meldung.hidden = true; meldung.setAttribute('role', 'status');
  buehne.appendChild(menue); buehne.appendChild(spick); buehne.appendChild(meldung);

  var knopf = menue.firstChild, liste = menue.querySelector('ul');
  function zeigeMenue(offen){ liste.hidden = !offen; knopf.setAttribute('aria-expanded', String(offen)); }
  knopf.onclick = function(){ zeigeMenue(liste.hidden); };

  // Klicks und Tasten im Menü und im Spickzettel nicht an die Szene weitergeben
  // (sonst springt z. B. Enter auf dem Menüknopf zugleich im Dialog weiter)
  [menue, spick, meldung].forEach(function(el){
    el.addEventListener('click', function(e){ e.stopPropagation(); });
    el.addEventListener('keydown', function(e){ if (e.key !== 'Escape') e.stopPropagation(); });
  });
  document.addEventListener('click', function(){ zeigeMenue(false); });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape') { zeigeMenue(false); spick.hidden = true; } });

  /* ---- Spickzettel: dieselben Karten wie in Teil B, ohne Einordnung (die gehört zur Auswertung von Teil B) ---- */
  var inhalt = spick.querySelector('.inhalt');
  function el(tag, klasse, text){ var x = document.createElement(tag); if (klasse) x.className = klasse; if (text) x.textContent = text; return x; }
  (window.SPICKZETTEL || []).forEach(function(g){
    if (g.nurTeilB) return;                              // z. B. Hinweis zu den Medaillen von Teil B
    var kopf = el('div', 'gruppe', g.gruppe);
    if (g.hinweis) kopf.appendChild(el('small', '', g.hinweis));
    inhalt.appendChild(kopf);
    g.eintraege.forEach(function(e){
      var k = el('div', 'eintrag');
      k.appendChild(el('code', '', e.befehl));
      k.appendChild(el('div', '', e.text));
      k.appendChild(el('pre', '', e.beispiel));
      if (e.hinweis) k.appendChild(el('div', 'hinweis', e.hinweis));
      inhalt.appendChild(k);
    });
  });
  spick.querySelector('header button').onclick = function(){ spick.hidden = true; };

  /* ---- Aktionen ---- */
  var meldungTimer;
  function melde(html){
    meldung.innerHTML = html; meldung.hidden = false;
    clearTimeout(meldungTimer); meldungTimer = setTimeout(function(){ meldung.hidden = true; }, 7000);
  }
  var aktionen = {
    speichern: function(){
      var r = Spiel.sichern();
      melde('<b>✓ Spielstand gespeichert.</b><br>' +
        (r.imBrowser ? 'Auf diesem Gerät geht es beim nächsten Start von Teil A hier weiter. ' : '') +
        'Die Datei <b>' + r.datei + '</b> liegt in deinem Download-Ordner — damit kannst du auch auf einem anderen Gerät weiterspielen.');
    },
    neustart: function(){
      if (aufKarte) {
        if (confirm('Teil A ganz von vorne beginnen?\nNicht gespeicherter Fortschritt geht verloren.')) location.href = 'kampagnenkarte.html#c=' + Spiel.charakter();   // Fortschritt weg, gewählter Charakter bleibt
      } else if (confirm(szene ? 'Diese Szene von vorne beginnen?' : 'Von vorne beginnen?')) {
        location.reload();                // die Adresse trägt den Zustand → Szene startet neu, Energie bleibt
      }
    },
    karte: function(){ location.href = Spiel.url('kampagnenkarte.html'); },
    spick: function(){ spick.hidden = false; spick.querySelector('header button').focus(); },
    start: function(){ location.href = '../HBI.html'; }
  };
  liste.addEventListener('click', function(e){
    var b = e.target.closest('button[data-aktion]');
    if (!b) return;
    zeigeMenue(false);
    aktionen[b.getAttribute('data-aktion')]();
  });
})();
