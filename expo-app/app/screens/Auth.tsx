import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import GlassWrapper from '../components/GlassWrapper';
import ErrorText from '../components/ErrorText';
import { GradientButton } from '../components/GradientButton';
import { useAuth } from '../lib/auth';

export default function AuthScreen({ onDone }: { onDone: () => void }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState({ email: false, password: false, confirm: false });
  const [loading, setLoading] = useState(false);

  // Clear any global error as user edits inputs (feels much better in auth forms)
  useEffect(() => {
    if (!error) return;
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, password, confirm, mode]);

  const fieldErrors = useMemo(() => {
    const errs: Record<string, string | null> = { email: null, password: null, confirm: null };
    const e = email.trim();
    if (!e || !e.includes('@')) errs.email = 'Enter a valid email address.';
    if (password.length < 8) errs.password = 'Password must be at least 8 characters.';
    if (mode === 'register') {
      if (!confirm) errs.confirm = 'Confirm your password.';
      else if (password !== confirm) errs.confirm = 'Passwords do not match.';
    }
    return errs;
  }, [email, password, confirm, mode]);

  const canSubmit = !fieldErrors.email && !fieldErrors.password && (mode !== 'register' || !fieldErrors.confirm);

  async function submit() {
    setTouched({ email: true, password: true, confirm: true });
    if (!canSubmit) {
      // Show the most important error in a banner for quick visibility
      const msg = fieldErrors.email || fieldErrors.password || fieldErrors.confirm || 'Please fix the errors above.';
      setError(msg);
      return;
    }

    const e = email.trim();

    setLoading(true);
    try {
      if (mode === 'login') await login(e, password);
      else await register(e, password);
      onDone();
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <GlassWrapper className="px-6">
      <View className="flex-1 justify-center">
        <Text className="text-2xl font-semibold text-white mb-2">
          {mode === 'login' ? 'Login' : 'Create account'}
        </Text>

        <View className="flex-row gap-2 mb-4">
          <TouchableOpacity
            onPress={() => setMode('login')}
            className={[
              'flex-1 rounded-xl px-4 py-3 items-center',
              mode === 'login' ? 'bg-white' : 'bg-white/10',
            ].join(' ')}
          >
            <Text className={[
              'font-semibold',
              mode === 'login' ? 'text-brand-600' : 'text-white'
            ].join(' ')}>Login</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setMode('register')}
            className={[
              'flex-1 rounded-xl px-4 py-3 items-center',
              mode === 'register' ? 'bg-white' : 'bg-white/10',
            ].join(' ')}
          >
            <Text className={[
              'font-semibold',
              mode === 'register' ? 'text-brand-600' : 'text-white'
            ].join(' ')}>Create</Text>
          </TouchableOpacity>
        </View>

        <View className="gap-3">
          {/* Global error banner (server errors + submit validation summary) */}
          {error ? (
            <View className="rounded-2xl bg-red-500/15 border border-red-400/30 px-4 py-3">
              <ErrorText className="text-red-50 font-semibold" style={{ color: '#FFF1F2' }}>
                {error}
              </ErrorText>
            </View>
          ) : null}

          <TextInput
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              if (!touched.email) setTouched((t) => ({ ...t, email: true }));
            }}
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            className={[
              'bg-white/10 border rounded-2xl px-4 py-3 text-white',
              touched.email && fieldErrors.email ? 'border-red-300/60' : 'border-white/15',
            ].join(' ')}
            placeholderTextColor="rgba(255,255,255,0.7)"
          />
          {touched.email && fieldErrors.email ? (
            <ErrorText>{fieldErrors.email}</ErrorText>
          ) : null}

          <TextInput
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              if (!touched.password) setTouched((t) => ({ ...t, password: true }));
            }}
            placeholder="Password"
            secureTextEntry
            className={[
              'bg-white/10 border rounded-2xl px-4 py-3 text-white',
              touched.password && fieldErrors.password ? 'border-red-300/60' : 'border-white/15',
            ].join(' ')}
            placeholderTextColor="rgba(255,255,255,0.7)"
          />
          {touched.password && fieldErrors.password ? (
            <ErrorText>{fieldErrors.password}</ErrorText>
          ) : null}

          {mode === 'register' && (
            <>
              <TextInput
                value={confirm}
                onChangeText={(v) => {
                  setConfirm(v);
                  if (!touched.confirm) setTouched((t) => ({ ...t, confirm: true }));
                }}
                placeholder="Confirm password"
                secureTextEntry
                className={[
                  'bg-white/10 border rounded-2xl px-4 py-3 text-white',
                  touched.confirm && fieldErrors.confirm ? 'border-red-300/60' : 'border-white/15',
                ].join(' ')}
                placeholderTextColor="rgba(255,255,255,0.7)"
              />
              {touched.confirm && fieldErrors.confirm ? (
                <ErrorText>{fieldErrors.confirm}</ErrorText>
              ) : null}
            </>
          )}

          <GradientButton
            title={loading ? 'Please wait…' : (mode === 'login' ? 'Login' : 'Create account')}
            onPress={submit}
          />

          <TouchableOpacity
            onPress={onDone}
            className="rounded-2xl px-6 py-4 bg-white/10 border border-white/15"
            disabled={loading}
          >
            <Text className="text-white font-semibold text-center">Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    </GlassWrapper>
  );
}
