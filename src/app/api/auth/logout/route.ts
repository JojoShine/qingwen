import { endSession } from '@/lib/auth';
import { handle } from '@/lib/http';
export function POST(req: Request) { return handle(req, async () => { await endSession(); return { ok: true }; }); }
