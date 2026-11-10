/* ============================================================
   ECHTES SQL FÜR DIE SZENEN (Teil A)
   Ersetzt den früheren Mini-Parser. Läuft auf derselben SQLite-Engine
   wie Teil B (sql.js, sql-asm.js), die Tabelle wird gleich gebaut:
   Spaltentypen aus den Daten, Textspalten mit COLLATE NOCASE.

   Einbinden (Reihenfolge wichtig):
     <script src="../daten/personen.js"></script>
     <script src="sql-asm.js"></script>
     <script src="sql-meldungen.js"></script>   ← dieselben Fehlermeldungen wie Teil B
     <script src="sql-szene.js"></script>       ← startet die Datenbank selbst

   abfrage(text) liefert dieselbe Form wie früher der Mini-Parser:
     { zaehlen, spalten, zeilen }
   zeilen sind die ORIGINAL-Objekte aus DATEN — nie Kopien. Mehrere Szenen
   prüfen mit KAISER.indexOf(p) auf Identität. Bei COUNT(*) enthält zeilen
   die gezählten Personen, damit eine Szene prüfen kann, WAS gezählt wurde.

   Neu, weil echtes SQL mehr kann als der Mini-Parser:
     art    'personen' | 'zahl' | 'tabelle'
     werte  die Ergebniszeilen, so wie SQLite sie liefert (für die Anzeige)
     wert   bei 'zahl': die Zahl (AVG, MIN, MAX …)
   ============================================================ */
var SqlSzene = (function(){
  var db = null, startFehler = null, spalten = [], nachId = {}, nachName = {};

  function leer(v){ return v === null || v === undefined; }
  function Fehler(text){ throw { fehler:text }; }

  /* Gleich wie baueDatenbank() in wer_bin_ich.html — bewusst gleich gehalten,
     damit Teil A und Teil B auf dieselbe Abfrage dasselbe antworten. */
  function starte(SQL, SPALTEN, DATEN){
    spalten = SPALTEN.slice();
    DATEN.forEach(function(z){ nachId[z.id] = z; nachName[String(z.name).toLowerCase()] = z; });
    var typen = spalten.map(function(s){
      var werte = DATEN.map(function(z){ return z[s]; }).filter(function(v){ return !leer(v); });
      if (werte.length && werte.every(function(v){ return typeof v === 'number' && Math.floor(v) === v; })) return 'INTEGER';
      if (werte.length && werte.every(function(v){ return typeof v === 'number'; })) return 'REAL';
      return 'TEXT';
    });
    var neu = new SQL.Database();
    neu.run('CREATE TABLE personen (' + spalten.map(function(s, i){
      return s + ' ' + typen[i] + (s === 'id' ? ' PRIMARY KEY' : '') + (typen[i] === 'TEXT' ? ' COLLATE NOCASE' : '');
    }).join(', ') + ')');
    neu.run('BEGIN');
    var st = neu.prepare('INSERT INTO personen VALUES (' + spalten.map(function(){ return '?'; }).join(', ') + ')');
    DATEN.forEach(function(z){ st.run(spalten.map(function(s){ return leer(z[s]) ? null : z[s]; })); });
    st.free();
    neu.run('COMMIT');
    db = neu;
  }

  /* Fehlermeldungen kommen aus sql-meldungen.js — dieselben wie in Teil B */
  if (typeof SqlMeldungen === 'undefined')
    console.error('sql-meldungen.js fehlt: Die Datei muss VOR sql-szene.js eingebunden werden.');
  function ziel(){ return { tabelle:'personen', spalten:spalten, ort:'Im Archiv' }; }

  /* ---------- Abfrage ---------- */

  function lauf(sql){
    var st;
    try {
      st = db.prepare(sql);
      var namen = st.getColumnNames(), zeilen = [];
      while (st.step()) zeilen.push(st.get());
      return { spalten:namen, zeilen:zeilen };
    } finally { if (st) st.free(); }
  }

  /* SELECT NAME … liefert die Spalte 'NAME' — früher hiess sie 'name'.
     Echte Spaltennamen darum klein, damit Prüfungen wie spalten.indexOf('name') greifen. */
  function normalSpalten(namen){
    return namen.map(function(n){ var k = String(n).toLowerCase(); return spalten.indexOf(k) >= 0 ? k : n; });
  }

  /* Ergebniszeilen den Personen zuordnen — über id oder name, sonst nicht möglich. */
  function personenAus(roh){
    var sp = roh.spalten.map(function(s){ return String(s).toLowerCase(); });
    var iId = sp.indexOf('id'), iName = sp.indexOf('name');
    if (iId < 0 && iName < 0) return null;
    var liste = [];
    for (var i = 0; i < roh.zeilen.length; i++) {
      var r = roh.zeilen[i];
      var p = iId >= 0 ? nachId[r[iId]] : nachName[String(r[iName]).toLowerCase()];
      if (!p) return null;
      liste.push(p);
    }
    return liste;
  }

  /* Ist es ein einfaches SELECT … FROM personen …? Dann lassen sich die getroffenen
     Personen exakt bestimmen: dieselbe Abfrage mit SELECT * ausführen. So bleiben die
     Prüfungen der Szenen gültig, auch wenn nur einzelne Spalten gewählt wurden oder
     COUNT(*) gezählt hat. Liefert { liste, zaehlt } oder null. */
  function einfach(text){
    var maske = text.replace(/'[^']*'/g, function(t){ return "'" + new Array(t.length - 1).join('x') + "'"; });
    var anfang = /^\s*SELECT\s+/i.exec(maske);
    if (!anfang) return null;
    var vonFrom = maske.slice(anfang[0].length).search(/\bFROM\b/i);
    if (vonFrom < 0) return null;
    var fromIdx = anfang[0].length + vonFrom;
    var liste = maske.slice(anfang[0].length, fromIdx), rest = maske.slice(fromIdx);
    var zaehlt = /^\s*COUNT\s*\(\s*\*\s*\)\s*(?:AS\s+\w+|\w+)?\s*$/i.test(liste);
    if (!zaehlt && (/[()]/.test(liste) || /^\s*(DISTINCT|ALL)\b/i.test(liste))) return null;
    if (/\b(GROUP\s+BY|HAVING|UNION|INTERSECT|EXCEPT|JOIN)\b/i.test(rest)) return null;
    var tabelle = /^FROM\s+(\w+)\b/i.exec(rest);
    if (!tabelle || tabelle[1].toLowerCase() !== 'personen') return null;
    if (/^FROM\s+\w+(\s+(AS\s+)?\w+)?\s*,/i.test(rest)) return null;          // FROM personen, andere
    try {
      var p = personenAus(lauf('SELECT * ' + text.slice(fromIdx)));
      return p ? { liste:p, zaehlt:zaehlt } : null;
    } catch (e) { return null; }
  }

  function abfrage(text){
    if (startFehler) Fehler('Die Datenbank konnte nicht gestartet werden: ' + (startFehler.message || startFehler));
    if (!db) Fehler('Die Datenbank startet noch — versuche es gleich noch einmal.');
    var ohneTexte = text.replace(/'[^']*'/g, "''").replace(/--[^\n]*/g, '');
    if (!text.trim()) Fehler('Dein Hirn wartet auf eine Abfrage. Sie beginnt mit SELECT.');
    if (/;\s*\S/.test(ohneTexte)) Fehler('Bitte nur eine Abfrage auf einmal eingeben.');
    if (/^\s*(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|REPLACE|PRAGMA|ATTACH|DETACH|VACUUM|BEGIN|COMMIT)\b/i.test(ohneTexte))
      Fehler('Hier sind nur Abfragen mit SELECT erlaubt — das Archiv bleibt unverändert.');
    if (!/^\s*SELECT\b/i.test(ohneTexte)) Fehler('Eine Abfrage beginnt immer mit SELECT.');
    SqlMeldungen.pruefeAnfuehrungszeichen(text, spalten);

    var roh;
    try { roh = lauf(text); } catch (e) { Fehler(SqlMeldungen.erklaere(text, e.message || String(e), ziel())); }
    var namen = normalSpalten(roh.spalten);
    var e = einfach(text);

    // COUNT(*) über eine einfache Bedingung: die Zahl plus die gezählten Personen
    if (e && e.zaehlt && roh.zeilen.length === 1 && e.liste.length === roh.zeilen[0][0])
      return { zaehlen:true, art:'zahl', wert:roh.zeilen[0][0], spalten:namen, zeilen:e.liste, werte:roh.zeilen };

    // Ein einzelner Wert ohne Personenbezug: AVG(…), MIN(…), MAX(…) …
    if (roh.spalten.length === 1 && roh.zeilen.length === 1 && typeof roh.zeilen[0][0] === 'number' && !(e && !e.zaehlt))
      return { zaehlen:false, art:'zahl', wert:roh.zeilen[0][0], spalten:namen, zeilen:[], werte:roh.zeilen };

    // Personen: über die einfache Form exakt, sonst über id/name in der Ausgabe
    var personen = (e && !e.zaehlt && e.liste.length === roh.zeilen.length) ? e.liste : personenAus(roh);
    if (personen) return { zaehlen:false, art:'personen', spalten:namen, zeilen:personen, werte:roh.zeilen };

    // Alles andere (GROUP BY, DISTINCT, Berechnungen ohne Namen …) als Tabelle
    return { zaehlen:false, art:'tabelle', spalten:namen, zeilen:[], werte:roh.zeilen };
  }

  /* ---------- Anzeige ---------- */

  function text(v){
    if (leer(v)) return 'NULL';
    if (typeof v === 'number' && Math.floor(v) !== v) v = Math.round(v * 100) / 100;
    return String(v).replace(/[&<>"]/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]; });
  }

  /* Für Ergebnisse, die keine Personenliste sind: eine Zahl (AVG …) oder eine Tabelle
     (GROUP BY, DISTINCT …). Bewusst ohne Zeilenzahl — wie bei den Karten: Gezählt
     wird in SQL mit COUNT(*), nicht durch Ablesen. */
  function alsTabelle(r){
    if (r.art === 'zahl')
      return '<div class="treffer">' + text(r.spalten[0]).toUpperCase() + '</div>'
        + '<div class="karte" style="max-width:14em"><strong style="font-size:2.4em">' + text(r.wert) + '</strong></div>';
    var zelle = 'padding:5px 12px;border-bottom:1px solid rgba(143,122,63,.35);text-align:left;';
    return '<div class="treffer">ERGEBNIS</div><table style="border-collapse:collapse;font-size:.88rem">'
      + '<thead><tr>' + r.spalten.map(function(s){ return '<th style="' + zelle + 'color:var(--gold, #d4af37)">' + text(s) + '</th>'; }).join('') + '</tr></thead>'
      + '<tbody>' + r.werte.map(function(z){ return '<tr>' + z.map(function(v){ return '<td style="' + zelle + '">' + text(v) + '</td>'; }).join('') + '</tr>'; }).join('')
      + '</tbody></table>';
  }

  /* ---------- Regel „mindestens ein gültiger Befehl“ (Entscheid 07.11.2026) ----------
     Eine Lösung wird erst angenommen, wenn im laufenden Rätsel mindestens eine Abfrage
     ohne Fehler gelaufen ist. Wie sie aussieht, ist egal — nur die beiden Grundbausteine
     allein (SELECT * FROM personen / SELECT COUNT(*) FROM personen) zählen nicht.
     Ausnahme: Aufgabe 1 der Aufnahmeprüfung, dort ist genau SELECT * FROM personen gefragt. */
  function istGrundbefehl(sql){
    var t = String(sql).replace(/--[^\n]*/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
      .replace(/\s*;$/, '').replace(/count\s*\(\s*\*\s*\)/, 'count(*)');
    return t === 'select * from personen' || t === 'select count(*) from personen';
  }
  var ZUERST_ABFRAGE = 'Zeig zuerst mit einer Abfrage, wie du darauf gekommen bist.';

  // Selbst starten, sobald sql-asm.js und personen.js geladen sind
  if (typeof initSqlJs === 'function' && typeof SPALTEN !== 'undefined' && typeof DATEN !== 'undefined')
    initSqlJs().then(function(SQL){ starte(SQL, SPALTEN, DATEN); })
      .catch(function(e){ startFehler = e; });

  return { starte:starte, abfrage:abfrage, bereit:function(){ return !!db; }, alsTabelle:alsTabelle, text:text,
           istGrundbefehl:istGrundbefehl, ZUERST_ABFRAGE:ZUERST_ABFRAGE };
})();
