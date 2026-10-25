import { useState } from "react"
import { View } from "react-native"
import { Link, useRouter } from "expo-router"
import { KeyboardAwareScrollView } from "react-native-keyboard-controller"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Button, Input, Text, useTheme } from "@/design-system"
import { BrandMark } from "@/components/BrandMark"
import { ApiError } from "@/lib/api-client"
import { useSessionStore } from "@/services/session-store"

export default function LoginScreen() {
  const { colors, space } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const signIn = useSessionStore(s => s.signIn)
  const expired = useSessionStore(s => s.expired)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setError(null)
    if (!email.trim() || !password) return setError("Bitte E-Mail und Passwort eingeben.")
    setLoading(true)
    try {
      await signIn(email.trim(), password)
      router.replace("/(tabs)")
    } catch (err) {
      setError(err instanceof ApiError ? (err.status === 401 ? "E-Mail oder Passwort ist falsch." : err.isNetwork ? "Keine Verbindung zum Server." : err.message) : "Anmeldung fehlgeschlagen.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAwareScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ flexGrow: 1, padding: space[6], paddingTop: insets.top + space[10], paddingBottom: insets.bottom + space[6], gap: space[6] }} keyboardShouldPersistTaps="handled">
      <View style={{ gap: space[4] }}>
        <BrandMark size={56} />
        <Text variant="display">Pondus</Text>
        <Text variant="body" color="secondary">
          Dein Training. Dein Gewicht. Dein Fortschritt.
        </Text>
      </View>
      {expired ? (
        <Text variant="callout" color="secondary">
          Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.
        </Text>
      ) : null}
      <View style={{ gap: space[4] }}>
        <Input label="E-Mail" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" returnKeyType="next" />
        <Input label="Passwort" value={password} onChangeText={setPassword} secureTextEntry textContentType="password" returnKeyType="go" onSubmitEditing={() => void submit()} error={error} />
        <Button title="Anmelden" fullWidth loading={loading} onPress={() => void submit()} />
      </View>
      <View style={{ flexDirection: "row", gap: space[1], justifyContent: "center", marginTop: "auto" }}>
        <Text variant="callout" color="secondary">
          Neu hier?
        </Text>
        <Link href="/(auth)/register">
          <Text variant="calloutStrong" color="accent">
            Konto erstellen
          </Text>
        </Link>
      </View>
    </KeyboardAwareScrollView>
  )
}
