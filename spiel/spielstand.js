/* ============================================================
   SPIELSTAND — gemeinsam für Kampagnenkarte, alle Szenen und Sidequests.
   Der Zustand besteht aus:
     e = Energie (0–3)               f = Fortschritt (höchste geschaffte Szene, 0–6)
     s = erledigte Sidequests ("2.1" = Szene 2, Sidequest 1)
     c = gewählter Charakter (1 = kurze Haare, 2 = lange Haare; Auswahl in charakterwahl.html)
   Während des Spiels reist der Zustand in der Adresse (#e=3&f=2&s=1.1) mit — alle Seiten greifen nur über
   das Objekt `Spiel` darauf zu. Zusätzlich wird er bei jeder Änderung automatisch im Browser gesichert;
   über das Menü „Spielstand als Datei sichern“ lässt er sich herunterladen (siehe SPIELSTAND SICHERN unten).
   Die Startseite bietet den gesicherten Stand zum Weiterspielen an.
   ============================================================ */
var Spiel = (function(){
  var MAX = 3, SQ_PRO_SZENE = 3;
  var z = { e: MAX, f: 0, s: [], neu: 0, c: 1 };
  var SKRIPT = document.currentScript;                       // für Pfade: die Startseite lädt diese Datei aus spiel/
  var BASIS = SKRIPT ? SKRIPT.src.replace(/[^\/]*$/, '') : '';

  function laden(){                       // Zustand aus der Adresse lesen
    var h = new URLSearchParams(location.hash.replace(/^#/, ''));
    var e = parseInt(h.get('e'), 10), f = parseInt(h.get('f'), 10), n = parseInt(h.get('neu'), 10);
    z.c = charakter(h.get('c'));
    if (!isNaN(e)) z.e = Math.max(0, Math.min(MAX, e));
    if (!isNaN(f)) z.f = Math.max(0, f);
    if (!isNaN(n)) z.neu = n;
    z.s = (h.get('s') || '').split(',').filter(function(x){ return /^\d+\.\d+$/.test(x); });
  }
  function charakter(c){ return String(c) === '2' ? 2 : 1; }   // alles andere (auch alte Spielstände) = Charakter 1
  function params(extra, st){
    st = st || z;
    var p = new URLSearchParams();
    p.set('e', st.e); p.set('f', st.f); p.set('c', charakter(st.c));
    if (st.s.length) p.set('s', st.s.join(','));
    for (var k in (extra || {})) p.set(k, extra[k]);
    return p.toString();
  }
  function speichern(){                   // hält die Adresse aktuell (damit Neuladen nichts verliert)
    try { history.replaceState(null, '', '#' + params()); } catch (err) {}
    autoSichern();                        // und sichert den Stand still im Browser (siehe unten)
  }
  laden();

  /* ---- Energie: Hinweise kosten 1, eine Sidequest füllt wieder auf ---- */
  var api = {
    MAX: MAX, SQ_PRO_SZENE: SQ_PRO_SZENE,
    energie: function(){ return z.e; },
    energieAb: function(){ z.e = Math.max(0, z.e - 1); speichern(); aktualisieren(); },
    energieVoll: function(){ z.e = MAX; speichern(); aktualisieren(); },
    energiePlus: function(n){ z.e = Math.min(MAX, z.e + (n || 1)); speichern(); aktualisieren(); },

    /* ---- Fortschritt ---- */
    fortschritt: function(){ return z.f; },
    charakter: function(){ return z.c; },
    neu: function(){ return z.neu; },
    neuGesehen: function(){ z.neu = 0; speichern(); },   // die Karte hat die Freischalt-Animation gezeigt
    szeneFrei: function(n){ return n <= z.f + 1; },
    sidequestFrei: function(n){ return n <= z.f; },
    sidequestErledigt: function(id){ return z.s.indexOf(id) >= 0; },
    sidequestGeschafft: function(id){ if (z.s.indexOf(id) >= 0) return false; z.s.push(id); speichern(); return true; },

    /* ---- Adressen ---- */
    url: function(datei, extra){ return datei + '#' + params(extra); },
    zurKarte: function(szene){              // am Ende einer Szene
      var neu = szene > z.f;
      if (neu) z.f = szene;
      speichern();
      location.href = api.url('kampagnenkarte.html', neu ? { neu: szene } : {});
    }
  };

  /* ---- Anzeige: Gehirn mit Füllstand und drei Balken ---- */
  var zaehler = 0, anzeigen = [];
  function gehirn(el){
    var id = 'ec' + (++zaehler);
    el.className = (el.className ? el.className + ' ' : '') + 'energie';
    el.innerHTML =
      '<svg class="gehirn" viewBox="0 0 40 32" aria-hidden="true">' +
        '<defs><clipPath id="' + id + '"><rect class="pegel" x="0" y="0" width="40" height="32"/></clipPath></defs>' +
        '<g class="rand"><path d="M20,4 C14,1 7,3 6,9 C2,10 1,16 4,19 C2,23 5,28 10,28 C13,31 18,30 20,27 Z"/><path d="M20,4 C26,1 33,3 34,9 C38,10 39,16 36,19 C38,23 35,28 30,28 C27,31 22,30 20,27 Z"/></g>' +
        '<g clip-path="url(#' + id + ')" class="fuell"><path d="M20,4 C14,1 7,3 6,9 C2,10 1,16 4,19 C2,23 5,28 10,28 C13,31 18,30 20,27 Z"/><path d="M20,4 C26,1 33,3 34,9 C38,10 39,16 36,19 C38,23 35,28 30,28 C27,31 22,30 20,27 Z"/></g>' +
        '<path class="adern" d="M12,10 C14,12 14,15 11,16 M28,10 C26,12 26,15 29,16 M14,22 C16,20 18,21 18,23 M26,22 C24,20 22,21 22,23 M20,6 V26"/>' +
      '</svg><span class="e-pips"><i></i><i></i><i></i></span>';
    el.setAttribute('title', 'Energie: ' + z.e + ' von ' + MAX);
    var pegel = el.querySelector('.pegel'), pips = el.querySelectorAll('.e-pips i');
    function zeichnen(){
      var h = 32 * z.e / MAX;
      pegel.setAttribute('y', 32 - h); pegel.setAttribute('height', h);
      for (var i = 0; i < pips.length; i++) pips[i].className = i < z.e ? 'an' : '';
      el.setAttribute('title', 'Energie: ' + z.e + ' von ' + MAX);
    }
    zeichnen(); anzeigen.push(zeichnen);
  }
  function aktualisieren(){ anzeigen.forEach(function(f){ f(); }); }
  api.zeichneEnergie = function(el){ if (el) gehirn(el); };

  /* ---- Gemeinsames Aussehen (wird einmal eingefügt) ---- */
  var css = document.createElement('style');
  css.textContent =
    '.energie{display:inline-flex;align-items:center;gap:.4em;vertical-align:middle;}' +
    '.energie .gehirn{height:1.7em;width:auto;overflow:visible;}' +
    '.energie .rand path{fill:#0b1020;stroke:#8f7a3f;stroke-width:1.6;}' +
    '.energie .fuell path{fill:#9fe59f;opacity:.92;}' +
    '.energie .adern{fill:none;stroke:#8f7a3f;stroke-width:1.1;stroke-linecap:round;}' +
    '.energie .e-pips{display:inline-flex;gap:.2em;}' +
    '.energie .e-pips i{display:block;width:.45em;height:1em;border:1px solid #8f7a3f;border-radius:.15em;background:transparent;}' +
    '.energie .e-pips i.an{background:#9fe59f;border-color:#9fe59f;}' +
    '#energie-info{color:#f0c27a;border-left:3px solid #e0735f;padding-left:.8em;line-height:1.45;}';
  document.head.appendChild(css);

  /* ============================================================
     SPIELSTAND SICHERN — über Sitzungen hinweg, ohne Server.
     Automatisch im Browser (localStorage → die Startseite bietet „Weiterspielen“ an): beim Öffnen jeder
     Spielseite und bei jeder Änderung (Energie, Sidequest, geschaffte Szene). Nur auf diesem Gerät und
     in diesem Browser. Auf Wunsch zusätzlich als heruntergeladene Datei (Menü; lässt sich auf jedem
     Gerät über die Startseite laden).
     Gesichert werden Ort (Szene oder Karte), Energie, Fortschritt, Sidequests und der gewählte Charakter.
     Weitergespielt wird am Anfang der gesicherten Szene.
     ============================================================ */
  var SCHLUESSEL = 'hbi-spielstand-a';

  function pruefen(st){                   // nur gültige Spielstände annehmen (auch aus fremden Dateien)
    if (!st || st.spiel !== 'HBI' || st.teil !== 'A') return null;
    if (!/^(szene_[a-z0-9_]+|kampagnenkarte)\.html$/.test(st.ort)) return null;
    var e = parseInt(st.e, 10), f = parseInt(st.f, 10);
    if (isNaN(e) || isNaN(f)) return null;
    return {
      spiel: 'HBI', teil: 'A', version: 1,
      gespeichert: String(st.gespeichert || ''),
      ort: st.ort, titel: String(st.titel || '').slice(0, 80),
      e: Math.max(0, Math.min(MAX, e)), f: Math.max(0, f), c: charakter(st.c),
      s: (Array.isArray(st.s) ? st.s : []).filter(function(x){ return /^\d+\.\d+$/.test(x); })
    };
  }
  function imBrowser(st){ try { localStorage.setItem(SCHLUESSEL, JSON.stringify(st)); return true; } catch (err) { return false; } }
  function zweistellig(n){ return (n < 10 ? '0' : '') + n; }
  function herunterladen(st){
    var d = new Date();
    var name = 'HBI-Spielstand_' + d.getFullYear() + '-' + zweistellig(d.getMonth() + 1) + '-' + zweistellig(d.getDate()) +
               '_' + zweistellig(d.getHours()) + zweistellig(d.getMinutes()) + '.json';
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(st, null, 2)], { type: 'application/json' }));
    a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    return name;
  }

  function standJetzt(){                  // der Stand hier und jetzt (Szene → deren Anfang, sonst die Karte)
    var datei = location.pathname.split('/').pop();
    var szene = /^szene_[a-z0-9_]+\.html$/.test(datei);
    return pruefen({
      spiel: 'HBI', teil: 'A', gespeichert: new Date().toISOString(),
      ort: szene ? datei : 'kampagnenkarte.html',
      titel: szene ? document.title.replace(/^HBI\s*—\s*/, '') : 'Kampagnenkarte',
      e: z.e, f: z.f, s: z.s, c: z.c
    });
  }
  // Automatisch: nur auf Spielseiten, die ihren Zustand in der Adresse tragen.
  // Nicht auf der Startseite und nicht auf einer ohne Zustand geöffneten Seite (z. B. charakterwahl.html) —
  // sonst würde ein bestehender Spielstand überschrieben, bevor das neue Spiel wirklich begonnen hat.
  var AUTO = !!(SKRIPT && !SKRIPT.hasAttribute('data-startseite') && location.hash.length > 1);
  function autoSichern(){ if (AUTO) imBrowser(standJetzt()); }

  // Menü „Spielstand als Datei sichern“: lädt den Stand als Datei herunter (und sichert ihn auch im Browser)
  api.sichern = function(){
    var st = standJetzt();
    return { imBrowser: imBrowser(st), datei: herunterladen(st) };
  };
  // Startseite: zuletzt im Browser gesicherter Stand (oder null)
  api.gesichert = function(){
    try { return pruefen(JSON.parse(localStorage.getItem(SCHLUESSEL) || 'null')); } catch (err) { return null; }
  };
  // Startseite: Inhalt einer Spielstand-Datei prüfen und im Browser übernehmen (oder null)
  api.ausDatei = function(text){
    var st; try { st = pruefen(JSON.parse(text)); } catch (err) { return null; }
    if (st) imBrowser(st);
    return st;
  };
  api.adresseVon = function(st){ return BASIS + st.ort + '#' + params({}, st); };

  autoSichern();                          // beim Öffnen einer Spielseite: Stand sofort sichern

  // Menü oben links (Teil A) samt SQL-Spickzettel nachladen — nicht auf der Startseite
  if (SKRIPT && !SKRIPT.hasAttribute('data-startseite')) {
    ['spickzettel.js', 'menue.js'].forEach(function(d){
      var s = document.createElement('script');
      s.src = BASIS + d; s.charset = 'utf-8'; s.async = false;
      document.head.appendChild(s);
    });
  }

  return api;
})();
