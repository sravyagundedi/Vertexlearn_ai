import psycopg
from .embeddings import demo_embedding
from ..core.config import DATABASE_URL

def ingest_existing():
    with psycopg.connect(DATABASE_URL) as conn:
        rows=conn.execute('''SELECT l.id,m.course_id,l.transcript FROM lectures l JOIN modules m ON m.id=l.module_id WHERE l.transcript IS NOT NULL AND l.transcript<>''').fetchall()
        for lecture_id,course_id,text in rows:
            for chunk in [text[i:i+900] for i in range(0,len(text),800)]:
                exists=conn.execute('SELECT 1 FROM document_chunks WHERE lecture_id=%s AND chunk_text=%s LIMIT 1',(lecture_id,chunk)).fetchone()
                if not exists: conn.execute('INSERT INTO document_chunks(course_id,lecture_id,chunk_text,embedding) VALUES(%s,%s,%s,%s::vector)',(course_id,lecture_id,chunk,'['+','.join(map(str,demo_embedding(chunk)))+']'))
        conn.commit()
