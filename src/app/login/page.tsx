import LoginForm from '@/components/login-form';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  const username = process.env.DEMO_USERNAME, password = process.env.DEMO_PASSWORD;
  return <LoginForm demo={username && password ? { username, password } : null}/>;
}
