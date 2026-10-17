import { expect, it, vi } from 'vitest';
import { uid } from './survey';
it('generates valid unique UUIDs on HTTP LAN where randomUUID is unavailable',()=>{
  const real=globalThis.crypto;
  vi.stubGlobal('crypto',{getRandomValues:real.getRandomValues.bind(real)});
  try{const a=uid(),b=uid();expect(a).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);expect(a).not.toBe(b);}finally{vi.unstubAllGlobals();}
});
