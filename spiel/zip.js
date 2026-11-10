/* ============================================================
   SPIEL FÜR DIE KLASSE — das ganze Spiel als ZIP, mit eigener Datenbank
   Ein Browser darf offline weder in Ordner schreiben noch Ordner lesen,
   ausser die Person wählt sie selbst aus. Darum wählt die Lehrperson
   einmal den Spielordner (<input webkitdirectory>); daraus entsteht eine
   ZIP mit allem, und die neue Datenbank liegt schon in daten/.

   SpielZip.ausOrdner(dateien, dateiText, tabelle)
     dateien   = FileList / Liste von File (mit webkitRelativePath)
     dateiText = Text der Spieldatei (Datensatz.alsDatei)
     tabelle   = Tabellenname der Datenbank. Gibt es im Ordner schon eine Datei mit derselben
                 Tabelle (daten/tiere.js oder eigene_datenbank_N.js), wird genau diese ersetzt —
                 so wird eine bestehende Datenbank aktualisiert statt doppelt angelegt.
     → Promise { fehler } oder { daten:Uint8Array, pfad, platz, ersetzt, anzahl }
       (ersetzt = true, wenn eine frühere Fassung überschrieben wurde; platz = null bei tiere.js)

   Eigener kleiner ZIP-Schreiber (ohne Kompression) — keine weitere Bibliothek.
   ============================================================ */
var SpielZip = (function(){
  var PLAETZE = 5;                                   // daten/eigene_datenbank_1.js … _5.js
  var WEGLASSEN = /(^|\/)(_rohmaterial|\.git)(\/|$)|\.zip$|(^|\/)(desktop\.ini|Thumbs\.db|\.DS_Store)$/i;

  /* ---------- ZIP schreiben (Methode „stored“, CRC-32) ---------- */
  var CRC = (function(){
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(b){ var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function utf8(t){ return new TextEncoder().encode(t); }

  /* Für jeden Ordner einen eigenen Eintrag („HBI/spiel/“) vor seinen Dateien. Python legt fehlende
     Ordner beim Entpacken selbst an, das Windows-Werkzeug (Expand-Archive) nicht — ohne diese
     Einträge bricht es mit „Ein Teil des Pfades konnte nicht gefunden werden“ ab. */
  function mitOrdnern(eintraege){
    var ordner = {};
    eintraege.forEach(function(e){
      var teile = e.pfad.split('/');
      for (var i = 1; i < teile.length; i++) ordner[teile.slice(0, i).join('/') + '/'] = true;
    });
    var alle = Object.keys(ordner).map(function(p){ return { pfad:p, daten:new Uint8Array(0), ordner:true }; }).concat(eintraege);
    return alle.sort(function(a, b){ return a.pfad < b.pfad ? -1 : a.pfad > b.pfad ? 1 : 0; });
  }

  function zip(dateien){                             // [{ pfad, daten:Uint8Array }]
    var eintraege = mitOrdnern(dateien);
    var jetzt = new Date();
    var zeit = (jetzt.getHours() << 11) | (jetzt.getMinutes() << 5) | (jetzt.getSeconds() >> 1);
    var datum = ((jetzt.getFullYear() - 1980) << 9) | ((jetzt.getMonth() + 1) << 5) | jetzt.getDate();
    var teile = [], verzeichnis = [], versatz = 0;
    eintraege.forEach(function(e){
      var name = utf8(e.pfad), crc = crc32(e.daten), n = e.daten.length;
      var lokal = new DataView(new ArrayBuffer(30));
      lokal.setUint32(0, 0x04034b50, true); lokal.setUint16(4, 20, true); lokal.setUint16(6, 0x0800, true);   // 0x0800 = Namen in UTF-8
      lokal.setUint16(8, 0, true); lokal.setUint16(10, zeit, true); lokal.setUint16(12, datum, true);
      lokal.setUint32(14, crc, true); lokal.setUint32(18, n, true); lokal.setUint32(22, n, true);
      lokal.setUint16(26, name.length, true); lokal.setUint16(28, 0, true);
      teile.push(new Uint8Array(lokal.buffer), name, e.daten);
      var z = new DataView(new ArrayBuffer(46));
      z.setUint32(0, 0x02014b50, true); z.setUint16(4, 20, true); z.setUint16(6, 20, true); z.setUint16(8, 0x0800, true);
      z.setUint16(10, 0, true); z.setUint16(12, zeit, true); z.setUint16(14, datum, true);
      z.setUint32(16, crc, true); z.setUint32(20, n, true); z.setUint32(24, n, true);
      z.setUint16(28, name.length, true); z.setUint32(42, versatz, true);
      if (e.ordner) z.setUint32(38, 0x10, true);     // MS-DOS-Attribut „Verzeichnis“
      verzeichnis.push(new Uint8Array(z.buffer), name);
      versatz += 30 + name.length + n;
    });
    var groesse = verzeichnis.reduce(function(s, t){ return s + t.length; }, 0);
    var ende = new DataView(new ArrayBuffer(22));
    ende.setUint32(0, 0x06054b50, true); ende.setUint16(8, eintraege.length, true); ende.setUint16(10, eintraege.length, true);
    ende.setUint32(12, groesse, true); ende.setUint32(16, versatz, true);
    var alles = teile.concat(verzeichnis, [new Uint8Array(ende.buffer)]);
    var ergebnis = new Uint8Array(alles.reduce(function(s, t){ return s + t.length; }, 0)), pos = 0;
    alles.forEach(function(t){ ergebnis.set(t, pos); pos += t.length; });
    return ergebnis;
  }

  /* ---------- Spielordner prüfen und zusammenstellen ---------- */
  function pfadVon(f){ return (f.webkitRelativePath || f.name).replace(/\\/g, '/'); }
  function lies(f){
    if (f.arrayBuffer) return f.arrayBuffer().then(function(b){ return new Uint8Array(b); });
    return new Promise(function(ok, nein){ var r = new FileReader(); r.onload = function(){ ok(new Uint8Array(r.result)); }; r.onerror = nein; r.readAsArrayBuffer(f); });
  }

  /* Wurzel des Spiels finden: der Ordner, in dem HBI.html und spiel/wer_bin_ich.html liegen.
     So klappt es auch, wenn jemand den Ordner darüber wählt. */
  function wurzel(pfade){
    var kandidaten = pfade.filter(function(p){ return /(^|\/)HBI\.html$/.test(p); })
      .map(function(p){ return p.slice(0, p.length - 'HBI.html'.length); })
      .filter(function(w){ return pfade.indexOf(w + 'spiel/wer_bin_ich.html') >= 0; })
      .sort(function(a, b){ return a.length - b.length; });
    return kandidaten.length ? kandidaten[0] : null;
  }

  function ausOrdner(dateien, dateiText, tabelle){
    var liste = Array.prototype.slice.call(dateien), pfade = liste.map(pfadVon);
    var w = wurzel(pfade);
    if (w === null) {
      var imSpiel = pfade.some(function(p){ return /(^|\/)wer_bin_ich\.html$/.test(p); });
      return Promise.resolve({ fehler: imSpiel
        ? 'Das ist der Unterordner „spiel“. Wähle den Ordner darüber — den, in dem HBI.html liegt.'
        : 'In diesem Ordner liegt das Spiel nicht. Wähle den Ordner, in dem HBI.html liegt (meist heisst er „HBI“).' });
    }
    var imSpiel = liste.filter(function(f, i){ var p = pfade[i]; return p.indexOf(w) === 0 && !WEGLASSEN.test(p.slice(w.length)); });
    var relativ = function(f){ return pfadVon(f).slice(w.length); };

    // Dieselbe Tabelle schon im Spiel? Dann diese Datei ersetzen (Aktualisierung) — sonst nächster freier Platz
    var kandidaten = imSpiel.filter(function(f){ return /^daten\/(tiere|arten|eigene_datenbank_\d+)\.js$/.test(relativ(f)); });
    return Promise.all(kandidaten.map(function(f){ return lies(f).then(function(b){ return { pfad:relativ(f), text:new TextDecoder().decode(b) }; }); }))
      .then(function(belegt){
        var neuerPfad = null, platz = null, ersetzt = false;
        belegt.forEach(function(b){
          var m = /"tabelle":\s*"([^"]+)"/.exec(b.text);
          if (m && m[1] === tabelle && !ersetzt) { neuerPfad = b.pfad; ersetzt = true; }
        });
        if (ersetzt) { var nr = /_(\d+)\.js$/.exec(neuerPfad); platz = nr ? Number(nr[1]) : null; }
        else for (var n = 1; n <= PLAETZE; n++) {
          if (!belegt.some(function(b){ return b.pfad === 'daten/eigene_datenbank_' + n + '.js'; })) { platz = n; neuerPfad = 'daten/eigene_datenbank_' + n + '.js'; break; }
        }
        if (neuerPfad === null) return { fehler: 'Im Spiel sind schon ' + PLAETZE + ' eigene Datenbanken. Wähle einen Spielordner mit weniger oder ein frisches Spiel.' };
        return Promise.all(imSpiel.filter(function(f){ return relativ(f) !== neuerPfad; })
          .map(function(f){ return lies(f).then(function(d){ return { pfad:'HBI/' + relativ(f), daten:d }; }); }))
          .then(function(eintraege){
            eintraege.push({ pfad:'HBI/' + neuerPfad, daten:utf8(dateiText) });
            return { daten:zip(eintraege), pfad:neuerPfad, platz:platz, ersetzt:ersetzt, anzahl:eintraege.length };
          });
      });
  }

  return { zip:zip, crc32:crc32, ausOrdner:ausOrdner, PLAETZE:PLAETZE };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = SpielZip;
