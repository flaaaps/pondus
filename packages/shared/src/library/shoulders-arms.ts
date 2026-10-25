import { ex } from "./types"

export const SHOULDERS = [
  ex("seated-dumbbell-shoulder-press", "Schulterdrücken mit Kurzhanteln", "Seated Dumbbell Shoulder Press", {
    cat: "compound", mp: "vertical_push", eq: ["dumbbell", "bench"], load: "free_weight", p: ["shoulders"], s: ["triceps"],
    desc: "Sitzend mit Rückenlehne, Hanteln von Schulterhöhe nach oben drücken, oben nicht zusammenschlagen.",
    cues: ["Unterarme senkrecht", "Rumpf fest, kein Hohlkreuz"], mistakes: ["Zu tief absenken mit nach vorne kippenden Schultern"],
    alt: ["machine-shoulder-press", "barbell-overhead-press", "arnold-press"],
  }),
  ex("barbell-overhead-press", "Schulterdrücken mit Langhantel", "Barbell Overhead Press", {
    cat: "compound", mp: "vertical_push", eq: ["barbell"], load: "free_weight", diff: "intermediate", p: ["shoulders"], s: ["triceps", "abs"],
    desc: "Stehend, Stange vom oberen Brustbereich über den Kopf drücken, Kopf am Ende leicht nach vorne.",
    cues: ["Gesäß und Bauch anspannen", "Stange in gerader Linie, Kopf kurz zurücknehmen"], mistakes: ["Hohlkreuz", "Stange vor dem Körper drücken"],
    aliases: ["Military Press", "OHP"], alt: ["seated-dumbbell-shoulder-press", "machine-shoulder-press", "push-press"],
  }),
  ex("machine-shoulder-press", "Schulterpresse an der Maschine", "Machine Shoulder Press", {
    cat: "compound", mp: "vertical_push", eq: ["machine"], load: "machine", p: ["shoulders"], s: ["triceps"],
    desc: "Geführtes Schulterdrücken – sicher und gut zum Ausbelasten.", alt: ["seated-dumbbell-shoulder-press", "smith-machine-shoulder-press"],
  }),
  ex("smith-machine-shoulder-press", "Schulterdrücken an der Multipresse", "Smith Machine Shoulder Press", {
    cat: "compound", mp: "vertical_push", eq: ["smith_machine", "bench"], load: "machine", p: ["shoulders"], s: ["triceps"],
    desc: "Sitzendes Schulterdrücken mit geführter Stange.", alt: ["machine-shoulder-press", "barbell-overhead-press"],
  }),
  ex("arnold-press", "Arnold Press", "Arnold Press", {
    cat: "compound", mp: "vertical_push", eq: ["dumbbell", "bench"], load: "free_weight", diff: "intermediate", p: ["shoulders"], s: ["triceps"],
    desc: "Schulterdrücken mit Drehung der Hanteln von supiniert zu proniert – trifft auch die vordere Schulter stark.", alt: ["seated-dumbbell-shoulder-press"],
  }),
  ex("push-press", "Push Press", "Push Press", {
    cat: "compound", mp: "vertical_push", eq: ["barbell"], load: "free_weight", diff: "advanced", p: ["shoulders"], s: ["triceps", "quads", "glutes"],
    desc: "Überkopfdrücken mit kurzem Beinimpuls; erlaubt schwerere Lasten und exzentrische Überlastung.", alt: ["barbell-overhead-press"],
  }),
  ex("landmine-press", "Landmine Press", "Landmine Press", {
    cat: "compound", mp: "vertical_push", eq: ["barbell"], load: "free_weight", uni: true, p: ["shoulders"], s: ["chest", "triceps", "abs"],
    desc: "Einarmiges Drücken der Landmine-Stange schräg nach oben; schulterfreundlicher Winkel.", alt: ["seated-dumbbell-shoulder-press"],
  }),
  ex("dumbbell-lateral-raise", "Seitheben mit Kurzhanteln", "Dumbbell Lateral Raise", {
    cat: "isolation", mp: "shoulder_abduction", eq: ["dumbbell"], load: "free_weight", p: ["shoulders"],
    desc: "Arme seitlich bis auf Schulterhöhe heben, Ellbogen leicht gebeugt, kleine Finger leicht nach oben.",
    cues: ["Aus der Schulter führen, nicht aus dem Nacken", "Kontrolliert absenken"], mistakes: ["Schwung aus den Beinen", "Über Schulterhöhe heben"],
    alt: ["cable-lateral-raise", "machine-lateral-raise"],
  }),
  ex("seated-dumbbell-lateral-raise", "Seitheben sitzend", "Seated Dumbbell Lateral Raise", {
    cat: "isolation", mp: "shoulder_abduction", eq: ["dumbbell", "bench"], load: "free_weight", p: ["shoulders"],
    desc: "Seitheben im Sitzen – verhindert Schwung aus den Beinen.", alt: ["dumbbell-lateral-raise", "cable-lateral-raise"],
  }),
  ex("cable-lateral-raise", "Seitheben am Kabel", "Cable Lateral Raise", {
    cat: "isolation", mp: "shoulder_abduction", eq: ["cable"], load: "cable", uni: true, p: ["shoulders"],
    desc: "Einarmig am tiefen Kabelzug, Kabel vor oder hinter dem Körper – gleichmäßige Spannung über den ganzen Weg.", alt: ["dumbbell-lateral-raise", "machine-lateral-raise"],
  }),
  ex("machine-lateral-raise", "Seitheben an der Maschine", "Machine Lateral Raise", {
    cat: "isolation", mp: "shoulder_abduction", eq: ["machine"], load: "machine", p: ["shoulders"],
    desc: "Geführtes Seitheben, Pads auf Oberarmhöhe.", alt: ["cable-lateral-raise", "dumbbell-lateral-raise"],
  }),
  ex("dumbbell-rear-delt-fly", "Reverse Flys mit Kurzhanteln", "Dumbbell Rear Delt Fly", {
    cat: "isolation", mp: "shoulder_horizontal_abduction", eq: ["dumbbell"], load: "free_weight", p: ["shoulders"], s: ["back"],
    desc: "Vorgebeugt oder bäuchlings auf der Schrägbank, Hanteln seitlich nach hinten-oben führen für die hintere Schulter.",
    aliases: ["Vorgebeugtes Seitheben"], alt: ["reverse-pec-deck", "face-pull"],
  }),
  ex("reverse-pec-deck", "Reverse Butterfly", "Reverse Pec Deck", {
    cat: "isolation", mp: "shoulder_horizontal_abduction", eq: ["machine"], load: "machine", p: ["shoulders"], s: ["back"],
    desc: "Umgekehrter Butterfly für die hintere Schulter und den oberen Rücken.", aliases: ["Reverse Fly Maschine"], alt: ["dumbbell-rear-delt-fly", "face-pull"],
  }),
  ex("face-pull", "Face Pulls", "Face Pull", {
    cat: "isolation", mp: "shoulder_horizontal_abduction", eq: ["cable"], load: "cable", p: ["shoulders"], s: ["back"],
    desc: "Seil auf Gesichtshöhe zum Gesicht ziehen und die Hände am Ende nach außen rotieren. Wichtig für gesunde Schultern.",
    cues: ["Ellbogen hoch und weit", "Am Ende Daumen nach hinten"], alt: ["reverse-pec-deck", "dumbbell-rear-delt-fly"],
  }),
  ex("dumbbell-front-raise", "Frontheben mit Kurzhanteln", "Dumbbell Front Raise", {
    cat: "isolation", mp: "shoulder_flexion", eq: ["dumbbell"], load: "free_weight", p: ["shoulders"],
    desc: "Hanteln vor dem Körper bis auf Schulterhöhe heben; isoliert die vordere Schulter.", alt: ["cable-front-raise", "plate-front-raise"],
  }),
  ex("cable-front-raise", "Frontheben am Kabel", "Cable Front Raise", {
    cat: "isolation", mp: "shoulder_flexion", eq: ["cable"], load: "cable", p: ["shoulders"],
    desc: "Frontheben am tiefen Kabelzug mit konstanter Spannung.", alt: ["dumbbell-front-raise"],
  }),
  ex("plate-front-raise", "Frontheben mit Scheibe", "Plate Front Raise", {
    cat: "isolation", mp: "shoulder_flexion", eq: ["plate"], load: "free_weight", p: ["shoulders"],
    desc: "Hantelscheibe mit beiden Händen vor dem Körper anheben.", alt: ["dumbbell-front-raise"],
  }),
  ex("upright-row", "Aufrechtes Rudern", "Upright Row", {
    cat: "compound", mp: "shoulder_abduction", eq: ["barbell"], load: "free_weight", diff: "intermediate", p: ["shoulders"], s: ["back", "biceps"],
    desc: "Stange eng vor dem Körper bis zur Brust ziehen, Ellbogen führen. Breiter Griff ist schulterfreundlicher.", alt: ["dumbbell-lateral-raise", "cable-upright-row"],
  }),
  ex("cable-upright-row", "Aufrechtes Rudern am Kabel", "Cable Upright Row", {
    cat: "compound", mp: "shoulder_abduction", eq: ["cable"], load: "cable", diff: "intermediate", p: ["shoulders"], s: ["back"],
    desc: "Aufrechtes Rudern mit Seil oder Stange am Kabelzug.", alt: ["upright-row"],
  }),
]

export const BICEPS = [
  ex("dumbbell-curl", "Bizepscurls mit Kurzhanteln", "Dumbbell Curl", {
    cat: "isolation", mp: "elbow_flexion", eq: ["dumbbell"], load: "free_weight", p: ["biceps"], s: ["forearms"],
    desc: "Stehend oder sitzend, Hanteln mit Supination nach oben curlen, Ellbogen bleiben am Körper.",
    cues: ["Oberarme fixieren", "Oben Handflächen nach oben drehen"], mistakes: ["Schwung aus dem Oberkörper"], alt: ["barbell-curl", "cable-curl", "hammer-curl"],
  }),
  ex("barbell-curl", "Langhantelcurls", "Barbell Curl", {
    cat: "isolation", mp: "elbow_flexion", eq: ["barbell"], load: "free_weight", p: ["biceps"], s: ["forearms"],
    desc: "Schulterbreiter Untergriff, Stange kontrolliert curlen und vollständig ablassen.", alt: ["ez-bar-curl", "dumbbell-curl"],
  }),
  ex("ez-bar-curl", "SZ-Curls", "EZ-Bar Curl", {
    cat: "isolation", mp: "elbow_flexion", eq: ["ez_bar"], load: "free_weight", p: ["biceps"], s: ["forearms"],
    desc: "Curls mit der SZ-Stange, handgelenkschonender als die gerade Stange.", alt: ["barbell-curl", "dumbbell-curl"],
  }),
  ex("hammer-curl", "Hammercurls", "Hammer Curl", {
    cat: "isolation", mp: "elbow_flexion", eq: ["dumbbell"], load: "free_weight", p: ["biceps"], s: ["forearms"],
    desc: "Neutraler Griff (Daumen oben), trainiert Brachialis und Unterarme mit.", alt: ["rope-hammer-curl", "dumbbell-curl"],
  }),
  ex("rope-hammer-curl", "Hammercurls am Kabel", "Rope Hammer Curl", {
    cat: "isolation", mp: "elbow_flexion", eq: ["cable"], load: "cable", p: ["biceps"], s: ["forearms"],
    desc: "Hammercurls mit dem Seil am tiefen Kabelzug.", alt: ["hammer-curl"],
  }),
  ex("incline-dumbbell-curl", "Incline Curls", "Incline Dumbbell Curl", {
    cat: "isolation", mp: "elbow_flexion", eq: ["dumbbell", "bench"], load: "free_weight", diff: "intermediate", p: ["biceps"],
    desc: "Auf der Schrägbank mit hängenden Armen; starke Dehnung des langen Bizepskopfs.", alt: ["bayesian-cable-curl", "dumbbell-curl"],
  }),
  ex("cable-curl", "Kabelcurls", "Cable Curl", {
    cat: "isolation", mp: "elbow_flexion", eq: ["cable"], load: "cable", p: ["biceps"], s: ["forearms"],
    desc: "Curls am tiefen Kabelzug mit gerader oder SZ-Stange – konstante Spannung.", alt: ["barbell-curl", "dumbbell-curl"],
  }),
  ex("bayesian-cable-curl", "Bayesian Curls", "Bayesian Cable Curl", {
    cat: "isolation", mp: "elbow_flexion", eq: ["cable"], load: "cable", diff: "intermediate", uni: true, p: ["biceps"],
    desc: "Einarmige Kabelcurls mit dem Arm hinter dem Körper – Dehnung in der Startposition.", alt: ["incline-dumbbell-curl"],
  }),
  ex("preacher-curl", "Preacher Curls", "Preacher Curl", {
    cat: "isolation", mp: "elbow_flexion", eq: ["ez_bar", "bench"], load: "free_weight", p: ["biceps"],
    desc: "Curls auf dem Scott-Pult; verhindert Schwung und betont den unteren Teil der Bewegung.", aliases: ["Scott Curls"], alt: ["machine-preacher-curl", "concentration-curl"],
  }),
  ex("machine-preacher-curl", "Bizepsmaschine", "Machine Preacher Curl", {
    cat: "isolation", mp: "elbow_flexion", eq: ["machine"], load: "machine", p: ["biceps"],
    desc: "Geführte Curls an der Bizepsmaschine.", alt: ["preacher-curl", "cable-curl"],
  }),
  ex("concentration-curl", "Konzentrationscurls", "Concentration Curl", {
    cat: "isolation", mp: "elbow_flexion", eq: ["dumbbell", "bench"], load: "free_weight", uni: true, p: ["biceps"],
    desc: "Sitzend, Ellbogen an der Oberschenkelinnenseite abgestützt, einarmig curlen.", alt: ["preacher-curl", "dumbbell-curl"],
  }),
  ex("spider-curl", "Spider Curls", "Spider Curl", {
    cat: "isolation", mp: "elbow_flexion", eq: ["dumbbell", "bench"], load: "free_weight", diff: "intermediate", p: ["biceps"],
    desc: "Bäuchlings auf der Schrägbank, Arme hängen senkrecht – maximale Kontraktion oben.", alt: ["preacher-curl"],
  }),
]

export const TRICEPS = [
  ex("cable-pushdown", "Trizepsdrücken am Kabel", "Cable Pushdown", {
    cat: "isolation", mp: "elbow_extension", eq: ["cable"], load: "cable", p: ["triceps"],
    desc: "Stange am hohen Kabelzug nach unten drücken, Ellbogen bleiben am Körper fixiert.",
    cues: ["Oberarme ruhig", "Unten vollständig strecken"], mistakes: ["Schultern drücken mit", "Ellbogen wandern nach vorne"],
    alt: ["rope-pushdown", "machine-triceps-extension"],
  }),
  ex("rope-pushdown", "Trizepsdrücken mit Seil", "Rope Pushdown", {
    cat: "isolation", mp: "elbow_extension", eq: ["cable"], load: "cable", p: ["triceps"],
    desc: "Seil nach unten drücken und am Ende die Hände auseinanderziehen.", alt: ["cable-pushdown", "single-arm-cable-pushdown"],
  }),
  ex("single-arm-cable-pushdown", "Einarmiges Trizepsdrücken", "Single-Arm Cable Pushdown", {
    cat: "isolation", mp: "elbow_extension", eq: ["cable"], load: "cable", uni: true, p: ["triceps"],
    desc: "Einarmig am Kabel, Untergriff oder neutral – gleicht Seitenunterschiede aus.", alt: ["rope-pushdown"],
  }),
  ex("overhead-cable-triceps-extension", "Überkopf-Trizepsstrecken am Kabel", "Overhead Cable Triceps Extension", {
    cat: "isolation", mp: "elbow_extension", eq: ["cable"], load: "cable", p: ["triceps"],
    desc: "Seil über dem Kopf nach vorne strecken; trainiert den langen Trizepskopf in Dehnung.", alt: ["overhead-dumbbell-triceps-extension", "skull-crusher"],
  }),
  ex("overhead-dumbbell-triceps-extension", "Überkopf-Trizepsstrecken mit Kurzhantel", "Overhead Dumbbell Triceps Extension", {
    cat: "isolation", mp: "elbow_extension", eq: ["dumbbell"], load: "free_weight", p: ["triceps"],
    desc: "Eine Kurzhantel beidhändig hinter dem Kopf absenken und strecken.", alt: ["overhead-cable-triceps-extension"],
  }),
  ex("skull-crusher", "French Press", "Skull Crusher", {
    cat: "isolation", mp: "elbow_extension", eq: ["ez_bar", "bench"], load: "free_weight", diff: "intermediate", p: ["triceps"],
    desc: "Liegend die SZ-Stange zur Stirn oder hinter den Kopf senken, Oberarme bleiben leicht nach hinten geneigt.",
    aliases: ["Stirndrücken", "Lying Triceps Extension"], mistakes: ["Ellbogen flaren nach außen"], alt: ["overhead-cable-triceps-extension", "close-grip-bench-press"],
  }),
  ex("close-grip-bench-press", "Enges Bankdrücken", "Close-Grip Bench Press", {
    cat: "compound", mp: "horizontal_push", eq: ["barbell", "bench"], load: "free_weight", diff: "intermediate", p: ["triceps"], s: ["chest", "shoulders"],
    desc: "Bankdrücken mit schulterbreitem Griff, Ellbogen eng am Körper – schwere Grundübung für den Trizeps.", alt: ["triceps-dip", "skull-crusher"],
  }),
  ex("triceps-dip", "Dips (Trizepsfokus)", "Triceps Dip", {
    cat: "compound", mp: "vertical_push", eq: ["dip_station"], load: "bodyweight", diff: "intermediate", p: ["triceps"], s: ["chest", "shoulders"],
    desc: "Aufrechter Oberkörper, Ellbogen eng und nach hinten, bis die Oberarme parallel zum Boden sind.", alt: ["close-grip-bench-press", "machine-dip"],
  }),
  ex("machine-dip", "Dip-Maschine", "Machine Dip", {
    cat: "compound", mp: "vertical_push", eq: ["machine"], load: "machine", p: ["triceps"], s: ["chest"],
    desc: "Geführte Dips an der Maschine, gut dosierbar.", alt: ["triceps-dip", "cable-pushdown"],
  }),
  ex("machine-triceps-extension", "Trizepsmaschine", "Machine Triceps Extension", {
    cat: "isolation", mp: "elbow_extension", eq: ["machine"], load: "machine", p: ["triceps"],
    desc: "Geführtes Trizepsstrecken an der Maschine.", alt: ["cable-pushdown"],
  }),
  ex("dumbbell-kickback", "Kickbacks", "Dumbbell Kickback", {
    cat: "isolation", mp: "elbow_extension", eq: ["dumbbell"], load: "free_weight", uni: true, p: ["triceps"],
    desc: "Vorgebeugt, Oberarm parallel zum Boden, Unterarm nach hinten strecken.", alt: ["single-arm-cable-pushdown"],
  }),
  ex("diamond-push-up", "Enge Liegestütze", "Diamond Push-Up", {
    cat: "compound", mp: "horizontal_push", eq: ["bodyweight"], load: "bodyweight", diff: "intermediate", p: ["triceps"], s: ["chest", "shoulders"],
    desc: "Liegestütze mit Händen eng zusammen unter der Brust.", alt: ["push-up", "triceps-dip"],
  }),
]
