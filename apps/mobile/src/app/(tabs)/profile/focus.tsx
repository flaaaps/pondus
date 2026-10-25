import { useState } from "react"
import { Alert, View } from "react-native"
import { Stack, useRouter } from "expo-router"
import { MUSCLE_GROUPS, type MuscleSlug } from "@pondus/shared"
import { Button, Card, Chip, ErrorState, LoadingState, Screen, Text, useTheme } from "@/design-system"
import { useProfile, useUpdateProfile } from "@/features/profile/queries"

export default function FocusScreen() {
  const { space } = useTheme()
  const router = useRouter()
  const profile = useProfile()
  const update = useUpdateProfile()
  const [focus, setFocus] = useState<MuscleSlug[] | null>(null)
  if (profile.isLoading) return <LoadingState />
  if (!profile.data) return <ErrorState onRetry={() => void profile.refetch()} />
  const cur = focus ?? [...profile.data.musclePriorities].sort((a, b) => a.priority - b.priority).map(m => m.muscle as MuscleSlug)
  const move = (m: MuscleSlug, dir: -1 | 1) => {
    const i = cur.indexOf(m)
    const j = i + dir
    if (j < 0 || j >= cur.length) return
    const next = [...cur]
    ;[next[i], next[j]] = [next[j]!, next[i]!]
    setFocus(next)
  }
  return (
    <>
      <Stack.Screen options={{ title: "Fokusmuskeln", headerLargeTitle: false }} />
      <Screen>
        <Text variant="callout" color="secondary">
          Bis zu vier Muskelgruppen. Je höher die Priorität, desto mehr Sätze pro Woche und desto früher in der Einheit.
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
          {MUSCLE_GROUPS.map(g => (
            <Chip key={g.slug} label={g.nameDe} selected={cur.includes(g.slug)} onPress={() => setFocus(cur.includes(g.slug) ? cur.filter(x => x !== g.slug) : [...cur, g.slug].slice(0, 4))} />
          ))}
        </View>
        {cur.length ? (
          <Card padding="sm">
            {cur.map((m, i) => (
              <View key={m} style={{ flexDirection: "row", alignItems: "center", gap: space[2], paddingVertical: space[1] }}>
                <Text variant="numeral" color="accent" style={{ width: 28 }}>
                  {i + 1}
                </Text>
                <Text variant="body" style={{ flex: 1 }}>
                  {MUSCLE_GROUPS.find(g => g.slug === m)!.nameDe}
                </Text>
                <Button title="↑" variant="secondary" size="sm" disabled={i === 0} onPress={() => move(m, -1)} hapticStyle="none" />
                <Button title="↓" variant="secondary" size="sm" disabled={i === cur.length - 1} onPress={() => move(m, 1)} hapticStyle="none" />
              </View>
            ))}
          </Card>
        ) : null}
        <Button title="Speichern" fullWidth loading={update.isPending} onPress={() => update.mutate({ musclePriorities: cur.map((muscle, i) => ({ muscle, priority: i + 1 })) }, { onSuccess: () => router.back(), onError: e => Alert.alert("Fehler", e instanceof Error ? e.message : "") })} />
      </Screen>
    </>
  )
}
