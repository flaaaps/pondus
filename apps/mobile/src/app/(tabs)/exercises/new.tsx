import { useState } from "react"
import { Alert, View } from "react-native"
import { Stack, useRouter } from "expo-router"
import { EQUIPMENT, EQUIPMENT_LABELS, MOVEMENT_PATTERNS, MUSCLE_GROUPS, type Equipment, type MuscleSlug } from "@pondus/shared"
import { Button, Chip, Input, Screen, Section, SegmentedControl, Text, useTheme } from "@/design-system"
import { useCreateExercise } from "@/features/exercises/queries"
import { ApiError } from "@/lib/api-client"

const PATTERN_LABELS: Partial<Record<string, string>> = {
  horizontal_push: "Horizontal drücken", vertical_push: "Vertikal drücken", horizontal_pull: "Horizontal ziehen", vertical_pull: "Vertikal ziehen", squat: "Kniebeuge", hinge: "Hüftbeuge", lunge: "Ausfallschritt",
  elbow_flexion: "Ellbogen beugen", elbow_extension: "Ellbogen strecken", shoulder_abduction: "Seitheben", shoulder_flexion: "Frontheben", shoulder_horizontal_abduction: "Reverse Fly", shoulder_horizontal_adduction: "Fly",
  hip_abduction: "Hüftabduktion", hip_adduction: "Hüftadduktion", hip_extension: "Hüftstreckung", knee_extension: "Beinstrecken", knee_flexion: "Beinbeugen", plantar_flexion: "Wadenheben", trunk_flexion: "Rumpfbeugen",
  anti_rotation: "Anti-Rotation", anti_extension: "Anti-Extension", lateral_flexion: "Seitbeugen", spinal_extension: "Rückenstrecken", carry: "Tragen", grip: "Griff", wrist_flexion: "Handgelenk beugen", wrist_extension: "Handgelenk strecken", locomotion: "Bewegung", mobility: "Mobilität",
}

export default function NewExerciseScreen() {
  const { space } = useTheme()
  const router = useRouter()
  const create = useCreateExercise()
  const [name, setName] = useState("")
  const [category, setCategory] = useState<"compound" | "isolation" | "core">("isolation")
  const [pattern, setPattern] = useState<string>("elbow_flexion")
  const [equipment, setEquipment] = useState<Equipment[]>(["dumbbell"])
  const [loadType, setLoadType] = useState<"free_weight" | "machine" | "cable" | "bodyweight">("free_weight")
  const [primary, setPrimary] = useState<MuscleSlug[]>([])
  const [secondary, setSecondary] = useState<MuscleSlug[]>([])
  const [unilateral, setUnilateral] = useState(false)
  const [description, setDescription] = useState("")
  const toggle = <T,>(list: T[], v: T, max = 99) => (list.includes(v) ? list.filter(x => x !== v) : list.length < max ? [...list, v] : list)
  const valid = name.trim().length >= 2 && primary.length > 0 && equipment.length > 0

  const submit = () =>
    create.mutate(
      { nameDe: name.trim(), category, movementPattern: pattern, equipment, loadType, primaryMuscles: primary, secondaryMuscles: secondary.filter(m => !primary.includes(m)), isUnilateral: unilateral, description: description.trim() || undefined },
      { onSuccess: e => router.replace(`/(tabs)/exercises/${e.id}`), onError: e => Alert.alert("Speichern fehlgeschlagen", e instanceof ApiError ? e.message : "Unbekannter Fehler") },
    )

  return (
    <>
      <Stack.Screen options={{ title: "Eigene Übung", headerLargeTitle: false }} />
      <Screen>
        <Input label="Name" value={name} onChangeText={setName} placeholder="z. B. Kabelrudern einarmig sitzend" />
        <Section title="Typ">
          <SegmentedControl options={[{ value: "compound", label: "Grundübung" }, { value: "isolation", label: "Isolation" }, { value: "core", label: "Rumpf" }]} value={category} onChange={setCategory} />
        </Section>
        <Section title="Belastung">
          <SegmentedControl options={[{ value: "free_weight", label: "Frei" }, { value: "machine", label: "Maschine" }, { value: "cable", label: "Kabel" }, { value: "bodyweight", label: "Körper" }]} value={loadType} onChange={setLoadType} />
        </Section>
        <Section title="Hauptmuskeln (max. 3)">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>{MUSCLE_GROUPS.map(m => <Chip key={m.slug} label={m.nameDe} size="sm" selected={primary.includes(m.slug)} onPress={() => setPrimary(toggle(primary, m.slug, 3))} />)}</View>
        </Section>
        <Section title="Nebenmuskeln">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>{MUSCLE_GROUPS.filter(m => !primary.includes(m.slug)).map(m => <Chip key={m.slug} label={m.nameDe} size="sm" selected={secondary.includes(m.slug)} onPress={() => setSecondary(toggle(secondary, m.slug, 4))} />)}</View>
        </Section>
        <Section title="Equipment">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>{EQUIPMENT.map(e => <Chip key={e} label={EQUIPMENT_LABELS[e].de} size="sm" selected={equipment.includes(e)} onPress={() => setEquipment(toggle(equipment, e, 4))} />)}</View>
        </Section>
        <Section title="Bewegungsmuster">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>{MOVEMENT_PATTERNS.map(p => <Chip key={p} label={PATTERN_LABELS[p] ?? p} size="sm" selected={pattern === p} onPress={() => setPattern(p)} />)}</View>
        </Section>
        <Section title="Ausführung">
          <View style={{ flexDirection: "row", gap: space[2] }}>
            <Chip label="Beidseitig" selected={!unilateral} onPress={() => setUnilateral(false)} />
            <Chip label="Einseitig" selected={unilateral} onPress={() => setUnilateral(true)} />
          </View>
        </Section>
        <Input label="Beschreibung (optional)" value={description} onChangeText={setDescription} multiline style={{ height: 96, paddingTop: 12 }} />
        <Button title="Übung speichern" fullWidth disabled={!valid} loading={create.isPending} onPress={submit} />
        <Text variant="footnote" color="tertiary">
          Eigene Übungen sind nur für dich sichtbar und lassen sich wie alle anderen in Pläne und Workouts einbauen.
        </Text>
      </Screen>
    </>
  )
}
