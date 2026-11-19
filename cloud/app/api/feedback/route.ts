import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {handleFeedback} from '../../../lib/feedback-handler.mjs';
export const dynamic='force-dynamic';
async function feedback(request:Request) {
  const user=await getChatGPTUser();
  const runtime=env as unknown as {DB:unknown;OPENAI_API_KEY?:string;OPENAI_MODEL?:string};
  return handleFeedback(request,{db:runtime.DB,userId:user?.userId,apiKey:runtime.OPENAI_API_KEY,model:runtime.OPENAI_MODEL});
}
export {feedback as GET,feedback as POST};
