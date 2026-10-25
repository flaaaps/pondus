import { ex } from "./types"

export const LEGS = [
  ex("barbell-back-squat", "Kniebeugen mit Langhantel", "Barbell Back Squat", {
    cat: "compound", mp: "squat", eq: ["barbell"], load: "free_weight", diff: "intermediate", p: ["quads", "glutes"], s: ["hamstrings", "lower_back", "abs"],
    desc: "Die Königsübung für die Beine. Stange auf dem oberen Rücken, tief und kontrolliert in die Hocke.",
    cues: ["Knie folgen den Zehen", "Rumpf fest, Blick leicht nach unten-vorne", "Aus der Hocke Boden wegdrücken"],
    mistakes: ["Knie fallen nach innen", "Fersen heben ab", "Rundrücken unten"], aliases: ["Squat", "Back Squat"],
    alt: ["hack-squat", "leg-press", "goblet-squat", "smith-machine-squat"], setSeconds: 55,
  }),
  ex("front-squat", "Frontkniebeugen", "Front Squat", {
    cat: "compound", mp: "squat", eq: ["barbell"], load: "free_weight", diff: "advanced", p: ["quads"], s: ["glutes", "abs", "lower_back"],
    desc: "Stange vorne auf den Schultern; aufrechter Oberkörper, starker Quadrizeps-Fokus.", alt: ["barbell-back-squat", "hack-squat"], setSeconds: 55,
  }),
  ex("goblet-squat", "Goblet Squat", "Goblet Squat", {
    cat: "compound", mp: "squat", eq: ["dumbbell"], load: "free_weight", p: ["quads", "glutes"], s: ["abs"],
    desc: "Eine Kurzhantel vor der Brust halten und tief in die Hocke – ideal zum Lernen der Kniebeuge.", aliases: ["Kelchkniebeuge"], alt: ["barbell-back-squat", "leg-press"],
  }),
  ex("hack-squat", "Hack Squat", "Hack Squat", {
    cat: "compound", mp: "squat", eq: ["machine"], load: "machine", p: ["quads"], s: ["glutes"],
    desc: "Geführte Kniebeuge an der Hack-Squat-Maschine; starker Fokus auf den Quadrizeps, Rücken entlastet.", alt: ["leg-press", "barbell-back-squat", "pendulum-squat"],
  }),
  ex("pendulum-squat", "Pendulum Squat", "Pendulum Squat", {
    cat: "compound", mp: "squat", eq: ["machine"], load: "machine", p: ["quads"], s: ["glutes"],
    desc: "Maschinenkniebeuge mit Pendelbewegung, besonders tiefe Quadrizeps-Dehnung.", alt: ["hack-squat"],
  }),
  ex("leg-press", "Beinpresse", "Leg Press", {
    cat: "compound", mp: "squat", eq: ["machine"], load: "machine", p: ["quads", "glutes"], s: ["hamstrings"],
    desc: "Füße schulterbreit auf der Platte, tief absenken, ohne dass der untere Rücken abhebt.",
    cues: ["Knie nicht komplett durchstrecken", "Gesäß bleibt am Polster"], alt: ["hack-squat", "barbell-back-squat"],
  }),
  ex("smith-machine-squat", "Kniebeugen an der Multipresse", "Smith Machine Squat", {
    cat: "compound", mp: "squat", eq: ["smith_machine"], load: "machine", p: ["quads", "glutes"], s: ["hamstrings"],
    desc: "Geführte Kniebeuge, Füße leicht vor der Stange für mehr Quadrizeps.", alt: ["hack-squat", "barbell-back-squat"],
  }),
  ex("belt-squat", "Belt Squat", "Belt Squat", {
    cat: "compound", mp: "squat", eq: ["machine"], load: "machine", diff: "intermediate", p: ["quads", "glutes"],
    desc: "Kniebeuge mit Last am Gürtel – Beine schwer trainieren ohne Wirbelsäulenbelastung.", alt: ["hack-squat", "leg-press"],
  }),
  ex("zercher-squat", "Zercher Squat", "Zercher Squat", {
    cat: "compound", mp: "squat", eq: ["barbell"], load: "free_weight", diff: "advanced", p: ["quads", "glutes"], s: ["abs", "lower_back", "biceps"],
    desc: "Stange in den Ellenbeugen vor dem Körper; sehr aufrechte Kniebeuge mit viel Rumpfarbeit.", alt: ["front-squat"],
  }),
  ex("leg-extension", "Beinstrecker", "Leg Extension", {
    cat: "isolation", mp: "knee_extension", eq: ["machine"], load: "machine", p: ["quads"],
    desc: "Beine gegen das Polster strecken, oben kurz halten, langsam ablassen.", mistakes: ["Schwung aus der Hüfte", "Zu schnelle Exzentrik"], alt: ["sissy-squat", "hack-squat"],
  }),
  ex("sissy-squat", "Sissy Squat", "Sissy Squat", {
    cat: "isolation", mp: "knee_extension", eq: ["bodyweight"], load: "bodyweight", diff: "advanced", p: ["quads"],
    desc: "Knie nach vorne schieben und Oberkörper nach hinten lehnen – intensive Quadrizeps-Dehnung mit Körpergewicht.", alt: ["leg-extension"],
  }),
  ex("seated-leg-curl", "Beinbeuger sitzend", "Seated Leg Curl", {
    cat: "isolation", mp: "knee_flexion", eq: ["machine"], load: "machine", p: ["hamstrings"],
    desc: "Sitzend die Unterschenkel gegen das Polster nach unten beugen; die gestreckte Hüfte dehnt die Beinbeuger stärker.", alt: ["lying-leg-curl", "nordic-curl"],
  }),
  ex("lying-leg-curl", "Beinbeuger liegend", "Lying Leg Curl", {
    cat: "isolation", mp: "knee_flexion", eq: ["machine"], load: "machine", p: ["hamstrings"],
    desc: "Bäuchlings die Fersen zum Gesäß ziehen, Hüfte bleibt am Polster.", alt: ["seated-leg-curl", "nordic-curl"],
  }),
  ex("nordic-curl", "Nordic Curls", "Nordic Hamstring Curl", {
    cat: "isolation", mp: "knee_flexion", eq: ["bodyweight"], load: "bodyweight", diff: "advanced", p: ["hamstrings"], s: ["glutes"],
    desc: "Kniend mit fixierten Füßen langsam nach vorne ablassen – stark exzentrische Beinbeuger-Übung.", alt: ["lying-leg-curl", "seated-leg-curl"],
  }),
  ex("romanian-deadlift", "Rumänisches Kreuzheben", "Romanian Deadlift", {
    cat: "compound", mp: "hinge", eq: ["barbell"], load: "free_weight", diff: "intermediate", p: ["hamstrings", "glutes"], s: ["lower_back", "back", "forearms"],
    desc: "Mit fast gestreckten Beinen die Hüfte nach hinten schieben, Stange nah am Bein bis unters Knie, Rücken neutral.",
    cues: ["Hüfte zurück, nicht nach unten", "Stange streift die Oberschenkel", "Dehnung in den Beinbeugern spüren"], mistakes: ["Rundrücken", "Zu stark aus dem Knie"],
    aliases: ["RDL"], alt: ["dumbbell-romanian-deadlift", "seated-leg-curl", "good-morning"],
  }),
  ex("dumbbell-romanian-deadlift", "Rumänisches Kreuzheben mit Kurzhanteln", "Dumbbell Romanian Deadlift", {
    cat: "compound", mp: "hinge", eq: ["dumbbell"], load: "free_weight", p: ["hamstrings", "glutes"], s: ["lower_back", "back"],
    desc: "RDL mit Kurzhanteln seitlich oder vor dem Körper; gut für Anfänger und zu Hause.", alt: ["romanian-deadlift"],
  }),
  ex("single-leg-romanian-deadlift", "Einbeiniges rumänisches Kreuzheben", "Single-Leg Romanian Deadlift", {
    cat: "compound", mp: "hinge", eq: ["dumbbell"], load: "free_weight", diff: "intermediate", uni: true, p: ["hamstrings", "glutes"], s: ["lower_back", "abs"],
    desc: "Einbeinige Hüftbeuge mit Kurzhantel; trainiert Balance und Beinbeuger.", alt: ["dumbbell-romanian-deadlift"],
  }),
  ex("conventional-deadlift", "Konventionelles Kreuzheben", "Conventional Deadlift", {
    cat: "compound", mp: "hinge", eq: ["barbell"], load: "free_weight", diff: "intermediate", p: ["hamstrings", "glutes", "back"], s: ["lower_back", "quads", "forearms"],
    desc: "Stange vom Boden mit neutralem Rücken aufrichten, Hüfte und Knie gleichzeitig strecken.",
    cues: ["Stange über der Fußmitte", "Lat anspannen, Stange am Körper", "Oben Gesäß anspannen, nicht überstrecken"],
    mistakes: ["Hüfte schießt zu früh hoch", "Stange wandert vom Körper weg"], aliases: ["Deadlift"], alt: ["trap-bar-deadlift", "sumo-deadlift", "rack-pull"], setSeconds: 60,
  }),
  ex("sumo-deadlift", "Sumo-Kreuzheben", "Sumo Deadlift", {
    cat: "compound", mp: "hinge", eq: ["barbell"], load: "free_weight", diff: "intermediate", p: ["glutes", "quads", "hamstrings"], s: ["back", "lower_back"],
    desc: "Breiter Stand, Hände innerhalb der Beine, aufrechterer Oberkörper als konventionell.", alt: ["conventional-deadlift", "trap-bar-deadlift"], setSeconds: 60,
  }),
  ex("trap-bar-deadlift", "Kreuzheben mit Trap Bar", "Trap Bar Deadlift", {
    cat: "compound", mp: "hinge", eq: ["trap_bar"], load: "free_weight", p: ["quads", "glutes", "hamstrings"], s: ["back", "lower_back", "forearms"],
    desc: "Kreuzheben in der Hex-Bar mit neutralem Griff; rückenschonender Einstieg ins schwere Heben.", alt: ["conventional-deadlift", "leg-press"], setSeconds: 60,
  }),
  ex("barbell-hip-thrust", "Hip Thrust mit Langhantel", "Barbell Hip Thrust", {
    cat: "compound", mp: "hip_extension", eq: ["barbell", "bench"], load: "free_weight", p: ["glutes"], s: ["hamstrings"],
    desc: "Oberer Rücken auf der Bank, Stange auf der Hüfte, Hüfte bis zur vollen Streckung nach oben drücken.",
    cues: ["Kinn zur Brust, Rippen unten", "Oben Gesäß maximal anspannen"], mistakes: ["Hohlkreuz oben"], alt: ["machine-hip-thrust", "glute-bridge"],
  }),
  ex("machine-hip-thrust", "Hip Thrust an der Maschine", "Machine Hip Thrust", {
    cat: "compound", mp: "hip_extension", eq: ["machine"], load: "machine", p: ["glutes"], s: ["hamstrings"],
    desc: "Hip Thrust an der dafür vorgesehenen Maschine; schnell eingestellt, kein Stangen-Setup.", alt: ["barbell-hip-thrust"],
  }),
  ex("glute-bridge", "Glute Bridge", "Glute Bridge", {
    cat: "compound", mp: "hip_extension", eq: ["bodyweight"], load: "bodyweight", p: ["glutes"], s: ["hamstrings"],
    desc: "Rückenlage, Füße aufgestellt, Hüfte nach oben drücken und kurz halten.", alt: ["barbell-hip-thrust"],
  }),
  ex("bulgarian-split-squat", "Bulgarian Split Squats", "Bulgarian Split Squat", {
    cat: "compound", mp: "lunge", eq: ["dumbbell", "bench"], load: "free_weight", diff: "intermediate", uni: true, p: ["quads", "glutes"], s: ["hamstrings", "abs"],
    desc: "Hinterer Fuß auf der Bank, tief in die Kniebeuge des vorderen Beins.", cues: ["Oberkörper leicht nach vorne für mehr Gesäß", "Knie stabil über dem Fuß"],
    alt: ["walking-lunge", "reverse-lunge", "step-up"], setSeconds: 60,
  }),
  ex("walking-lunge", "Ausfallschritte gehend", "Walking Lunge", {
    cat: "compound", mp: "lunge", eq: ["dumbbell"], load: "free_weight", uni: true, p: ["quads", "glutes"], s: ["hamstrings"],
    desc: "Abwechselnd große Schritte nach vorne, hinteres Knie fast zum Boden.", aliases: ["Lunges"], alt: ["reverse-lunge", "bulgarian-split-squat"], setSeconds: 60,
  }),
  ex("reverse-lunge", "Ausfallschritte rückwärts", "Reverse Lunge", {
    cat: "compound", mp: "lunge", eq: ["dumbbell"], load: "free_weight", uni: true, p: ["quads", "glutes"], s: ["hamstrings"],
    desc: "Schritt nach hinten statt nach vorne – kniefreundlicher und stabiler.", alt: ["walking-lunge", "bulgarian-split-squat"], setSeconds: 60,
  }),
  ex("step-up", "Step-ups", "Step-Up", {
    cat: "compound", mp: "lunge", eq: ["dumbbell", "bench"], load: "free_weight", uni: true, p: ["quads", "glutes"],
    desc: "Auf eine Bank oder Box steigen, Kraft aus dem oberen Bein, kontrolliert absteigen.", alt: ["bulgarian-split-squat", "reverse-lunge"], setSeconds: 60,
  }),
  ex("pistol-squat", "Pistol Squat", "Pistol Squat", {
    cat: "compound", mp: "squat", eq: ["bodyweight"], load: "bodyweight", diff: "advanced", uni: true, p: ["quads", "glutes"], s: ["abs"],
    desc: "Einbeinige Kniebeuge mit nach vorne gestrecktem freien Bein.", alt: ["bulgarian-split-squat"],
  }),
  ex("standing-calf-raise", "Wadenheben stehend", "Standing Calf Raise", {
    cat: "isolation", mp: "plantar_flexion", eq: ["machine"], load: "machine", p: ["calves"],
    desc: "Auf dem Ballen stehend tief dehnen, dann maximal auf die Zehenspitzen; oben und unten kurz halten.", mistakes: ["Federn aus der Dehnung"], alt: ["leg-press-calf-raise", "seated-calf-raise"],
  }),
  ex("seated-calf-raise", "Wadenheben sitzend", "Seated Calf Raise", {
    cat: "isolation", mp: "plantar_flexion", eq: ["machine"], load: "machine", p: ["calves"],
    desc: "Sitzend mit gebeugtem Knie – betont den Soleus.", alt: ["standing-calf-raise"],
  }),
  ex("leg-press-calf-raise", "Wadenheben an der Beinpresse", "Leg Press Calf Raise", {
    cat: "isolation", mp: "plantar_flexion", eq: ["machine"], load: "machine", p: ["calves"],
    desc: "Nur die Fußballen auf der Platte, Beine gestreckt, Platte mit den Waden wegdrücken.", alt: ["standing-calf-raise"],
  }),
  ex("dumbbell-calf-raise", "Wadenheben mit Kurzhantel", "Dumbbell Calf Raise", {
    cat: "isolation", mp: "plantar_flexion", eq: ["dumbbell"], load: "free_weight", uni: true, p: ["calves"],
    desc: "Einbeinig auf einer Stufe mit Kurzhantel in der Hand.", alt: ["standing-calf-raise"],
  }),
  ex("hip-adduction-machine", "Adduktorenmaschine", "Hip Adduction Machine", {
    cat: "isolation", mp: "hip_adduction", eq: ["machine"], load: "machine", p: ["glutes"],
    desc: "Beine gegen den Widerstand zusammenführen; trainiert die Oberschenkelinnenseite.", aliases: ["Adduktoren"], alt: ["sumo-deadlift"],
  }),
  ex("hip-abduction-machine", "Abduktorenmaschine", "Hip Abduction Machine", {
    cat: "isolation", mp: "hip_abduction", eq: ["machine"], load: "machine", p: ["glutes"],
    desc: "Beine gegen den Widerstand nach außen drücken; trainiert den Gluteus medius.", aliases: ["Abduktoren"], alt: ["cable-hip-abduction"],
  }),
  ex("cable-hip-abduction", "Hüftabduktion am Kabel", "Cable Hip Abduction", {
    cat: "isolation", mp: "hip_abduction", eq: ["cable"], load: "cable", uni: true, p: ["glutes"],
    desc: "Stehend das äußere Bein seitlich gegen den Kabelzug anheben.", alt: ["hip-abduction-machine"],
  }),
  ex("cable-glute-kickback", "Glute Kickbacks am Kabel", "Cable Glute Kickback", {
    cat: "isolation", mp: "hip_extension", eq: ["cable"], load: "cable", uni: true, p: ["glutes"], s: ["hamstrings"],
    desc: "Bein mit Fußschlaufe nach hinten-oben strecken, Oberkörper stabil.", alt: ["barbell-hip-thrust", "cable-pull-through"],
  }),
  ex("cable-pull-through", "Pull-Throughs am Kabel", "Cable Pull-Through", {
    cat: "compound", mp: "hinge", eq: ["cable"], load: "cable", p: ["glutes", "hamstrings"], s: ["lower_back"],
    desc: "Rückwärts zum Kabelzug, Seil zwischen den Beinen durch, Hüfte explosiv strecken.", alt: ["romanian-deadlift", "barbell-hip-thrust"],
  }),
  ex("good-morning", "Good Mornings", "Good Morning", {
    cat: "compound", mp: "hinge", eq: ["barbell"], load: "free_weight", diff: "advanced", p: ["hamstrings", "lower_back"], s: ["glutes"],
    desc: "Stange im Nacken, Oberkörper mit neutralem Rücken nach vorne beugen und wieder aufrichten.", alt: ["romanian-deadlift", "back-extension"],
  }),
  ex("kettlebell-swing", "Kettlebell Swings", "Kettlebell Swing", {
    cat: "compound", mp: "hinge", eq: ["kettlebell"], load: "free_weight", diff: "intermediate", p: ["glutes", "hamstrings"], s: ["lower_back", "shoulders", "abs"],
    desc: "Explosive Hüftstreckung schwingt die Kettlebell auf Brusthöhe; die Arme führen nur.", mistakes: ["Aus den Armen heben statt aus der Hüfte"], alt: ["cable-pull-through", "romanian-deadlift"],
  }),
]
