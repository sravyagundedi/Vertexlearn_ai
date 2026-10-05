import re
from fastapi import APIRouter
from pydantic import BaseModel, Field
from ..rag.retriever import retrieve
from ..core.llm import generate

router = APIRouter(prefix='/ai', tags=['AI Tutor'])

class ChatBody(BaseModel):
    course_id: str
    question: str = Field(min_length=2)
    mode: str = 'intermediate'

STOP_WORDS = {
    'what', 'is', 'a', 'an', 'the', 'in', 'on', 'at', 'of', 'for', 'to', 'from',
    'by', 'with', 'about', 'and', 'or', 'how', 'why', 'can', 'you', 'explain',
    'tell', 'me', 'please', 'describe', 'give', 'example', 'does', 'do', 'are',
    'was', 'were', 'been', 'being', 'this', 'that', 'these', 'those', 'which'
}

def is_context_relevant(question: str, chunks: list[dict]) -> bool:
    if not chunks:
        return False
    words = [re.sub(r'[^a-zA-Z0-9]', '', w).lower() for w in question.split()]
    keywords = [w for w in words if len(w) >= 3 and w not in STOP_WORDS]
    if not keywords:
        return True
    corpus = ' '.join(
        (c.get('chunk_text', '') + ' ' + (c.get('lecture_title') or '')).lower()
        for c in chunks
    )
    return any(kw in corpus for kw in keywords)

@router.post('/chat')
def chat(b: ChatBody):
    chunks = retrieve(b.course_id, b.question, 4)
    if not chunks or not is_context_relevant(b.question, chunks):
        return {
            'reply': "I couldn't find enough information in this course material to answer that accurately.",
            'mode': b.mode,
            'sources': []
        }

    context = '\n\n'.join(
        f"[Source {i+1}: {x.get('lecture_title', 'Lecture')}] {x['chunk_text']}"
        for i, x in enumerate(chunks)
    )
    system = (
        f'You are VertexLearn AI Tutor. Answer only from the supplied course context. '
        f'If context is insufficient, state: "I couldn\'t find enough information in this course material to answer that accurately." '
        f'Explanation level: {b.mode}. Cite sources as [Source N: Lecture Title].'
    )
    reply = generate(system, f'COURSE CONTEXT:\n{context}\n\nQUESTION:\n{b.question}')
    return {
        'reply': reply,
        'mode': b.mode,
        'sources': [
            {
                'lecture_id': x.get('lecture_id'),
                'chunk_id': x.get('id'),
                'title': x.get('lecture_title') or 'Course Material'
            }
            for x in chunks
        ]
    }
