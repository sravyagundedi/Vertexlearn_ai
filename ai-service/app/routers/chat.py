from fastapi import APIRouter
from pydantic import BaseModel, Field
from ..rag.retriever import retrieve
from ..core.llm import generate
router=APIRouter(prefix='/ai',tags=['AI Tutor'])
class ChatBody(BaseModel): course_id:str; question:str=Field(min_length=2); mode:str='intermediate'
@router.post('/chat')
def chat(b:ChatBody):
    chunks=retrieve(b.course_id,b.question,4)
    context='\n\n'.join(f"[Source {i+1}] {x['chunk_text']}" for i,x in enumerate(chunks))
    system=f'You are VertexLearn AI Tutor. Answer only from the supplied course context. If context is insufficient, say so. Explanation level: {b.mode}. Cite sources as [Source N].'
    reply=generate(system,f'COURSE CONTEXT:\n{context}\n\nQUESTION:\n{b.question}')
    return {'reply':reply,'mode':b.mode,'sources':[{'lecture_id':x['lecture_id'],'chunk_id':x['id']} for x in chunks]}
