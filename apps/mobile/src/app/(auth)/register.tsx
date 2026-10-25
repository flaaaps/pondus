import { useState } from "react"
import { View } from "react-native"
import { Link, useRouter } from "expo-router"
import { KeyboardAwareScrollView } from "react-native-keyboard-controller"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Button, Input, Text, useTheme } from "@/design-system"
import { ApiError } from "@/lib/api-client"
import { useSessionStore } from "@/services/session-store"

export default function RegisterScreen() {
  const { colors, space } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const register = useSessionStore(s => s.register)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; form?: string }>({})
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    const next: typeof errors = {}
    if (!name.trim()) next.name = "Wie sollen wir dich nennen?"
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = "Bitte eine gültige E-Mail-Adresse eingeben."
    if (password.length < 8) next.password = "Mindestens 8 Zeichen."
    setErrors(next)
    if (Object.keys(next).length) return
    setLoading(true)
    try {
      await register(email.trim(), password, name.trim())
      router.replace("/(onboarding)/goals")
    } catch (err) {
      setErrors({ form: err instanceof ApiError ? (err.code === "email_taken" ? "Für diese E-Mail gibt es bereits ein Konto." : err.isNetwork ? "Keine Verbindung zum Server." : err.message) : "Registrierung fehlgeschlagen." })
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAwareScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ flexGrow: 1, padding: space[6], paddingTop: insets.top + space[8], paddingBottom: insets.bottom + space[6], gap: space[6] }} keyboardShouldPersistTaps="handled">
      <View style={{ gap: space[2] }}>
        <Text variant="title1">Konto erstellen</Text>
        <Text variant="body" color="secondary">
          In zwei Minuten hast du deinen ersten Trainingsplan.
        </Text>
      </View>
      <View style={{ gap: space[4] }}>
        <Input label="Name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" error={errors.name} returnKeyType="next" />
        <Input label="E-Mail" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" error={errors.email} returnKeyType="next" />
        <Input label="Passwort" value={password} onChangeText={setPassword} secureTextEntry textContentType="newPassword" error={errors.password} hint="Mindestens 8 Zeichen." returnKeyType="go" onSubmitEditing={() => void submit()} />
        {errors.form ? (
          <Text variant="callout" color="danger">
            {errors.form}
          </Text>
        ) : null}
        <Button title="Weiter" fullWidth loading={loading} onPress={() => void submit()} />
      </View>
      <View style={{ flexDirection: "row", gap: space[1], justifyContent: "center", marginTop: "auto" }}>
        <Text variant="callout" color="secondary">
          Schon ein Konto?
        </Text>
        <Link href="/(auth)/login">
          <Text variant="calloutStrong" color="accent">
            Anmelden
          </Text>
        </Link>
      </View>
    </KeyboardAwareScrollView>
  )
}
