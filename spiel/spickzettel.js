/* ============================================================
   SQL-SPICKZETTEL — die wichtigsten Abfragen für das Spiel.
   Einzige Quelle für den Spickzettel im Menü von Teil A und Teil B und
   später für die gedruckte SQL-Referenzkarte der Spielanleitung.
   Alle Beispiele liefern mit personen.js Treffer.

   Seit 07.10.2026 nach den Stufen der SQL-Medaille gegliedert
   (Gewöhnlich · Selten · Speziell) und gekürzt — Punktzahlen stehen
   bewusst nicht hier, die kommen in die Spielregeln.

   Aufbau: Gruppen { gruppe, stufe?, hinweis?, nurTeilB? } → Einträge
           { befehl, text, beispiel, hinweis?, ohneEinordnung? }
   Die Marke pro Eintrag berechnet Teil B aus dem Beispiel (sprachmittel);
   stufe der Gruppe dient nur der Prüfung, dass jedes Beispiel in seiner
   Gruppe steht. ohneEinordnung: true = keine Marke.
   nurTeilB: true = nur in Teil B anzeigen (betrifft die Medaillen).
   ============================================================ */
var SPICKZETTEL = [
  {
    gruppe: 'Grundgerüst',
    eintraege: [
      { befehl: 'SELECT * FROM …   WHERE …',
        text: 'Holt nur die Zeilen, die die Bedingung erfüllen. Texte stehen in einfachen Anführungszeichen.',
        beispiel: "SELECT * FROM personen\nWHERE herkunft = 'Schweiz'",
        ohneEinordnung: true },
      { befehl: 'AND',
        text: 'Beide Bedingungen müssen stimmen — die Auswahl wird kleiner. AND selbst wird nicht bewertet, '
            + 'es zählt, was du verbindest.',
        beispiel: "SELECT * FROM personen\nWHERE geschlecht = 'weiblich' AND kontinent = 'Europa'",
        ohneEinordnung: true }
    ]
  },
  {
    gruppe: 'Gewöhnlich',
    stufe: 'gewoehnlich',
    eintraege: [
      { befehl: '=   !=',
        text: 'Ist gleich bzw. ist nicht gleich. Auch <> und NOT … = bedeuten „ist nicht gleich“.',
        beispiel: "SELECT * FROM personen\nWHERE kontinent != 'Europa'",
        hinweis: 'Zeilen ohne Angabe fallen bei != heraus — siehe IS NULL.' },
      { befehl: 'IS NULL   IS NOT NULL',
        text: 'Findet Zeilen, bei denen eine Angabe fehlt bzw. vorhanden ist. Mit = NULL geht es nicht. '
            + 'Als einzige Bedingung gewöhnlich, zusammen mit anderen Bedingungen selten.',
        beispiel: 'SELECT * FROM personen\nWHERE geburtsjahr IS NULL',
        hinweis: "Wer noch lebt, hat kein Todesjahr — einfacher findest du sie mit todesursache = 'lebt noch'." }
    ]
  },
  {
    gruppe: 'Selten',
    stufe: 'selten',
    eintraege: [
      { befehl: '<   >   <=   >=   BETWEEN … AND …',
        text: 'Vergleicht Zahlen oder gibt einen Bereich an (beide Grenzen gehören dazu). '
            + 'Jahre vor Christus sind negativ (−500 = 500 v. Chr.).',
        beispiel: 'SELECT * FROM personen\nWHERE geburtsjahr BETWEEN 1800 AND 1900' },
      { befehl: 'OR',
        text: 'Mindestens eine Bedingung muss stimmen — die Auswahl wird grösser. Geht es um dieselbe Spalte, ist IN kürzer.',
        beispiel: "SELECT * FROM personen\nWHERE epoche = 'Antike' OR kontinent = 'Asien'",
        hinweis: 'Zusammen mit AND Klammern setzen: AND wird vor OR ausgewertet.' },
      { befehl: 'IN ( …, … )',
        text: 'Passt, wenn der Wert in der Liste steht — kürzer als viele OR. Mit nur einem Wert gewöhnlich. '
            + 'Gegenteil: NOT IN.',
        beispiel: "SELECT * FROM personen\nWHERE kontinent IN ('Asien', 'Afrika')" },
      { befehl: '… OR … IS NULL',
        text: 'Holt die Zeilen ohne Angabe zu einem Vergleich dazu — ohne diesen Zusatz fehlen sie.',
        beispiel: 'SELECT * FROM personen\nWHERE todesjahr > 2000\n  OR todesjahr IS NULL' }
    ]
  },
  {
    gruppe: 'Speziell',
    stufe: 'speziell',
    eintraege: [
      { befehl: 'LIKE   mit %  oder  _',
        text: 'Sucht nach einem Muster: % steht für beliebig viele Zeichen, _ für genau eines. Ohne % oder _ '
            + 'ist es dasselbe wie = (gewöhnlich). Gegenteil: NOT LIKE.',
        beispiel: "SELECT * FROM personen\nWHERE taetigkeit LIKE 'Maler%'",
        hinweis: 'Bei der Tätigkeit praktisch: findet Maler und Malerin.' },
      { befehl: '( … OR … )',
        text: 'Klammern legen fest, was zusammengehört. Speziell, wenn das OR verschiedene Spalten verbindet '
            + 'und mit weiteren Bedingungen kombiniert ist.',
        beispiel: "SELECT * FROM personen\nWHERE geschlecht = 'weiblich'\n  AND (kontinent = 'Asien' OR epoche = 'Antike')" },
      { befehl: 'Rechnen mit Spalten',
        text: 'Mit zwei Spalten rechnen — zum Beispiel das Alter, das jemand erreicht hat.',
        beispiel: 'SELECT * FROM personen\nWHERE todesjahr - geburtsjahr > 80' },
      { befehl: 'ORDER BY …   DESC',
        text: 'Sortiert das Ergebnis, mit DESC absteigend (grösste Zahl zuerst).',
        beispiel: "SELECT * FROM personen\nWHERE herkunft = 'Schweiz'\nORDER BY geburtsjahr DESC",
        hinweis: 'Achtung: braucht eine eigene Abfrage! Sortieren grenzt nicht ein.',
        ohneEinordnung: true }
    ]
  },
  {
    gruppe: 'Zählen & Übersicht',
    stufe: 'joker',
    hinweis: 'Joker-Befehle: grenzen nicht ein. Im Terminal zählen sie als normale Abfrage — mit eingeschaltetem Joker einmal pro Runde gratis über den Knopf „🃏 Joker“.',
    eintraege: [
      { befehl: 'COUNT(*)   GROUP BY …',
        text: 'Zählt, wie viele Zeilen passen — mit GROUP BY für jeden Wert einzeln.',
        beispiel: 'SELECT kontinent, COUNT(*) FROM personen\nGROUP BY kontinent' }
    ]
  },
  {
    gruppe: 'Gut zu wissen',
    nurTeilB: true,
    hinweis: "Grenzt du nur über die id oder alphabetisch über den Namen ein (id < 100, name < 'M'), "
           + 'gibt es keine Treffer-Medaille — das sagt nichts über die Karte aus.',
    eintraege: []
  }
];
