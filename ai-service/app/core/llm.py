from .config import ANTHROPIC_API_KEY,ANTHROPIC_MODEL

def generate(system:str,user:str)->str:
    if not ANTHROPIC_API_KEY:
        return demo_answer(user)
    from anthropic import Anthropic
    client=Anthropic(api_key=ANTHROPIC_API_KEY)
    msg=client.messages.create(model=ANTHROPIC_MODEL,max_tokens=900,system=system,messages=[{'role':'user','content':user}])
    return ''.join(getattr(x,'text','') for x in msg.content if getattr(x,'type','')=='text')

def demo_answer(user:str)->str:
    if 'quiz' in user.lower(): return 'Demo mode: review the retrieved lesson content, then use the generated quiz draft returned by the API. Add ANTHROPIC_API_KEY for production-quality generation.'
    return 'Demo mode: I can answer from the retrieved course material. Add ANTHROPIC_API_KEY to enable the production LLM response.'
