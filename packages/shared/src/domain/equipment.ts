export const EQUIPMENT = [
  "barbell",
  "dumbbell",
  "cable",
  "machine",
  "smith_machine",
  "bodyweight",
  "kettlebell",
  "ez_bar",
  "trap_bar",
  "bench",
  "pull_up_bar",
  "dip_station",
  "resistance_band",
  "ab_wheel",
  "plate",
  "cardio_machine",
] as const
export type Equipment = (typeof EQUIPMENT)[number]

export const EQUIPMENT_LABELS: Record<Equipment, { de: string; en: string }> = {
  barbell: { de: "Langhantel", en: "Barbell" },
  dumbbell: { de: "Kurzhantel", en: "Dumbbell" },
  cable: { de: "Kabelzug", en: "Cable" },
  machine: { de: "Maschine", en: "Machine" },
  smith_machine: { de: "Multipresse", en: "Smith machine" },
  bodyweight: { de: "Körpergewicht", en: "Bodyweight" },
  kettlebell: { de: "Kettlebell", en: "Kettlebell" },
  ez_bar: { de: "SZ-Stange", en: "EZ bar" },
  trap_bar: { de: "Trap Bar", en: "Trap bar" },
  bench: { de: "Bank", en: "Bench" },
  pull_up_bar: { de: "Klimmzugstange", en: "Pull-up bar" },
  dip_station: { de: "Dip-Barren", en: "Dip station" },
  resistance_band: { de: "Widerstandsband", en: "Resistance band" },
  ab_wheel: { de: "Ab Wheel", en: "Ab wheel" },
  plate: { de: "Hantelscheibe", en: "Plate" },
  cardio_machine: { de: "Cardiogerät", en: "Cardio machine" },
}

export const TRAINING_ENVIRONMENTS = ["full_gym", "limited_gym", "home", "custom"] as const
export type TrainingEnvironment = (typeof TRAINING_ENVIRONMENTS)[number]

/** Equipment presets per environment; "custom" lets the user pick explicitly. */
export const ENVIRONMENT_EQUIPMENT: Record<Exclude<TrainingEnvironment, "custom">, Equipment[]> = {
  full_gym: [...EQUIPMENT],
  limited_gym: [
    "barbell",
    "dumbbell",
    "cable",
    "bodyweight",
    "bench",
    "pull_up_bar",
    "ez_bar",
    "plate",
    "dip_station",
  ],
  home: ["dumbbell", "bodyweight", "resistance_band", "pull_up_bar", "bench", "kettlebell"],
}

export function isEquipment(value: string): value is Equipment {
  return (EQUIPMENT as readonly string[]).includes(value)
}
