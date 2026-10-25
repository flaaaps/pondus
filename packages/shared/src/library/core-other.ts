import { ex } from "./types"

export const CORE = [
  ex("crunch", "Crunches", "Crunch", {
    cat: "core", mp: "trunk_flexion", eq: ["bodyweight"], load: "bodyweight", p: ["abs"],
    desc: "Rückenlage, Schulterblätter vom Boden rollen, unterer Rücken bleibt liegen.", mistakes: ["Am Nacken ziehen"], alt: ["cable-crunch", "machine-crunch"],
  }),
  ex("cable-crunch", "Kabel-Crunches", "Cable Crunch", {
    cat: "core", mp: "trunk_flexion", eq: ["cable"], load: "cable", p: ["abs"],
    desc: "Kniend das Seil am hohen Kabelzug halten und den Oberkörper einrollen – progressiv belastbare Bauchübung.", cues: ["Hüfte still, Bewegung aus der Wirbelsäule"], alt: ["machine-crunch", "decline-sit-up"],
  }),
  ex("machine-crunch", "Bauchmaschine", "Machine Crunch", {
    cat: "core", mp: "trunk_flexion", eq: ["machine"], load: "machine", p: ["abs"],
    desc: "Geführte Crunches mit einstellbarem Gewicht.", alt: ["cable-crunch", "crunch"],
  }),
  ex("decline-sit-up", "Sit-ups auf der Negativbank", "Decline Sit-Up", {
    cat: "core", mp: "trunk_flexion", eq: ["bench"], load: "bodyweight", diff: "intermediate", p: ["abs"],
    desc: "Sit-ups mit Gefälle, optional mit Scheibe vor der Brust.", alt: ["cable-crunch", "crunch"],
  }),
  ex("hanging-leg-raise", "Hanging Leg Raises", "Hanging Leg Raise", {
    cat: "core", mp: "trunk_flexion", eq: ["pull_up_bar"], load: "bodyweight", diff: "advanced", p: ["abs"], s: ["forearms"],
    desc: "Im Hang die gestreckten Beine anheben und das Becken einrollen.", mistakes: ["Schwingen", "Nur Hüftbeuger arbeiten"], alt: ["hanging-knee-raise", "captains-chair-leg-raise"],
  }),
  ex("hanging-knee-raise", "Hanging Knee Raises", "Hanging Knee Raise", {
    cat: "core", mp: "trunk_flexion", eq: ["pull_up_bar"], load: "bodyweight", diff: "intermediate", p: ["abs"], s: ["forearms"],
    desc: "Im Hang die Knie zur Brust ziehen und Becken einrollen – leichtere Variante des Beinhebens.", alt: ["hanging-leg-raise", "lying-leg-raise"],
  }),
  ex("captains-chair-leg-raise", "Beinheben am Captain's Chair", "Captain's Chair Leg Raise", {
    cat: "core", mp: "trunk_flexion", eq: ["machine"], load: "bodyweight", diff: "intermediate", p: ["abs"],
    desc: "Beinheben mit Unterarmen abgestützt – kein Griffkraftlimit.", alt: ["hanging-knee-raise"],
  }),
  ex("lying-leg-raise", "Beinheben liegend", "Lying Leg Raise", {
    cat: "core", mp: "trunk_flexion", eq: ["bodyweight"], load: "bodyweight", p: ["abs"],
    desc: "Rückenlage, gestreckte Beine anheben, unterer Rücken bleibt am Boden.", alt: ["hanging-knee-raise", "dead-bug"],
  }),
  ex("plank", "Plank", "Plank", {
    cat: "core", mp: "anti_extension", eq: ["bodyweight"], load: "bodyweight", p: ["abs"], s: ["shoulders", "glutes"],
    desc: "Unterarmstütz mit gerader Linie von Kopf bis Ferse, Gesäß angespannt.", aliases: ["Unterarmstütz"], alt: ["ab-wheel-rollout", "dead-bug"], setSeconds: 60,
  }),
  ex("side-plank", "Seitstütz", "Side Plank", {
    cat: "core", mp: "lateral_flexion", eq: ["bodyweight"], load: "bodyweight", uni: true, p: ["abs"], s: ["glutes"],
    desc: "Seitlicher Unterarmstütz, Hüfte hoch und stabil.", aliases: ["Side Plank"], alt: ["pallof-press"], setSeconds: 60,
  }),
  ex("ab-wheel-rollout", "Ab Wheel", "Ab Wheel Rollout", {
    cat: "core", mp: "anti_extension", eq: ["ab_wheel"], load: "bodyweight", diff: "advanced", p: ["abs"], s: ["back", "shoulders"],
    desc: "Kniend das Rad nach vorne rollen, Rumpf fest, Hohlkreuz vermeiden.", mistakes: ["Hüfte sackt durch"], alt: ["plank", "cable-crunch"],
  }),
  ex("pallof-press", "Pallof Press", "Pallof Press", {
    cat: "core", mp: "anti_rotation", eq: ["cable"], load: "cable", uni: true, p: ["abs"],
    desc: "Seitlich zum Kabelzug, Griff vor der Brust nach vorne strecken und der Rotation widerstehen.", alt: ["side-plank", "cable-woodchop"],
  }),
  ex("cable-woodchop", "Woodchops am Kabel", "Cable Woodchop", {
    cat: "core", mp: "anti_rotation", eq: ["cable"], load: "cable", uni: true, p: ["abs"],
    desc: "Diagonale Rotationsbewegung von oben nach unten mit stabiler Hüfte.", alt: ["pallof-press", "russian-twist"],
  }),
  ex("russian-twist", "Russian Twists", "Russian Twist", {
    cat: "core", mp: "anti_rotation", eq: ["bodyweight"], load: "bodyweight", p: ["abs"],
    desc: "Sitzend mit angehobenen Füßen den Oberkörper von Seite zu Seite drehen, optional mit Gewicht.", alt: ["cable-woodchop"],
  }),
  ex("dead-bug", "Dead Bug", "Dead Bug", {
    cat: "core", mp: "anti_extension", eq: ["bodyweight"], load: "bodyweight", p: ["abs"],
    desc: "Rückenlage, gegengleich Arm und Bein strecken, unterer Rücken bleibt am Boden gepresst.", alt: ["plank", "lying-leg-raise"],
  }),
  ex("bird-dog", "Bird Dog", "Bird Dog", {
    cat: "core", mp: "anti_rotation", eq: ["bodyweight"], load: "bodyweight", p: ["lower_back"], s: ["abs", "glutes"],
    desc: "Vierfüßlerstand, gegengleich Arm und Bein strecken, Becken ruhig halten.", alt: ["dead-bug", "back-extension"],
  }),
  ex("hollow-hold", "Hollow Hold", "Hollow Body Hold", {
    cat: "core", mp: "anti_extension", eq: ["bodyweight"], load: "bodyweight", diff: "intermediate", p: ["abs"],
    desc: "Rückenlage, Arme und Beine gestreckt leicht angehoben, unterer Rücken in den Boden gedrückt.", alt: ["plank", "dead-bug"], setSeconds: 45,
  }),
]

export const LOWER_BACK = [
  ex("back-extension", "Rückenstrecker", "Back Extension", {
    cat: "isolation", mp: "spinal_extension", eq: ["machine"], load: "bodyweight", p: ["lower_back"], s: ["glutes", "hamstrings"],
    desc: "Auf der Hyperextension-Bank den Oberkörper absenken und bis zur Körperlinie aufrichten; Gesäß anspannen.", aliases: ["Hyperextension"], mistakes: ["Überstrecken oben"], alt: ["forty-five-degree-hyperextension", "good-morning"],
  }),
  ex("forty-five-degree-hyperextension", "45°-Hyperextension", "45-Degree Hyperextension", {
    cat: "isolation", mp: "spinal_extension", eq: ["machine"], load: "bodyweight", p: ["lower_back", "glutes"], s: ["hamstrings"],
    desc: "Hyperextension auf der schrägen Bank; mit rundem Rücken mehr Gesäß, mit neutralem Rücken mehr unterer Rücken.", alt: ["back-extension"],
  }),
  ex("reverse-hyperextension", "Reverse Hyperextension", "Reverse Hyperextension", {
    cat: "isolation", mp: "hip_extension", eq: ["machine"], load: "machine", diff: "intermediate", p: ["glutes", "lower_back"], s: ["hamstrings"],
    desc: "Oberkörper auf der Bank, Beine nach hinten-oben schwingen; dekomprimiert die Lendenwirbelsäule.", alt: ["back-extension", "cable-glute-kickback"],
  }),
  ex("superman", "Superman", "Superman", {
    cat: "isolation", mp: "spinal_extension", eq: ["bodyweight"], load: "bodyweight", p: ["lower_back"], s: ["glutes"],
    desc: "Bauchlage, Arme und Beine gleichzeitig anheben und kurz halten.", alt: ["bird-dog", "back-extension"],
  }),
]

export const FOREARMS = [
  ex("reverse-curl", "Reverse Curls", "Reverse Curl", {
    cat: "isolation", mp: "elbow_flexion", eq: ["ez_bar"], load: "free_weight", p: ["forearms"], s: ["biceps"],
    desc: "Curls im Obergriff mit der SZ-Stange; trainiert Brachioradialis und Unterarmstrecker.", alt: ["hammer-curl", "wrist-extension-curl"],
  }),
  ex("wrist-curl", "Wrist Curls", "Wrist Curl", {
    cat: "isolation", mp: "wrist_flexion", eq: ["barbell", "bench"], load: "free_weight", p: ["forearms"],
    desc: "Unterarme auf der Bank, Handgelenke mit der Stange beugen.", alt: ["wrist-extension-curl", "dead-hang"],
  }),
  ex("wrist-extension-curl", "Reverse Wrist Curls", "Wrist Extension Curl", {
    cat: "isolation", mp: "wrist_extension", eq: ["dumbbell", "bench"], load: "free_weight", p: ["forearms"],
    desc: "Unterarme aufgelegt, Handrücken nach oben, Handgelenke gegen das Gewicht strecken.", alt: ["wrist-curl"],
  }),
  ex("farmers-walk", "Farmer’s Walk", "Farmer’s Walk", {
    cat: "compound", mp: "carry", eq: ["dumbbell"], load: "free_weight", p: ["forearms"], s: ["back", "abs", "calves"],
    desc: "Schwere Hanteln in beiden Händen tragen, aufrecht und mit festen Schultern gehen.", alt: ["dead-hang", "plate-pinch"], setSeconds: 60,
  }),
  ex("dead-hang", "Dead Hang", "Dead Hang", {
    cat: "isolation", mp: "grip", eq: ["pull_up_bar"], load: "bodyweight", p: ["forearms"], s: ["back", "shoulders"],
    desc: "Passiv oder aktiv an der Stange hängen – Griffkraft und Schulterdehnung.", alt: ["farmers-walk"], setSeconds: 45,
  }),
  ex("plate-pinch", "Plate Pinch", "Plate Pinch", {
    cat: "isolation", mp: "grip", eq: ["plate"], load: "free_weight", p: ["forearms"],
    desc: "Zwei Scheiben mit glatten Seiten nach außen zwischen Fingern und Daumen halten.", alt: ["dead-hang", "farmers-walk"], setSeconds: 45,
  }),
]

export const FULL_BODY = [
  ex("thruster", "Thruster", "Thruster", {
    cat: "compound", mp: "squat", eq: ["barbell"], load: "free_weight", diff: "advanced", p: ["quads", "shoulders"], s: ["glutes", "triceps", "abs"],
    desc: "Frontkniebeuge, die nahtlos in ein Überkopfdrücken übergeht.", alt: ["front-squat", "push-press"],
  }),
  ex("dumbbell-thruster", "Thruster mit Kurzhanteln", "Dumbbell Thruster", {
    cat: "compound", mp: "squat", eq: ["dumbbell"], load: "free_weight", diff: "intermediate", p: ["quads", "shoulders"], s: ["glutes", "triceps"],
    desc: "Thruster mit zwei Kurzhanteln – Ganzkörperübung für Zirkel und Konditionierung.", alt: ["thruster", "goblet-squat"],
  }),
  ex("burpee", "Burpees", "Burpee", {
    cat: "cardio", mp: "locomotion", eq: ["bodyweight"], load: "bodyweight", diff: "intermediate", p: ["quads", "chest"], s: ["shoulders", "abs"],
    desc: "Liegestütz, Sprung in die Hocke, Strecksprung – hochintensive Ganzkörperübung.", setSeconds: 60,
  }),
  ex("sled-push", "Schlittenschieben", "Sled Push", {
    cat: "compound", mp: "locomotion", eq: ["machine"], load: "machine", diff: "intermediate", p: ["quads", "glutes"], s: ["calves", "abs"],
    desc: "Beladenen Schlitten über eine Strecke schieben – Beine und Kondition ohne exzentrische Belastung.", setSeconds: 60,
  }),
  ex("turkish-get-up", "Turkish Get-up", "Turkish Get-Up", {
    cat: "compound", mp: "locomotion", eq: ["kettlebell"], load: "free_weight", diff: "advanced", uni: true, p: ["shoulders", "abs"], s: ["glutes", "quads"],
    desc: "Vom Liegen zum Stehen mit der Kettlebell über dem Kopf – Stabilität und Koordination.", setSeconds: 90,
  }),
  ex("clean-and-press", "Umsetzen und Drücken", "Clean and Press", {
    cat: "compound", mp: "hinge", eq: ["barbell"], load: "free_weight", diff: "advanced", p: ["shoulders", "back"], s: ["glutes", "hamstrings", "quads", "triceps"],
    desc: "Stange vom Boden auf die Schultern umsetzen und über Kopf drücken.", alt: ["push-press", "kettlebell-swing"], setSeconds: 60,
  }),
]

export const WARMUP = [
  ex("arm-circles", "Armkreisen", "Arm Circles", {
    cat: "warmup", mp: "mobility", eq: ["bodyweight"], load: "bodyweight", p: ["shoulders"],
    desc: "Große Kreise mit gestreckten Armen vorwärts und rückwärts, um die Schultern aufzuwärmen.", setSeconds: 45,
  }),
  ex("band-pull-apart", "Band Pull-aparts", "Band Pull-Apart", {
    cat: "warmup", mp: "shoulder_horizontal_abduction", eq: ["resistance_band"], load: "bodyweight", p: ["shoulders"], s: ["back"],
    desc: "Band vor dem Körper auf Schulterhöhe auseinanderziehen – aktiviert hintere Schulter und oberen Rücken.", setSeconds: 45,
  }),
  ex("cat-cow", "Katze-Kuh", "Cat-Cow", {
    cat: "warmup", mp: "mobility", eq: ["bodyweight"], load: "bodyweight", p: ["lower_back"], s: ["abs"],
    desc: "Im Vierfüßlerstand die Wirbelsäule abwechselnd runden und strecken.", setSeconds: 45,
  }),
  ex("worlds-greatest-stretch", "World’s Greatest Stretch", "World’s Greatest Stretch", {
    cat: "warmup", mp: "mobility", eq: ["bodyweight"], load: "bodyweight", uni: true, p: ["glutes"], s: ["hamstrings", "lower_back", "shoulders"],
    desc: "Ausfallschritt mit Rotation und Ellbogen zum Boden – mobilisiert Hüfte, Brustwirbelsäule und Beinrückseite.", setSeconds: 60,
  }),
  ex("jumping-jacks", "Hampelmann", "Jumping Jacks", {
    cat: "warmup", mp: "locomotion", eq: ["bodyweight"], load: "bodyweight", p: ["calves"], s: ["shoulders"],
    desc: "Klassisches Aufwärmen, bringt den Kreislauf in Schwung.", setSeconds: 45,
  }),
  ex("hip-circles", "Hüftkreisen", "Hip Circles", {
    cat: "warmup", mp: "mobility", eq: ["bodyweight"], load: "bodyweight", p: ["glutes"],
    desc: "Im Stand oder Vierfüßlerstand große Kreise mit dem Knie, um die Hüfte zu mobilisieren.", setSeconds: 45,
  }),
]

export const CARDIO = [
  ex("treadmill", "Laufband", "Treadmill", {
    cat: "cardio", mp: "locomotion", eq: ["cardio_machine"], load: "machine", p: ["quads"], s: ["calves", "glutes", "hamstrings"],
    desc: "Gehen oder Laufen auf dem Laufband; als Aufwärmen oder eigenständige Cardio-Einheit.", setSeconds: 600,
  }),
  ex("stationary-bike", "Ergometer", "Stationary Bike", {
    cat: "cardio", mp: "locomotion", eq: ["cardio_machine"], load: "machine", p: ["quads"], s: ["glutes", "calves"],
    desc: "Gelenkschonendes Cardio auf dem Fahrrad-Ergometer.", setSeconds: 600,
  }),
  ex("rowing-machine", "Rudergerät", "Rowing Machine", {
    cat: "cardio", mp: "locomotion", eq: ["cardio_machine"], load: "machine", p: ["back"], s: ["quads", "glutes", "biceps"],
    desc: "Ganzkörper-Cardio: Beine, Rumpf, dann Arme – in umgekehrter Reihenfolge zurück.", setSeconds: 600,
  }),
  ex("stair-climber", "Stepper", "Stair Climber", {
    cat: "cardio", mp: "locomotion", eq: ["cardio_machine"], load: "machine", p: ["glutes"], s: ["quads", "calves"],
    desc: "Treppensteigen am Gerät – fordernd für Gesäß und Beine.", setSeconds: 600,
  }),
  ex("elliptical", "Crosstrainer", "Elliptical", {
    cat: "cardio", mp: "locomotion", eq: ["cardio_machine"], load: "machine", p: ["quads"], s: ["glutes", "back"],
    desc: "Gelenkschonendes Ganzkörper-Cardio.", setSeconds: 600,
  }),
  ex("jump-rope", "Seilspringen", "Jump Rope", {
    cat: "cardio", mp: "locomotion", eq: ["bodyweight"], load: "bodyweight", diff: "intermediate", p: ["calves"], s: ["shoulders", "forearms"],
    desc: "Seilspringen für Kondition und Koordination.", setSeconds: 180,
  }),
]

export const MOBILITY = [
  ex("ninety-ninety-hip-switch", "90/90 Hip Switch", "90/90 Hip Switch", {
    cat: "mobility", mp: "mobility", eq: ["bodyweight"], load: "bodyweight", p: ["glutes"],
    desc: "Sitzend beide Beine im 90°-Winkel, kontrolliert von Seite zu Seite wechseln.", setSeconds: 60,
  }),
  ex("couch-stretch", "Couch Stretch", "Couch Stretch", {
    cat: "mobility", mp: "mobility", eq: ["bodyweight"], load: "bodyweight", uni: true, p: ["quads"],
    desc: "Kniend den hinteren Fuß an der Wand hochstellen – dehnt Hüftbeuger und Quadrizeps.", setSeconds: 60,
  }),
  ex("thoracic-rotation", "Brustwirbelsäulen-Rotation", "Thoracic Rotation", {
    cat: "mobility", mp: "mobility", eq: ["bodyweight"], load: "bodyweight", uni: true, p: ["lower_back"], s: ["shoulders"],
    desc: "Im Vierfüßlerstand oder Seitlage den Oberkörper aufdrehen.", setSeconds: 60,
  }),
  ex("pigeon-stretch", "Taubenstellung", "Pigeon Stretch", {
    cat: "mobility", mp: "mobility", eq: ["bodyweight"], load: "bodyweight", uni: true, p: ["glutes"],
    desc: "Vorderes Bein angewinkelt vor dem Körper, hinteres Bein gestreckt – dehnt Gesäß und Hüfte.", setSeconds: 60,
  }),
  ex("shoulder-dislocates", "Schulterkreisen mit Band", "Band Shoulder Dislocates", {
    cat: "mobility", mp: "mobility", eq: ["resistance_band"], load: "bodyweight", p: ["shoulders"],
    desc: "Mit breitem Griff das Band über den Kopf nach hinten und wieder nach vorne führen.", setSeconds: 45,
  }),
  ex("ankle-dorsiflexion-stretch", "Sprunggelenk-Mobilisation", "Ankle Dorsiflexion Stretch", {
    cat: "mobility", mp: "mobility", eq: ["bodyweight"], load: "bodyweight", uni: true, p: ["calves"],
    desc: "Knie über die Zehen zur Wand schieben, Ferse bleibt am Boden – wichtig für tiefe Kniebeugen.", setSeconds: 45,
  }),
]
