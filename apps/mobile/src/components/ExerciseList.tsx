import { useMemo, useState } from "react"
import { FlatList, StyleSheet, View } from "react-native"
import { SymbolView } from "expo-symbols"
import type { ExerciseDto } from "@pondus/shared"
import { EQUIPMENT, EQUIPMENT_LABELS, MUSCLE_GROUPS } from "@pondus/shared"
import { Chip, EmptyState, ErrorState, Input, ListRow, LoadingState, Text, useTheme } from "@/design-system"
import { ExerciseThumbnail } from "@/components/ExerciseMedia"
import { useExercises, type ExerciseFilters } from "@/features/exercises/queries"
import { CATEGORY_LABELS, DIFFICULTY_LABELS } from "@/lib/format"
import { useSettingsStore } from "@/services/settings-store"

export interface ExerciseListProps {
  onPress: (e: ExerciseDto) => void
  header?: React.ReactNode
  initialFilters?: ExerciseFilters
  contentBottomInset?: number
}

/** Searchable, filterable library list used by the Übungen tab and the picker modal. */
export function ExerciseList({ onPress, header, initialFilters, contentBottomInset = 0 }: ExerciseListProps) {
  const { colors, space } = useTheme()
  const [q, setQ] = useState("")
  const [filters, setFilters] = useState<ExerciseFilters>(initialFilters ?? {})
  const [showFilters, setShowFilters] = useState(false)
  const query = useExercises({ ...filters, q })
  const items = useMemo(() => query.data?.pages.flatMap(p => p.items) ?? [], [query.data])
  const total = query.data?.pages[0]?.total ?? 0
  const unit = useSettingsStore(s => s.weightUnit)
  void unit

  const toggle = (key: "muscles" | "equipment" | "category" | "difficulty", value: string) =>
    setFilters(f => {
      const list = f[key] ?? []
      return { ...f, [key]: list.includes(value) ? list.filter(x => x !== value) : [...list, value] }
    })
  const activeCount = (filters.muscles?.length ?? 0) + (filters.equipment?.length ?? 0) + (filters.category?.length ?? 0) + (filters.difficulty?.length ?? 0) + (filters.unilateral ? 1 : 0)

  return (
    <FlatList
      data={items}
      keyExtractor={e => e.id}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={{ paddingHorizontal: space[4], paddingBottom: contentBottomInset + space[8] }}
      onEndReached={() => query.hasNextPage && !query.isFetchingNextPage && void query.fetchNextPage()}
      onEndReachedThreshold={0.6}
      initialNumToRender={16}
      windowSize={7}
      ListHeaderComponent={
        <View style={{ gap: space[3], paddingBottom: space[3] }}>
          {header}
          <Input placeholder="Übung suchen…" value={q} onChangeText={setQ} autoCorrect={false} clearButtonMode="while-editing" returnKeyType="search" />
          <View style={{ flexDirection: "row", gap: space[2], flexWrap: "wrap" }}>
            <Chip label={`Filter${activeCount ? ` (${activeCount})` : ""}`} size="sm" selected={showFilters} onPress={() => setShowFilters(v => !v)} />
            <Chip label="Favoriten" size="sm" selected={!!filters.favorites} onPress={() => setFilters(f => ({ ...f, favorites: !f.favorites }))} />
            <Chip label="Zuletzt" size="sm" selected={!!filters.recent} onPress={() => setFilters(f => ({ ...f, recent: !f.recent, sort: f.recent ? "name" : "recent" }))} />
            <Chip label="Eigene" size="sm" selected={!!filters.custom} onPress={() => setFilters(f => ({ ...f, custom: !f.custom }))} />
          </View>
          {showFilters ? (
            <View style={{ gap: space[3] }}>
              <FilterGroup title="Muskelgruppe">{MUSCLE_GROUPS.map(m => <Chip key={m.slug} label={m.nameDe} size="sm" selected={filters.muscles?.includes(m.slug)} onPress={() => toggle("muscles", m.slug)} />)}</FilterGroup>
              <FilterGroup title="Equipment">{EQUIPMENT.map(e => <Chip key={e} label={EQUIPMENT_LABELS[e].de} size="sm" selected={filters.equipment?.includes(e)} onPress={() => toggle("equipment", e)} />)}</FilterGroup>
              <FilterGroup title="Kategorie">{Object.entries(CATEGORY_LABELS).map(([k, v]) => <Chip key={k} label={v} size="sm" selected={filters.category?.includes(k)} onPress={() => toggle("category", k)} />)}</FilterGroup>
              <FilterGroup title="Schwierigkeit">{Object.entries(DIFFICULTY_LABELS).map(([k, v]) => <Chip key={k} label={v} size="sm" selected={filters.difficulty?.includes(k)} onPress={() => toggle("difficulty", k)} />)}</FilterGroup>
              <FilterGroup title="Ausführung">
                <Chip label="Einseitig" size="sm" selected={filters.unilateral === "true"} onPress={() => setFilters(f => ({ ...f, unilateral: f.unilateral === "true" ? undefined : "true" }))} />
                <Chip label="Beidseitig" size="sm" selected={filters.unilateral === "false"} onPress={() => setFilters(f => ({ ...f, unilateral: f.unilateral === "false" ? undefined : "false" }))} />
              </FilterGroup>
              {activeCount ? <Chip label="Filter zurücksetzen" size="sm" tone="danger" onPress={() => setFilters(f => ({ favorites: f.favorites, recent: f.recent, custom: f.custom, sort: f.sort }))} /> : null}
            </View>
          ) : null}
          <Text variant="footnote" color="tertiary">
            {query.isLoading ? "Wird geladen…" : `${total} Übungen`}
          </Text>
        </View>
      }
      ListEmptyComponent={
        query.isLoading ? <LoadingState /> : query.isError ? <ErrorState body="Die Übungen konnten nicht geladen werden." onRetry={() => void query.refetch()} /> : <EmptyState icon="magnifyingglass" title="Keine Treffer" body="Passe Suche oder Filter an." />
      }
      ListFooterComponent={query.isFetchingNextPage ? <LoadingState /> : undefined}
      renderItem={({ item }) => (
        <View style={{ backgroundColor: colors.surface, borderRadius: 0 }}>
          <ListRow
            title={item.nameDe}
            leading={<ExerciseThumbnail slug={item.isSystem ? item.slug : null} size={60} />}
            subtitle={`${item.primaryMuscles.map(m => MUSCLE_GROUPS.find(g => g.slug === m)?.nameDe ?? m).join(", ")} · ${item.equipment.map(e => EQUIPMENT_LABELS[e].de).join(", ")}`}
            trailing={item.isFavorite ? <SymbolView name="heart.fill" size={14} tintColor={colors.accent} /> : item.isSystem ? undefined : <SymbolView name="person" size={14} tintColor={colors.textTertiary} />}
            onPress={() => onPress(item)}
            chevron
            style={{ paddingHorizontal: space[3] }}
          />
        </View>
      )}
      ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth }} />}
    />
  )
}

function FilterGroup({ title, children }: React.PropsWithChildren<{ title: string }>) {
  const { space } = useTheme()
  return (
    <View style={{ gap: space[1] }}>
      <Text variant="caption" color="tertiary">
        {title.toUpperCase()}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[1] }}>{children}</View>
    </View>
  )
}
