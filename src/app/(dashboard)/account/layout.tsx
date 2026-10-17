import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (user?.isDemo) redirect('/surveys');
  return children;
}
