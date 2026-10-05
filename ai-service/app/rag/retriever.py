import psycopg
from .embeddings import demo_embedding
from ..core.config import DATABASE_URL

def retrieve(course_id: str, query: str, k: int = 4):
    qv = demo_embedding(query)
    qv_str = '[' + ','.join(map(str, qv)) + ']'
    with psycopg.connect(DATABASE_URL) as conn:
        rows = conn.execute(
            '''SELECT dc.id, dc.lecture_id, dc.chunk_text, dc.embedding <=> %s::vector AS distance, l.title 
               FROM document_chunks dc
               LEFT JOIN lectures l ON l.id = dc.lecture_id
               WHERE dc.course_id = %s AND dc.embedding IS NOT NULL 
               ORDER BY dc.embedding <=> %s::vector LIMIT %s''',
            (qv_str, course_id, qv_str, k)
        ).fetchall()
        if rows:
            return [{'id': str(r[0]), 'lecture_id': str(r[1]) if r[1] else None, 'chunk_text': r[2], 'distance': float(r[3]), 'lecture_title': r[4]} for r in rows]

        # Fallback to direct lecture transcripts if vector chunks haven't been ingested yet
        fallback = conn.execute(
            '''
            SELECT l.id, l.title, l.transcript
            FROM lectures l
            JOIN modules m ON m.id = l.module_id
            WHERE m.course_id = %s
              AND l.transcript IS NOT NULL
              AND l.transcript <> ''
            LIMIT %s
            ''',
            (course_id, k)
        ).fetchall()
        return [{'id': None, 'lecture_id': str(r[0]), 'chunk_text': f"Lecture: {r[1]}\n{r[2]}", 'distance': 0.0} for r in fallback]
