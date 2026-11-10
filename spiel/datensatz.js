/* ============================================================
   DATENSATZ AUS EXCEL — für „Eigene Datenbank“ in Teil B
   Liest eine Excel-Datei nach der Vorlage (anleitung/HBI-Vorlage-
   Datenbank.xlsx), prüft sie und macht daraus einen Datensatz, den
   Teil B spielen kann. Läuft im Browser (braucht xlsx.full.min.js)
   und in Node (für daten/tiere.js) — derselbe Code für beides.

   Datensatz.ausExcel(arrayBuffer, dateiname)
     → { fehler:[…], hinweise:[…], zuordnung:[…], datensatz }
   fehler   = muss in der Excel-Datei behoben werden (✗)
   hinweise = funktioniert, aber besser prüfen (⚠)
   Gibt es Fehler, ist datensatz null.

   Datensatz.alsDatei(datensatz) → Text einer Spieldatei für daten/.
   Format: (window.HBI_DATENSAETZE ||= []).push({…}) — bewusst NICHT
   SPALTEN/DATEN, die personen.js für Teil A belegt.
   ============================================================ */
var Datensatz = (function(){

  /* Alle Schlüsselwörter von SQLite (sqlite.org/lang_keywords.html). Als Spaltenname
     würden sie Abfragen zum Absturz bringen — „Alter“ ist der Klassiker (ALTER). */
  var SCHLUESSELWOERTER = ('ABORT ACTION ADD AFTER ALL ALTER ALWAYS ANALYZE AND AS ASC ATTACH AUTOINCREMENT ' +
    'BEFORE BEGIN BETWEEN BY CASCADE CASE CAST CHECK COLLATE COLUMN COMMIT CONFLICT CONSTRAINT CREATE CROSS ' +
    'CURRENT CURRENT_DATE CURRENT_TIME CURRENT_TIMESTAMP DATABASE DEFAULT DEFERRABLE DEFERRED DELETE DESC ' +
    'DETACH DISTINCT DO DROP EACH ELSE END ESCAPE EXCEPT EXCLUDE EXCLUSIVE EXISTS EXPLAIN FAIL FILTER FIRST ' +
    'FOLLOWING FOR FOREIGN FROM FULL GENERATED GLOB GROUP GROUPS HAVING IF IGNORE IMMEDIATE IN INDEX INDEXED ' +
    'INITIALLY INNER INSERT INSTEAD INTERSECT INTO IS ISNULL JOIN KEY LAST LEFT LIKE LIMIT MATCH MATERIALIZED ' +
    'NATURAL NO NOT NOTHING NOTNULL NULL NULLS OF OFFSET ON OR ORDER OTHERS OUTER OVER PARTITION PLAN PRAGMA ' +
    'PRECEDING PRIMARY QUERY RAISE RANGE RECURSIVE REFERENCES REGEXP REINDEX RELEASE RENAME REPLACE RESTRICT ' +
    'RETURNING RIGHT ROLLBACK ROW ROWS SAVEPOINT SELECT SET TABLE TEMP TEMPORARY THEN TIES TO TRANSACTION ' +
    'TRIGGER UNBOUNDED UNION UNIQUE UPDATE USING VACUUM VALUES VIEW VIRTUAL WHEN WHERE WINDOW WITH WITHOUT')
    .toLowerCase().split(' ');

  var MIN_ZEILEN = 15;       // so viele Karten zeigt die geheime Auswahl (AUSWAHL_ANZAHL in wer_bin_ich.html)
  var GUTE_ZEILEN = 20;
  var VERGEBEN = ['personen'];   // Tabellennamen, die das Spiel schon benutzt

  function leer(v){ return v === null || v === undefined || (typeof v === 'string' && v.trim() === ''); }
  function anfuehrung(t){ return '„' + t + '“'; }

  /* Schreibweise vereinheitlichen: für Spaltennamen und zum Erkennen ähnlicher Werte */
  function ohneUmlaute(t){
    return String(t).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  function sqlName(t){ return ohneUmlaute(String(t).trim()).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''); }
  /* Spaltenname: Was in Klammern steht, gilt nur für den Schalter — „Gewicht (kg)“ → gewicht.
     Ginge der Name ohne Klammer nicht (SQL-Wort, leer, Ziffer vorne, id), bleibt sie drin: „Alter (Jahre)“ → alter_jahre. */
  function spaltenName(t){
    var kurz = sqlName(String(t).replace(/\([^)]*\)/g, ' '));
    if (!kurz || /^\d/.test(kurz) || kurz === 'id' || SCHLUESSELWOERTER.indexOf(kurz) >= 0) return sqlName(t);
    return kurz;
  }
  function vergleichsSchluessel(t){ return ohneUmlaute(t).replace(/[^a-z0-9]/g, ''); }

  /* „12,5“, „1'200“, „1 200“, „-3“ → Zahl. Sonst null. */
  function alsZahl(t){
    var s = String(t).trim();
    if (!/^[-+]?(\d{1,3}(['’ ]\d{3})+|\d+)([.,]\d+)?$/.test(s)) return null;
    var n = Number(s.replace(/['’ ]/g, '').replace(',', '.'));
    return isFinite(n) ? n : null;
  }
  /* „12 kg“, „3.5 m“, „40%“ → Zahl mit Einheit (das soll nicht in eine Zahlenspalte) */
  function zahlMitEinheit(t){ return /^[-+]?\d+([.,]\d+)?\s*[A-Za-zÄÖÜäöü%°]+\.?$/.test(String(t).trim()); }

  function datumText(d){
    function zwei(n){ return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + zwei(d.getMonth() + 1) + '-' + zwei(d.getDate());
  }

  function xlsx(){
    if (typeof XLSX !== 'undefined') return XLSX;
    if (typeof require === 'function') return require('./xlsx.full.min.js');
    throw new Error('xlsx.full.min.js ist nicht geladen.');
  }

  /* Ein Blatt als Liste von Zeilen (Zeilennummern wie in Excel) */
  function zeilenVon(X, blatt){
    var bereich = X.utils.decode_range(blatt['!ref'] || 'A1:A1');
    var roh = X.utils.sheet_to_json(blatt, { header:1, raw:true, defval:null, blankrows:true });
    return roh.map(function(werte, i){ return { nr: bereich.s.r + 1 + i, werte: werte }; });
  }

  function blattSuchen(mappe, wort){
    var name = mappe.SheetNames.filter(function(n){ return vergleichsSchluessel(n) === wort; })[0];
    return name ? mappe.Sheets[name] : null;
  }

  /* ---------- Einstellungen ---------- */
  function liesEinstellungen(X, blatt, fehler, hinweise){
    var e = {};
    zeilenVon(X, blatt).forEach(function(z){
      var schluessel = vergleichsSchluessel(z.werte[0] == null ? '' : z.werte[0]);
      var wert = z.werte[1] == null ? '' : String(z.werte[1]).trim();
      if (!schluessel || !wert) return;
      if (schluessel.indexOf('titel') === 0) e.titel = wert;
      else if (schluessel.indexOf('eineintrag') === 0 || schluessel.indexOf('wort') === 0) e.objekt = wert;
      else if (schluessel.indexOf('artikel') === 0) e.artikel = wert.toLowerCase();
      else if (schluessel.indexOf('tabelle') === 0) e.tabelle = wert;
    });
    if (!e.titel) fehler.push('Im Blatt „Einstellungen“ fehlt der Titel (z. B. „Tiere“).');
    if (!e.objekt) fehler.push('Im Blatt „Einstellungen“ fehlt, wie ein Eintrag heisst (z. B. „Tier“) — so heisst es im Spiel „Wähle dein geheimes Tier“.');
    if (!e.artikel) fehler.push('Im Blatt „Einstellungen“ fehlt der Artikel (der, die oder das).');
    else if (['der', 'die', 'das'].indexOf(e.artikel) < 0) fehler.push('Der Artikel muss „der“, „die“ oder „das“ sein, nicht ' + anfuehrung(e.artikel) + '.');

    var tabelle = e.tabelle ? sqlName(e.tabelle) : (e.titel ? sqlName(e.titel.split(/\s+/)[0]) : '');
    if (!e.tabelle && tabelle) hinweise.push('Kein Tabellenname angegeben — die Tabelle heisst jetzt ' + anfuehrung(tabelle) + '. So tippen ihn die Schüler*innen in SELECT * FROM ' + tabelle + '.');
    if (e.tabelle && tabelle !== e.tabelle) hinweise.push('Tabellenname ' + anfuehrung(e.tabelle) + ' wurde zu ' + anfuehrung(tabelle) + ' (nur Kleinbuchstaben, Ziffern und _).');
    if (tabelle) {
      if (/^\d/.test(tabelle)) fehler.push('Der Tabellenname darf nicht mit einer Zahl beginnen: ' + anfuehrung(tabelle) + '.');
      if (SCHLUESSELWOERTER.indexOf(tabelle) >= 0) fehler.push(anfuehrung(tabelle) + ' ist ein SQL-Befehl und geht nicht als Tabellenname. Nimm z. B. ' + anfuehrung(tabelle + 'n') + '.');
      if (VERGEBEN.indexOf(tabelle) >= 0) fehler.push('Den Tabellennamen ' + anfuehrung(tabelle) + ' haben die Persönlichkeiten — die lassen sich nicht per Excel ändern. Wähle einen anderen Tabellennamen.');
      if (/^sqlite_/.test(tabelle)) fehler.push('Tabellennamen mit „sqlite_“ sind in SQLite reserviert.');
    } else if (e.titel) fehler.push('Aus dem Titel liess sich kein Tabellenname bilden. Trage im Blatt „Einstellungen“ einen Tabellennamen ein.');
    e.tabelle = tabelle;
    return e;
  }

  /* ---------- Daten ---------- */
  function ausExcel(puffer, dateiname){
    var fehler = [], hinweise = [], zuordnung = [];
    var X = xlsx(), mappe;
    // Excel-Dateien beginnen mit einer festen Kennung: .xlsx/.ods = ZIP („PK“), altes .xls = D0 CF 11 E0.
    // Sonst würde SheetJS z. B. eine Textdatei als Tabelle lesen und verwirrende Folgemeldungen erzeugen.
    var b = new Uint8Array(puffer.buffer || puffer, puffer.byteOffset || 0, 4);
    var istZip = b[0] === 0x50 && b[1] === 0x4B, istXls = b[0] === 0xD0 && b[1] === 0xCF && b[2] === 0x11 && b[3] === 0xE0;
    if (!istZip && !istXls)
      return { fehler:['Das ist keine Excel-Datei. Öffne die Tabelle in Excel und speichere sie als „Excel-Arbeitsmappe (.xlsx)“.'], hinweise:[], zuordnung:[], datensatz:null };
    try { mappe = X.read(puffer, { type:'array', cellDates:true }); }
    catch (err) { return { fehler:['Die Datei liess sich nicht als Excel-Tabelle lesen. Speichere sie in Excel als .xlsx und versuche es nochmals.'], hinweise:[], zuordnung:[], datensatz:null }; }

    var einstellungsBlatt = blattSuchen(mappe, 'einstellungen');
    var datenBlatt = blattSuchen(mappe, 'daten');
    if (!datenBlatt) {
      var andere = mappe.SheetNames.filter(function(n){ return ['anleitung', 'einstellungen'].indexOf(vergleichsSchluessel(n)) < 0; });
      if (andere.length) { datenBlatt = mappe.Sheets[andere[0]]; hinweise.push('Kein Blatt „Daten“ gefunden — gelesen wurde das Blatt ' + anfuehrung(andere[0]) + '.'); }
    }
    if (!einstellungsBlatt) fehler.push('Das Blatt „Einstellungen“ fehlt. Am einfachsten startest du mit der Vorlage HBI-Vorlage-Datenbank.xlsx.');
    if (!datenBlatt) fehler.push('Die Datei enthält kein Blatt mit Daten.');
    var e = einstellungsBlatt ? liesEinstellungen(X, einstellungsBlatt, fehler, hinweise) : {};
    if (!datenBlatt) return { fehler:fehler, hinweise:hinweise, zuordnung:zuordnung, datensatz:null };

    var zeilen = zeilenVon(X, datenBlatt);
    var kopf = zeilen.shift() || { nr:1, werte:[] };
    zeilen = zeilen.filter(function(z){ return z.werte.some(function(v){ return !leer(v); }); });

    // Spalten: Name aus der Kopfzeile, nur Spalten mit Namen oder Daten
    var breite = Math.max(kopf.werte.length, zeilen.reduce(function(m, z){ return Math.max(m, z.werte.length); }, 0));
    var spalten = [];
    for (var i = 0; i < breite; i++) {
      var titel = leer(kopf.werte[i]) ? '' : String(kopf.werte[i]).trim();
      var hatDaten = zeilen.some(function(z){ return !leer(z.werte[i]); });
      if (!titel && !hatDaten) continue;
      var buchstabe = X.utils.encode_col(i);
      if (!titel) { fehler.push('Spalte ' + buchstabe + ' hat Daten, aber keinen Namen in Zeile ' + kopf.nr + '.'); continue; }
      var name = spaltenName(titel);
      if (!name) { fehler.push('Der Spaltenname ' + anfuehrung(titel) + ' (Spalte ' + buchstabe + ') enthält keine Buchstaben.'); continue; }
      if (/^\d/.test(name)) { fehler.push('Der Spaltenname ' + anfuehrung(titel) + ' beginnt mit einer Zahl — das geht in SQL nicht. Setze ein Wort davor.'); continue; }
      if (name === 'id') { fehler.push('Die Spalte „id“ legt das Spiel selbst an. Bitte löschen oder umbenennen.'); continue; }
      if (SCHLUESSELWOERTER.indexOf(name) >= 0) {
        fehler.push(anfuehrung(titel) + ' ist ein SQL-Befehl (' + name.toUpperCase() + ') und geht nicht als Spaltenname — jede Abfrage damit würde abbrechen. Benenne die Spalte um, z. B. ' + anfuehrung(name + '_jahre') + ' oder ' + anfuehrung(name + '_wert') + '.');
        continue;
      }
      var doppelt = spalten.filter(function(s){ return s.name === name; })[0];
      if (doppelt) { fehler.push('Zwei Spalten heissen nach dem Vereinfachen gleich: ' + anfuehrung(doppelt.titel) + ' und ' + anfuehrung(titel) + ' → ' + anfuehrung(name) + '.'); continue; }
      spalten.push({ index:i, titel:titel, name:name, buchstabe:buchstabe });
      zuordnung.push({ excel:titel, spalte:name, geaendert: name !== titel });
    }

    // Kartentitel: Spalte „name“, sonst die erste Textspalte
    var titelSpalte = spalten.filter(function(s){ return s.name === 'name'; })[0];

    // Werte lesen und Typen bestimmen
    var mitEinheit = [], alsZahlUebernommen = {};
    spalten.forEach(function(s){
      var zahlen = 0, texte = 0, umgewandelt = 0, beispiel = null;
      s.werte = zeilen.map(function(z){
        var v = z.werte[s.index];
        if (leer(v)) return null;
        if (v instanceof Date) return datumText(v);
        if (typeof v === 'boolean') return v ? 'ja' : 'nein';
        if (typeof v === 'number') { zahlen++; return v; }
        var t = String(v).replace(/\s+/g, ' ').trim(), n = alsZahl(t);
        if (n !== null) { zahlen++; umgewandelt++; if (beispiel === null) beispiel = t; return n; }
        texte++; return t;
      });
      s.zahl = zahlen > 0 && texte === 0;
      if (zahlen > 0 && texte > 0) {
        // Zahl mit Einheit in einer sonst zahlenmässigen Spalte → Fehler mit Zeile
        var einheit = [], erste = null;
        s.werte.forEach(function(v, k){ if (typeof v === 'string' && zahlMitEinheit(v)) { einheit.push(zeilen[k].nr); if (!erste) erste = v; } });
        if (einheit.length && texte === einheit.length) {
          // Einheit aus dem Wert ablesen („1000 kg“ → kg) und nur vorschlagen, wenn sie im Spaltennamen noch fehlt
          var e = sqlName((/[A-Za-zÄÖÜäöü]+\.?$/.exec(erste) || [''])[0]);
          var schon = !e || s.name === e || s.name.slice(-(e.length + 1)) === '_' + e || sqlName(s.titel).split('_').indexOf(e) >= 0;
          mitEinheit.push('Spalte ' + anfuehrung(s.titel) + ': Zahlen mit Einheit in Zeile ' + einheit.slice(0, 6).join(', ') + (einheit.length > 6 ? ' …' : '') +
            ' (z. B. ' + anfuehrung(erste) + '). Trage nur die Zahl ein' +
            (schon ? ' — die Einheit steht schon im Spaltennamen.' : ' — die Einheit gehört in Klammern in den Spaltennamen, z. B. ' +
              anfuehrung(s.titel + ' (' + (/[A-Za-zÄÖÜäöü%°]+\.?$/.exec(erste) || [e])[0] + ')') + '.'));
        }
        else hinweise.push('Spalte ' + anfuehrung(s.titel) + ' enthält Zahlen und Text gemischt. Vergleiche wie ' + s.name + ' > 10 funktionieren dann nicht zuverlässig.');
      }
      if (umgewandelt) alsZahlUebernommen[s.titel] = { anzahl:umgewandelt, beispiel:beispiel };
    });
    mitEinheit.forEach(function(t){ fehler.push(t); });
    Object.keys(alsZahlUebernommen).forEach(function(t){
      var u = alsZahlUebernommen[t];
      hinweise.push('Spalte ' + anfuehrung(t) + ': ' + (u.anzahl === 1 ? '1 Wert stand' : u.anzahl + ' Werte standen') +
        ' als Text da (z. B. ' + anfuehrung(u.beispiel) + ') und ' + (u.anzahl === 1 ? 'wurde' : 'wurden') + ' als Zahl übernommen.');
    });

    if (!titelSpalte) {
      titelSpalte = spalten.filter(function(s){ return !s.zahl; })[0];
      if (titelSpalte) hinweise.push('Keine Spalte „name“ — auf den Karten steht ' + anfuehrung(titelSpalte.titel) + ' als Titel.');
      else if (spalten.length) fehler.push('Es braucht eine Spalte „name“ mit den Namen der Einträge (sie steht oben auf jeder Karte).');
    }
    if (titelSpalte) {
      var gesehen = {}, ohneName = [], doppelte = [];
      titelSpalte.werte.forEach(function(v, k){
        if (v === null) { ohneName.push(zeilen[k].nr); return; }
        var schl = String(v).toLowerCase();
        if (gesehen[schl]) doppelte.push(anfuehrung(v) + ' (Zeile ' + gesehen[schl] + ' und ' + zeilen[k].nr + ')');
        else gesehen[schl] = zeilen[k].nr;
      });
      if (ohneName.length) fehler.push('In der Spalte ' + anfuehrung(titelSpalte.titel) + ' fehlt der Name in Zeile ' + ohneName.slice(0, 8).join(', ') + (ohneName.length > 8 ? ' …' : '') + '.');
      if (doppelte.length) fehler.push('Jeder Name darf nur einmal vorkommen: ' + doppelte.slice(0, 5).join(', ') + (doppelte.length > 5 ? ' …' : '') + '.');
    }

    // Didaktische Hinweise: ähnliche Schreibweisen, Spalten ohne Unterschiede, Anzahl Merkmale
    spalten.forEach(function(s){
      if (s === titelSpalte) return;
      var gefuellt = s.werte.filter(function(v){ return v !== null; });
      if (!gefuellt.length) { hinweise.push('Die Spalte ' + anfuehrung(s.titel) + ' ist ganz leer.'); return; }
      if (!s.zahl) {
        var gruppen = {};
        gefuellt.forEach(function(v){
          if (typeof v !== 'string') return;
          var k = vergleichsSchluessel(v);
          if (!gruppen[k]) gruppen[k] = {};
          gruppen[k][v] = (gruppen[k][v] || 0) + 1;
        });
        Object.keys(gruppen).forEach(function(k){
          var varianten = Object.keys(gruppen[k]);
          if (varianten.length > 1)
            hinweise.push('Spalte ' + anfuehrung(s.titel) + ': ' + varianten.map(function(v){ return anfuehrung(v) + ' (' + gruppen[k][v] + '×)'; }).join(' und ') +
              ' sehen gleich aus, sind aber verschieden geschrieben. Für SQL sind das zwei Werte — vereinheitlichen.');
        });
      }
      var verschieden = {};
      gefuellt.forEach(function(v){ verschieden[typeof v === 'string' ? v.toLowerCase() : v] = true; });
      if (Object.keys(verschieden).length === 1 && gefuellt.length > 1)
        hinweise.push('In der Spalte ' + anfuehrung(s.titel) + ' haben alle denselben Wert — im Duell hilft sie beim Eingrenzen nicht.');
    });
    var merkmale = spalten.length - (titelSpalte ? 1 : 0);
    if (spalten.length && zeilen.length && merkmale < 4) hinweise.push('Nur ' + merkmale + ' Merkmal' + (merkmale === 1 ? '' : 'e') + ' neben dem Namen. Für ein gutes Duell sind mindestens 5 Spalten zum Eingrenzen besser.');

    if (zeilen.length < MIN_ZEILEN) fehler.push('Es sind nur ' + zeilen.length + ' Einträge — mindestens ' + MIN_ZEILEN + ' sind nötig (so viele Karten zeigt die geheime Auswahl).');
    else if (zeilen.length < GUTE_ZEILEN) hinweise.push('Mit ' + zeilen.length + ' Einträgen ist das Duell schnell vorbei. Ab ' + GUTE_ZEILEN + ' wird es spannender.');
    if (zeilen.length > 2000) hinweise.push('Sehr viele Einträge (' + zeilen.length + '). Das geht, die Karten laden aber langsamer.');

    if (fehler.length) return { fehler:fehler, hinweise:hinweise, zuordnung:zuordnung, datensatz:null };

    var namen = ['id'].concat([titelSpalte].concat(spalten.filter(function(s){ return s !== titelSpalte; })).map(function(s){ return s.name; }));
    var geordnet = [titelSpalte].concat(spalten.filter(function(s){ return s !== titelSpalte; }));
    var beschriftungen = {};                          // für die Schalter: „Ernährung“ statt ernaehrung
    geordnet.forEach(function(s){ beschriftungen[s.name] = s.titel; });
    var datensatz = {
      id: e.tabelle, titel: e.titel, tabelle: e.tabelle, objekt: e.objekt, artikel: e.artikel,
      kartentitel: titelSpalte.name, spalten: namen, beschriftungen: beschriftungen,
      zeilen: zeilen.map(function(z, k){
        var o = { id: k + 1 };
        geordnet.forEach(function(s){ o[s.name] = s.werte[k]; });
        return o;
      }),
      quelle: dateiname || ''
    };
    return { fehler:[], hinweise:hinweise, zuordnung:zuordnung, datensatz:datensatz };
  }

  /* Text einer Spieldatei für daten/ */
  function alsDatei(ds, neuErzeugen){
    var kopf = '/* HBI — Datensatz „' + ds.titel + '“ für Teil B („Wer bin ich?“).\n' +
      '   Erzeugt aus ' + (ds.quelle || 'einer Excel-Datei') + ' — nicht von Hand ändern, sondern das Excel\n' +
      '   anpassen und ' + (neuErzeugen || 'im Spiel über Menü → Eigene Datenbank neu erzeugen') + '. */\n';
    var inhalt = { id:ds.id, titel:ds.titel, tabelle:ds.tabelle, objekt:ds.objekt, artikel:ds.artikel,
      kartentitel:ds.kartentitel, spalten:ds.spalten, beschriftungen:ds.beschriftungen || {}, zeilen:ds.zeilen };
    var zeilenText = ds.zeilen.map(function(z){ return '    ' + JSON.stringify(z); }).join(',\n');
    var ohneZeilen = JSON.stringify(Object.assign({}, inhalt, { zeilen:'@ZEILEN@' }), null, 2).replace('"@ZEILEN@"', '[\n' + zeilenText + '\n  ]');
    return kopf + '(window.HBI_DATENSAETZE = window.HBI_DATENSAETZE || []).push(' + ohneZeilen + ');\n';
  }

  return { ausExcel:ausExcel, alsDatei:alsDatei, sqlName:sqlName, SCHLUESSELWOERTER:SCHLUESSELWOERTER, MIN_ZEILEN:MIN_ZEILEN };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Datensatz;
