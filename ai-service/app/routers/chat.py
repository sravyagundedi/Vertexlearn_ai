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
        (c.get('chunk_text', '') + ' ' + (c.get('lecture_title') or '') + ' ' + (c.get('course_title') or '')).lower()
        for c in chunks
    )
    return any(kw in corpus for kw in keywords)

@router.post('/chat')
def chat(b: ChatBody):
    # 1. Check current course material
    chunks = retrieve(b.course_id, b.question, 4)
    relevant = is_context_relevant(b.question, chunks)
    cross_course = False

    # 2. If current course lacks matching context, search entire curriculum
    if not relevant or not chunks:
        global_chunks = retrieve(None, b.question, 4)
        if global_chunks and is_context_relevant(b.question, global_chunks):
            chunks = global_chunks
            relevant = True
            cross_course = True

    context_segments = []
    if relevant and chunks:
        context_segments = [
            f"[Source {i+1}: {x.get('lecture_title', 'Lesson')} ({x.get('course_title', 'Course')})]\n{x['chunk_text']}"
            for i, x in enumerate(chunks)
        ]

    context_str = "\n\n".join(context_segments) if context_segments else "General Computer Science / Software Engineering Query."

    system = (
        f"You are VertexLearn AI Copilot, an elite computer science tutor and interactive learning guide.\n"
        f"Explanation Mode: {b.mode}.\n"
        f"Your mission is to provide accurate, engaging, and thorough explanations.\n"
        f"- Use everyday analogies to demystify complex architectures.\n"
        f"- Contrast differences using structured markdown comparison tables where appropriate.\n"
        f"- Provide clean, readable code snippets when relevant.\n"
        f"- If course context is provided, integrate it and cite sources as [Source N: Title].\n"
        f"- Always be encouraging and pedagogically structured."
    )

    note_prefix = ""
    if cross_course and chunks:
        primary_course = chunks[0].get('course_title', 'another course')
        note_prefix = f"💡 *Curriculum Note: While this concept is formally taught in our **{primary_course}** course, here is a complete, clear breakdown for you:*\n\n"

    user_prompt = f"STUDENT QUESTION:\n{b.question}\n\nCOURSE CONTEXT:\n{context_str}"
    reply = generate(system, user_prompt)

    if note_prefix and not reply.startswith("💡"):
        reply = note_prefix + reply

    sources = [
        {
            'lecture_id': x.get('lecture_id'),
            'chunk_id': x.get('id'),
            'title': f"{x.get('lecture_title', 'Lesson')} ({x.get('course_title', 'Course')})"
        }
        for x in (chunks if relevant else [])
    ]

    return {
        'reply': reply,
        'mode': b.mode,
        'sources': sources
    }
