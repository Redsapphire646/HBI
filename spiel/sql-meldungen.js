/* ============================================================
   SQL-MELDUNGEN — gemeinsam für Teil A (sql-szene.js) und Teil B
   (wer_bin_ich.html). Beide Teile sollen auf dieselbe falsche Abfrage
   dieselbe Erklärung geben; darum steht das hier nur einmal.

   Gerechnet wird immer mit echtem SQLite. Diese Datei erklärt nur,
   WAS falsch ist — verständlicher als SQLite selbst. Dessen Meldung
   ist für Einsteiger*innen teils irreführend: Bei
     SELECT COUNT(*) personen WHERE herkunft = 'Schweiz'
   behauptet SQLite, die Spalte herkunft gebe es nicht. Gemeint ist:
   Es fehlt FROM.

   ziel = { tabelle, spalten, ort }
     ort: wie der Ort heisst, an dem die Tabelle liegt —
          'Im Archiv' (Szenen) oder 'Hier' (Duell)
   ============================================================ */
var SqlMeldungen = (function(){
  function Fehler(text){ throw { fehler:text }; }

  /* Die häufigsten Meldungen von SQLite auf Deutsch */
  function deutsch(m, text, ziel){
    var x;
    if ((x = /no such column: (.+)$/.exec(m))) {
      var tipp = /[A-ZÄÖÜ]/.test(x[1]) || text.indexOf('"') >= 0
        ? " Meinst du einen Text? Texte stehen in einfachen Anführungszeichen, zum Beispiel '" + x[1] + "'." : '';
      return 'Die Spalte „' + x[1] + '“ gibt es nicht. Vorhanden sind: ' + ziel.spalten.join(', ') + '.' + tipp;
    }
    if ((x = /no such table: (.+)$/.exec(m))) return 'Die Tabelle „' + x[1] + '“ kenne ich nicht. ' + ziel.ort + ' gibt es nur die Tabelle ' + ziel.tabelle + '.';
    if ((x = /unrecognized token: "(.*)"/.exec(m)))
      return x[1].charAt(0) === "'" ? "Ein Text wurde mit ' begonnen, aber nicht mit ' beendet." : 'Das Zeichen „' + x[1] + '“ verstehe ich nicht.';
    if ((x = /near "(.+)": syntax error/.exec(m))) return 'Bei „' + x[1] + '“ stimmt die Schreibweise nicht. Prüfe Schlüsselwörter, Kommas, Klammern und Anführungszeichen.';
    if (/incomplete input/.test(m)) return "Die Abfrage ist unvollständig — fehlt am Ende noch etwas, zum Beispiel eine Bedingung, ein ' oder eine Klammer?";
    if ((x = /no such function: (.+)$/.exec(m))) return 'Die Funktion „' + x[1] + '“ gibt es nicht.';
    if (/misuse of aggregate/.test(m)) return 'COUNT, SUM, AVG, MIN und MAX dürfen nicht in WHERE stehen.';
    return 'SQLite meldet: ' + m;
  }

  /* Läuft NUR, wenn SQLite die Abfrage abgelehnt hat — sie ist dann sicher falsch.
     Die Muster stammen aus dem früheren Mini-Parser der Szenen. */
  function erklaere(text, meldung, ziel){
    var m = text.replace(/'[^']*'/g, "''").replace(/--[^\n]*/g, '');
    var bsp = ziel.spalten.indexOf('herkunft') >= 0 ? "herkunft = 'Italien'" : "spalte = 'Wert'";
    if (/^\s*SELECT\s+FROM\b/i.test(m)) return 'Nach SELECT fehlt, was du sehen willst: * für alles oder Spaltennamen.';
    if (!/\bFROM\b/i.test(m)) return 'Es fehlt FROM ' + ziel.tabelle + ' — woher sollen die Daten kommen?';
    if (/\bCOUNT\b(?!\s*\()/i.test(m)) return 'Nach COUNT folgt (*), also COUNT(*).';
    if (/\bWHERE\s*;?\s*$/i.test(m)) return 'Nach WHERE fehlt eine Bedingung, zum Beispiel ' + bsp + '.';
    if (/\b(AND|OR|NOT)\s*;?\s*$/i.test(m)) return 'Die Bedingung ist unvollständig — nach AND, OR oder NOT fehlt noch etwas.';
    if (/\bWHERE\b[\s\S]*\bWHERE\b/i.test(m) && !/\(\s*SELECT\b/i.test(m))
      return 'WHERE steht nur einmal in einer Abfrage. Weitere Bedingungen verbindest du mit AND oder OR.';
    if (!/\bWHERE\b/i.test(m) && /\bFROM\s+\w+\s+\w+\s*(=|<>|!=|<=|>=|<|>)/i.test(m))
      return 'Vor der Bedingung fehlt WHERE: SELECT … FROM ' + ziel.tabelle + ' WHERE …';
    return deutsch(meldung, text, ziel);
  }

  /* Läuft VOR der Abfrage: SQLite nimmt "Schweiz" stillschweigend als Text — ein altes
     Zugeständnis, das in echtem SQL falsch ist. Doppelte Anführungszeichen bezeichnen
     Spalten. Erlaubt bleibt es darum nur, wenn darin wirklich ein Spaltenname steht. */
  function pruefeAnfuehrungszeichen(text, spalten){
    var ohneEinfache = text.replace(/'[^']*'/g, "''"), x, re = /"([^"]*)"/g;
    while ((x = re.exec(ohneEinfache)))
      if (spalten.indexOf(x[1].toLowerCase()) < 0)
        Fehler("Verwende für Texte einfache Anführungszeichen: '" + x[1] + "' statt \"" + x[1] + "\".");
    if ((ohneEinfache.match(/"/g) || []).length % 2)
      Fehler("Verwende für Texte einfache Anführungszeichen, zum Beispiel 'Schweiz'.");
  }

  return { erklaere:erklaere, pruefeAnfuehrungszeichen:pruefeAnfuehrungszeichen };
})();
