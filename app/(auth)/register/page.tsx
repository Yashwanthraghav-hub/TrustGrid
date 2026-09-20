import { AuthPage } from '@/components/layout/auth-page';

export default async function Register({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  return <AuthPage register emailSent={query.email_sent === '1'} emailError={typeof query.email_error === 'string' ? query.email_error : undefined} />;
}
