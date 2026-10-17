import { requireUser } from '@/lib/auth';
import { handle } from '@/lib/http';
export function GET(req: Request) { return handle(req, () => requireUser()); }
