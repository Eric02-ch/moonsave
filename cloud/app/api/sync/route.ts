import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { handleSync } from '../../../lib/sync-handler.mjs';
export const dynamic = 'force-dynamic';
async function sync(request: Request) {
  try {
    const user = await getChatGPTUser();
    return await handleSync(request, { db: env.DB, userId: user?.userId });
  } catch {
    return Response.json({ error: '雲端服務暫時無法完成，本機資料仍保留。' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
export { sync as GET, sync as PUT };
