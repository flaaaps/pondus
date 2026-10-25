import { useState } from "react"
import { AccessibilityInfo, Alert, ScrollView, View } from "react-native"
import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { useQueryClient } from "@tanstack/react-query"
import { EXERCISE_NOTE_MAX_LENGTH, normalizeExerciseNote, type ExerciseDto } from "@pondus/shared"
import { Button, Input, Text, useTheme } from "@/design-system"
import { useAllExercises } from "@/features/exercises/queries"
import { useEffectiveNote, useExerciseNotesStore } from "@/features/exercises/note-store"
import { useActiveWorkoutStore } from "@/features/workout/active-workout-store"
import { keyOf } from "@/features/workout/selectors"
import { queryKeys } from "@/lib/query-client"
import { useApi } from "@/services/session-store"
import { haptic } from "@/lib/haptics"

export type NoteScope = "exercise" | "workout"

/**
 * Edits one of two notes, kept apart on purpose:
 * - `exercise`: the lasting note on the exercise (seat, grip, machine), shown at every future workout;
 * - `workout`: the note on this exercise in the active workout only (`workout_exercises.notes`), shown in the history.
 * Both save locally first and sync through the outbox, so they work offline.
 */
export default function ExerciseNoteScreen() {
  const { exerciseId, name, scope = "exercise", workoutExerciseKey } = useLocalSearchParams<{ exerciseId?: string; name?: string; scope?: NoteScope; workoutExerciseKey?: string }>()
  const { space } = useTheme()
  const router = useRouter()
  const api = useApi()
  const qc = useQueryClient()
  const library = useAllExercises()
  // Only cached data (works offline): the screen that opens the editor has already loaded the exercise.
  const exercise = (exerciseId ? qc.getQueryData<ExerciseDto>(queryKeys.exercise(exerciseId)) : undefined) ?? library.data?.find(e => e.id === exerciseId)
  const lastingNote = useEffectiveNote(exerciseId, exercise)
  const workoutExercise = useActiveWorkoutStore(s => s.workout?.exercises.find(e => keyOf(e) === workoutExerciseKey))
  // Frozen at open, so a background refetch never pulls the text away under the cursor.
  const [initial] = useState(() => (scope === "workout" ? workoutExercise?.notes : lastingNote) ?? "")
  const [text, setText] = useState(initial)
  const changed = normalizeExerciseNote(text) !== normalizeExerciseNote(initial)
  const title = scope === "workout" ? "Notiz zu diesem Workout" : "Notiz zu dieser Übung"
  const exerciseName = name ?? exercise?.nameDe ?? workoutExercise?.exerciseNameSnapshot ?? "Übung"
  const canEdit = scope === "workout" ? !!workoutExercise : !!exerciseId

  const save = (value: string | null) => {
    if (scope === "workout") {
      if (workoutExercise) useActiveWorkoutStore.getState().setWorkoutExerciseNote(api, workoutExercise, value)
    } else if (exerciseId) useExerciseNotesStore.getState().save(api, exerciseId, value)
    haptic("success")
    AccessibilityInfo.announceForAccessibility(normalizeExerciseNote(value) ? "Notiz gespeichert" : "Notiz gelöscht")
    router.back()
  }
  const remove = () =>
    Alert.alert("Notiz löschen?", scope === "workout" ? "Die Notiz zu diesem Workout wird entfernt." : `Die Notiz zu „${exerciseName}“ wird für alle künftigen Trainings entfernt.`, [
      { text: "Abbrechen", style: "cancel" },
      { text: "Löschen", style: "destructive", onPress: () => save(null) },
    ])

  return (
    <>
      <Stack.Screen
        options={{
          title,
          headerLeft: () => <Button title="Abbrechen" variant="ghost" size="sm" hapticStyle="none" onPress={() => router.back()} />,
          headerRight: () => <Button title="Sichern" variant="ghost" size="sm" hapticStyle="none" disabled={!changed || !canEdit} accessibilityLabel={`${title} sichern`} onPress={() => save(text)} />,
        }}
      />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space[4], gap: space[3] }}>
        <View style={{ gap: space[1] }}>
          <Text variant="title3" accessibilityRole="header">
            {exerciseName}
          </Text>
          <Text variant="footnote" color="secondary">
            {scope === "workout" ? "Gilt nur für diese Übung in diesem Training und erscheint später im Verlauf." : "Bleibt bei der Übung gespeichert und erscheint bei jedem Training – z. B. Sitzeinstellung, Griff oder Maschinennummer."}
          </Text>
        </View>
        <Input
          label={title}
          value={text}
          onChangeText={setText}
          placeholder={scope === "workout" ? "z. B. Schulter zwickt, nur 3 Sätze" : "z. B. Sitz 4, Griff eng, Maschine Nr. 3"}
          multiline
          autoFocus
          maxLength={EXERCISE_NOTE_MAX_LENGTH}
          editable={canEdit}
          hint={`${text.length}/${EXERCISE_NOTE_MAX_LENGTH} Zeichen`}
          textAlignVertical="top"
          style={{ height: undefined, minHeight: 120, paddingTop: space[3], paddingBottom: space[3] }}
        />
        {!canEdit ? (
          <Text variant="footnote" color="danger">
            {scope === "workout" ? "Diese Übung ist nicht mehr im aktiven Workout." : "Übung nicht gefunden."}
          </Text>
        ) : null}
        <Button title="Sichern" fullWidth disabled={!changed || !canEdit} accessibilityLabel={`${title} sichern`} onPress={() => save(text)} />
        {normalizeExerciseNote(initial) && canEdit ? <Button title="Notiz löschen" variant="danger" fullWidth onPress={remove} /> : null}
      </ScrollView>
    </>
  )
}
