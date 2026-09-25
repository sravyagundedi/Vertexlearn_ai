import psycopg
from .embeddings import demo_embedding
from ..core.config import DATABASE_URL

def retrieve(course_id:str,query:str,k:int=4):
    qv=demo_embedding(query)
    qv_str='['+','.join(map(str,qv))+']'
    with psycopg.connect(DATABASE_URL) as conn:
        rows=conn.execute('''SELECT id,lecture_id,chunk_text,embedding <=> %s::vector AS distance FROM document_chunks WHERE course_id=%s AND embedding IS NOT NULL ORDER BY embedding <=> %s::vector LIMIT %s''',(qv_str,course_id,qv_str,k)).fetchall()
        if rows:return [{'id':str(r[0]),'lecture_id':str(r[1]),'chunk_text':r[2],'distance':float(r[3])} for r in rows]
        fallback=conn.execute('''SELECT id,lecture_id,transcript FROM lectures l JOIN modules m ON m.id=l.module_id WHERE m.course_id=%s AND l.transcript IS NOT NULL LIMIT %s''',(course_id,k)).fetchall()
        return [{'id':None,'lecture_id':str(r[1]),'chunk_text':r[2],'distance':0.0} for r in fallback]
