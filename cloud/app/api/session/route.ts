import { getChatGPTUser } from '../../chatgpt-auth';
export const dynamic = 'force-dynamic';
export async function GET() {
  const user = await getChatGPTUser();
  return Response.json(user ? { id: user.userId, displayName: user.displayName, cloud: true, ai: false } : { error: '請先登入。' }, { status: user ? 200 : 401, headers: { 'Cache-Control': 'no-store, private', 'Vary': 'Cookie' } });
}
