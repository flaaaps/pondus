import { ex } from "./types"

export const CHEST = [
  ex("barbell-bench-press", "Bankdrücken mit Langhantel", "Barbell Bench Press", {
    cat: "compound", mp: "horizontal_push", eq: ["barbell", "bench"], load: "free_weight", p: ["chest"], s: ["triceps", "shoulders"],
    desc: "Die klassische Grundübung für die Brust: Stange kontrolliert zur unteren Brust senken und explosiv nach oben drücken.",
    cues: ["Schulterblätter zusammenziehen und auf der Bank fixieren", "Füße fest am Boden, leichte Spannung im Rücken", "Ellbogen etwa 45° zum Körper"],
    mistakes: ["Stange am Hals absetzen", "Gesäß von der Bank heben", "Ellbogen weit nach außen flaren"],
    aliases: ["Flachbankdrücken", "Bench"], alt: ["dumbbell-bench-press", "machine-chest-press", "smith-machine-bench-press"],
  }),
  ex("dumbbell-bench-press", "Bankdrücken mit Kurzhanteln", "Dumbbell Bench Press", {
    cat: "compound", mp: "horizontal_push", eq: ["dumbbell", "bench"], load: "free_weight", p: ["chest"], s: ["triceps", "shoulders"],
    desc: "Größerer Bewegungsumfang als mit der Langhantel und gleicht Seitenunterschiede aus.",
    cues: ["Hanteln auf Brusthöhe, Handgelenke gerade", "Oben nicht zusammenschlagen, Spannung halten"],
    mistakes: ["Zu tief absenken ohne Kontrolle", "Hanteln vorne über das Gesicht drücken"],
    alt: ["barbell-bench-press", "machine-chest-press", "push-up"],
  }),
  ex("incline-barbell-bench-press", "Schrägbankdrücken mit Langhantel", "Incline Barbell Bench Press", {
    cat: "compound", mp: "horizontal_push", eq: ["barbell", "bench"], load: "free_weight", diff: "intermediate", p: ["chest"], s: ["shoulders", "triceps"],
    desc: "Betont die obere Brust. Bank auf 30–45° stellen.",
    cues: ["Stange zum oberen Brustbereich senken", "Unterarme senkrecht halten"], mistakes: ["Bank zu steil – wird zur Schulterübung"],
    aliases: ["Incline Bench"], alt: ["incline-dumbbell-bench-press", "incline-machine-chest-press"],
  }),
  ex("incline-dumbbell-bench-press", "Schrägbankdrücken mit Kurzhanteln", "Incline Dumbbell Bench Press", {
    cat: "compound", mp: "horizontal_push", eq: ["dumbbell", "bench"], load: "free_weight", p: ["chest"], s: ["shoulders", "triceps"],
    desc: "Obere Brust mit freiem Bewegungsweg der Kurzhanteln.",
    cues: ["Ellbogen leicht unter Schulterhöhe", "Kontrolliert strecken, oben kurz halten"], alt: ["incline-barbell-bench-press", "incline-machine-chest-press"],
  }),
  ex("decline-barbell-bench-press", "Negativbankdrücken", "Decline Barbell Bench Press", {
    cat: "compound", mp: "horizontal_push", eq: ["barbell", "bench"], load: "free_weight", diff: "intermediate", p: ["chest"], s: ["triceps"],
    desc: "Betont die untere Brust auf der negativ geneigten Bank.", alt: ["chest-dip", "barbell-bench-press"],
  }),
  ex("machine-chest-press", "Brustpresse", "Machine Chest Press", {
    cat: "compound", mp: "horizontal_push", eq: ["machine"], load: "machine", p: ["chest"], s: ["triceps", "shoulders"],
    desc: "Geführte Druckbewegung, ideal zum sicheren Ausbelasten ohne Spotter.",
    cues: ["Sitz so einstellen, dass die Griffe auf Brusthöhe sind", "Schultern unten halten"], alt: ["barbell-bench-press", "dumbbell-bench-press"],
  }),
  ex("incline-machine-chest-press", "Schräg-Brustpresse", "Incline Machine Chest Press", {
    cat: "compound", mp: "horizontal_push", eq: ["machine"], load: "machine", p: ["chest"], s: ["shoulders", "triceps"],
    desc: "Geführtes Schrägdrücken für die obere Brust.", alt: ["incline-dumbbell-bench-press"],
  }),
  ex("smith-machine-bench-press", "Bankdrücken an der Multipresse", "Smith Machine Bench Press", {
    cat: "compound", mp: "horizontal_push", eq: ["smith_machine", "bench"], load: "machine", p: ["chest"], s: ["triceps", "shoulders"],
    desc: "Bankdrücken mit geführter Stange; Bank so platzieren, dass die Stange die untere Brust trifft.", alt: ["barbell-bench-press", "machine-chest-press"],
  }),
  ex("cable-fly", "Kabel-Flys", "Cable Fly", {
    cat: "isolation", mp: "shoulder_horizontal_adduction", eq: ["cable"], load: "cable", p: ["chest"], s: ["shoulders"],
    desc: "Konstante Spannung über den gesamten Bewegungsweg, Hände vor der Brust zusammenführen.",
    cues: ["Leichte Beugung im Ellbogen fixieren", "Brust rausstrecken, Schultern hinten"], mistakes: ["Aus dem Ellbogen drücken statt aus der Schulter"],
    aliases: ["Cable Crossover"], alt: ["pec-deck", "dumbbell-fly"],
  }),
  ex("low-to-high-cable-fly", "Kabel-Flys von unten nach oben", "Low-to-High Cable Fly", {
    cat: "isolation", mp: "shoulder_horizontal_adduction", eq: ["cable"], load: "cable", p: ["chest"], s: ["shoulders"],
    desc: "Betont die obere Brust: Rollen unten einstellen und schräg nach oben zusammenführen.", alt: ["cable-fly", "incline-dumbbell-fly"],
  }),
  ex("high-to-low-cable-fly", "Kabel-Flys von oben nach unten", "High-to-Low Cable Fly", {
    cat: "isolation", mp: "shoulder_horizontal_adduction", eq: ["cable"], load: "cable", p: ["chest"],
    desc: "Betont die untere Brust: Rollen oben, Hände vor der Hüfte zusammenführen.", alt: ["cable-fly", "chest-dip"],
  }),
  ex("pec-deck", "Butterfly", "Pec Deck", {
    cat: "isolation", mp: "shoulder_horizontal_adduction", eq: ["machine"], load: "machine", p: ["chest"],
    desc: "Geführte Fly-Bewegung an der Maschine; gut, um die Brust gezielt zu ermüden.", aliases: ["Butterfly-Maschine"], alt: ["cable-fly", "dumbbell-fly"],
  }),
  ex("dumbbell-fly", "Kurzhantel-Flys", "Dumbbell Fly", {
    cat: "isolation", mp: "shoulder_horizontal_adduction", eq: ["dumbbell", "bench"], load: "free_weight", diff: "intermediate", p: ["chest"],
    desc: "Dehnung in der Brust im unteren Bereich, oben nicht komplett zusammenführen.", mistakes: ["Zu schwer und zu tief – Schulterbelastung"], alt: ["cable-fly", "pec-deck"],
  }),
  ex("incline-dumbbell-fly", "Schrägbank-Flys", "Incline Dumbbell Fly", {
    cat: "isolation", mp: "shoulder_horizontal_adduction", eq: ["dumbbell", "bench"], load: "free_weight", diff: "intermediate", p: ["chest"],
    desc: "Flys auf der Schrägbank für die obere Brust.", alt: ["low-to-high-cable-fly"],
  }),
  ex("push-up", "Liegestütze", "Push-Up", {
    cat: "compound", mp: "horizontal_push", eq: ["bodyweight"], load: "bodyweight", p: ["chest"], s: ["triceps", "shoulders", "abs"],
    desc: "Körper als gerade Linie, Hände etwas breiter als schulterbreit, Brust fast bis zum Boden.",
    cues: ["Rumpf fest, Hüfte nicht durchhängen lassen", "Ellbogen zeigen nach hinten-außen"], alt: ["dumbbell-bench-press", "machine-chest-press"],
  }),
  ex("deficit-push-up", "Liegestütze mit Griffen", "Deficit Push-Up", {
    cat: "compound", mp: "horizontal_push", eq: ["bodyweight"], load: "bodyweight", diff: "intermediate", p: ["chest"], s: ["triceps", "shoulders"],
    desc: "Liegestütze auf Griffen oder Hanteln für mehr Bewegungsumfang und Dehnung.", alt: ["push-up"],
  }),
  ex("chest-dip", "Dips (Brustfokus)", "Chest Dip", {
    cat: "compound", mp: "horizontal_push", eq: ["dip_station"], load: "bodyweight", diff: "intermediate", p: ["chest"], s: ["triceps", "shoulders"],
    desc: "Oberkörper nach vorne lehnen, Ellbogen leicht nach außen, tief absenken bis die Brust dehnt.",
    cues: ["Nach vorne lehnen für mehr Brust", "Schultern nicht nach vorne fallen lassen"], alt: ["decline-barbell-bench-press", "high-to-low-cable-fly", "assisted-dip"],
  }),
  ex("dumbbell-pullover", "Überzüge mit Kurzhantel", "Dumbbell Pullover", {
    cat: "isolation", mp: "shoulder_flexion", eq: ["dumbbell", "bench"], load: "free_weight", diff: "intermediate", p: ["chest"], s: ["back"],
    desc: "Hantel mit leicht gebeugten Armen hinter den Kopf senken; dehnt Brust und Latissimus.", alt: ["cable-pullover"],
  }),
]

export const BACK = [
  ex("pull-up", "Klimmzüge", "Pull-Up", {
    cat: "compound", mp: "vertical_pull", eq: ["pull_up_bar"], load: "bodyweight", diff: "intermediate", p: ["back"], s: ["biceps", "forearms"],
    desc: "Obergriff, etwas breiter als schulterbreit. Aus dem hängenden Zustand bis das Kinn über der Stange ist.",
    cues: ["Schulterblätter zuerst nach unten ziehen", "Brust zur Stange, Ellbogen zur Hüfte"], mistakes: ["Schwung aus der Hüfte", "Halbe Wiederholungen"],
    alt: ["lat-pulldown", "chin-up", "neutral-grip-pull-up"],
  }),
  ex("chin-up", "Klimmzüge im Untergriff", "Chin-Up", {
    cat: "compound", mp: "vertical_pull", eq: ["pull_up_bar"], load: "bodyweight", diff: "intermediate", p: ["back"], s: ["biceps", "forearms"],
    desc: "Untergriff, schulterbreit. Mehr Bizepsbeteiligung als der klassische Klimmzug.", alt: ["pull-up", "close-grip-lat-pulldown"],
  }),
  ex("neutral-grip-pull-up", "Klimmzüge im neutralen Griff", "Neutral-Grip Pull-Up", {
    cat: "compound", mp: "vertical_pull", eq: ["pull_up_bar"], load: "bodyweight", diff: "intermediate", p: ["back"], s: ["biceps", "forearms"],
    desc: "Parallelgriff, schonend für Schultern und Ellbogen.", alt: ["pull-up", "neutral-grip-lat-pulldown"],
  }),
  ex("assisted-pull-up", "Klimmzüge an der Maschine (unterstützt)", "Assisted Pull-Up", {
    cat: "compound", mp: "vertical_pull", eq: ["machine"], load: "assisted", p: ["back"], s: ["biceps"],
    desc: "Klimmzug mit Gegengewicht an der Maschine – ideal, um sich an freie Klimmzüge heranzuarbeiten. Eingetragen wird die Unterstützung: weniger Gewicht heißt mehr Eigenleistung.", alt: ["lat-pulldown", "pull-up"],
  }),
  ex("lat-pulldown", "Latzug", "Lat Pulldown", {
    cat: "compound", mp: "vertical_pull", eq: ["cable"], load: "cable", p: ["back"], s: ["biceps", "forearms"],
    desc: "Breiter Obergriff, Stange zur oberen Brust ziehen, Oberkörper leicht zurückgelehnt.",
    cues: ["Ellbogen nach unten und hinten", "Oben vollständig strecken und Schultern dehnen lassen"], mistakes: ["Stange hinter den Nacken ziehen", "Zu viel Rücklage"],
    aliases: ["Latziehen"], alt: ["pull-up", "close-grip-lat-pulldown", "assisted-pull-up"],
  }),
  ex("close-grip-lat-pulldown", "Enger Latzug", "Close-Grip Lat Pulldown", {
    cat: "compound", mp: "vertical_pull", eq: ["cable"], load: "cable", p: ["back"], s: ["biceps"],
    desc: "Enger Untergriff oder V-Griff; stärkere Dehnung des Latissimus im oberen Bereich.", alt: ["lat-pulldown", "chin-up"],
  }),
  ex("neutral-grip-lat-pulldown", "Latzug im neutralen Griff", "Neutral-Grip Lat Pulldown", {
    cat: "compound", mp: "vertical_pull", eq: ["cable"], load: "cable", p: ["back"], s: ["biceps"],
    desc: "Parallelgriff, schulterschonend und gut für die Lat-Kontraktion.", alt: ["lat-pulldown", "neutral-grip-pull-up"],
  }),
  ex("single-arm-lat-pulldown", "Einarmiger Latzug", "Single-Arm Lat Pulldown", {
    cat: "compound", mp: "vertical_pull", eq: ["cable"], load: "cable", uni: true, p: ["back"], s: ["biceps"],
    desc: "Einseitig am Kabel, mit leichter Seitneigung für maximale Lat-Kontraktion.", alt: ["lat-pulldown"],
  }),
  ex("seated-cable-row", "Sitzendes Kabelrudern", "Seated Cable Row", {
    cat: "compound", mp: "horizontal_pull", eq: ["cable"], load: "cable", p: ["back"], s: ["biceps", "forearms"],
    desc: "V-Griff zum Bauch ziehen, Oberkörper aufrecht und stabil.",
    cues: ["Brust raus, Schultern hinten-unten", "Griff zum Bauchnabel"], mistakes: ["Oberkörper schwingt mit"], aliases: ["Rudern am Kabelzug"],
    alt: ["chest-supported-row", "machine-row", "barbell-row"],
  }),
  ex("wide-grip-seated-cable-row", "Kabelrudern mit breitem Griff", "Wide-Grip Seated Cable Row", {
    cat: "compound", mp: "horizontal_pull", eq: ["cable"], load: "cable", p: ["back"], s: ["shoulders", "biceps"],
    desc: "Breiter Obergriff, Ellbogen hoch; betont oberen Rücken und hintere Schulter.", alt: ["seated-cable-row", "face-pull"],
  }),
  ex("chest-supported-row", "Brustgestütztes Rudern", "Chest-Supported Row", {
    cat: "compound", mp: "horizontal_pull", eq: ["machine"], load: "machine", p: ["back"], s: ["biceps"],
    desc: "Rudern mit Brustauflage – kein Schwung möglich, der untere Rücken wird entlastet.", alt: ["seated-cable-row", "incline-dumbbell-row"],
  }),
  ex("machine-row", "Rudermaschine", "Machine Row", {
    cat: "compound", mp: "horizontal_pull", eq: ["machine"], load: "machine", p: ["back"], s: ["biceps"],
    desc: "Geführtes Rudern an der Maschine mit unabhängigen Griffen.", alt: ["chest-supported-row", "seated-cable-row"],
  }),
  ex("incline-dumbbell-row", "Kurzhantelrudern auf der Schrägbank", "Incline Dumbbell Row", {
    cat: "compound", mp: "horizontal_pull", eq: ["dumbbell", "bench"], load: "free_weight", p: ["back"], s: ["biceps"],
    desc: "Bauchlings auf der Schrägbank, Hanteln beidseitig zur Hüfte ziehen.", alt: ["chest-supported-row", "dumbbell-row"],
  }),
  ex("barbell-row", "Langhantelrudern", "Barbell Row", {
    cat: "compound", mp: "horizontal_pull", eq: ["barbell"], load: "free_weight", diff: "intermediate", p: ["back"], s: ["biceps", "lower_back", "hamstrings"],
    desc: "Oberkörper etwa 45° vorgebeugt, Stange zum unteren Bauch ziehen.",
    cues: ["Rücken neutral halten", "Ellbogen nah am Körper"], mistakes: ["Rundrücken", "Aufrichten bei jeder Wiederholung"],
    alt: ["pendlay-row", "t-bar-row", "chest-supported-row"],
  }),
  ex("pendlay-row", "Pendlay Row", "Pendlay Row", {
    cat: "compound", mp: "horizontal_pull", eq: ["barbell"], load: "free_weight", diff: "advanced", p: ["back"], s: ["biceps", "lower_back"],
    desc: "Rudern aus dem toten Punkt am Boden, Oberkörper parallel zum Boden.", alt: ["barbell-row", "t-bar-row"],
  }),
  ex("dumbbell-row", "Kurzhantelrudern einarmig", "Single-Arm Dumbbell Row", {
    cat: "compound", mp: "horizontal_pull", eq: ["dumbbell", "bench"], load: "free_weight", uni: true, p: ["back"], s: ["biceps"],
    desc: "Eine Hand und ein Knie auf der Bank, Hantel zur Hüfte ziehen.",
    cues: ["Schulterblatt zuerst zurückziehen", "Nicht aus dem Rumpf drehen"], alt: ["incline-dumbbell-row", "seated-cable-row"],
  }),
  ex("t-bar-row", "T-Bar-Rudern", "T-Bar Row", {
    cat: "compound", mp: "horizontal_pull", eq: ["barbell"], load: "free_weight", diff: "intermediate", p: ["back"], s: ["biceps", "lower_back"],
    desc: "Rudern an der Landmine oder T-Bar-Station mit engem Griff.", alt: ["barbell-row", "chest-supported-row"],
  }),
  ex("meadows-row", "Meadows Row", "Meadows Row", {
    cat: "compound", mp: "horizontal_pull", eq: ["barbell"], load: "free_weight", diff: "advanced", uni: true, p: ["back"], s: ["biceps"],
    desc: "Einarmiges Rudern quer zur Landmine-Stange mit Obergriff.", alt: ["dumbbell-row", "t-bar-row"],
  }),
  ex("inverted-row", "Umgekehrtes Rudern", "Inverted Row", {
    cat: "compound", mp: "horizontal_pull", eq: ["barbell", "bodyweight"], load: "bodyweight", p: ["back"], s: ["biceps", "abs"],
    desc: "Rudern mit dem eigenen Körpergewicht an einer tief gehängten Stange.", alt: ["seated-cable-row", "dumbbell-row"],
  }),
  ex("straight-arm-pulldown", "Straight-Arm Pulldown", "Straight-Arm Pulldown", {
    cat: "isolation", mp: "shoulder_flexion", eq: ["cable"], load: "cable", p: ["back"], s: ["triceps"],
    desc: "Mit gestreckten Armen die Stange am Kabelzug bis zur Hüfte führen; isoliert den Latissimus.", alt: ["cable-pullover", "dumbbell-pullover"],
  }),
  ex("cable-pullover", "Überzüge am Kabelzug", "Cable Pullover", {
    cat: "isolation", mp: "shoulder_flexion", eq: ["cable", "bench"], load: "cable", diff: "intermediate", p: ["back"], s: ["chest"],
    desc: "Überzüge am Kabel für konstante Spannung auf dem Latissimus.", alt: ["straight-arm-pulldown"],
  }),
  ex("rack-pull", "Rack Pulls", "Rack Pull", {
    cat: "compound", mp: "hinge", eq: ["barbell"], load: "free_weight", diff: "intermediate", p: ["back"], s: ["lower_back", "glutes", "forearms"],
    desc: "Verkürztes Kreuzheben aus dem Rack ab Kniehöhe; viel Last für oberen Rücken und Griff.", alt: ["conventional-deadlift", "barbell-shrug"],
  }),
  ex("barbell-shrug", "Shrugs mit Langhantel", "Barbell Shrug", {
    cat: "isolation", mp: "shoulder_flexion", eq: ["barbell"], load: "free_weight", p: ["back"], s: ["forearms"],
    desc: "Schultern gerade nach oben ziehen, kurz halten, kontrolliert ablassen. Trainiert den Trapezius.", alt: ["dumbbell-shrug"],
  }),
  ex("dumbbell-shrug", "Shrugs mit Kurzhanteln", "Dumbbell Shrug", {
    cat: "isolation", mp: "shoulder_flexion", eq: ["dumbbell"], load: "free_weight", p: ["back"], s: ["forearms"],
    desc: "Shrugs mit Kurzhanteln seitlich am Körper.", alt: ["barbell-shrug"],
  }),
]
