import psycopg
from .embeddings import demo_embedding
from ..core.config import DATABASE_URL

def retrieve(course_id: str | None, query: str, k: int = 4):
    qv = demo_embedding(query)
    qv_str = '[' + ','.join(map(str, qv)) + ']'
    with psycopg.connect(DATABASE_URL) as conn:
        if course_id:
            rows = conn.execute(
                '''SELECT dc.id, dc.lecture_id, dc.chunk_text, dc.embedding <=> %s::vector AS distance, l.title, c.title AS course_title
                   FROM document_chunks dc
                   LEFT JOIN lectures l ON l.id = dc.lecture_id
                   LEFT JOIN courses c ON c.id = dc.course_id
                   WHERE dc.course_id = %s AND dc.embedding IS NOT NULL 
                   ORDER BY dc.embedding <=> %s::vector LIMIT %s''',
                (qv_str, course_id, qv_str, k)
            ).fetchall()
        else:
            rows = conn.execute(
                '''SELECT dc.id, dc.lecture_id, dc.chunk_text, dc.embedding <=> %s::vector AS distance, l.title, c.title AS course_title
                   FROM document_chunks dc
                   LEFT JOIN lectures l ON l.id = dc.lecture_id
                   LEFT JOIN courses c ON c.id = dc.course_id
                   WHERE dc.embedding IS NOT NULL 
                   ORDER BY dc.embedding <=> %s::vector LIMIT %s''',
                (qv_str, qv_str, k)
            ).fetchall()

        if rows:
            return [
                {
                    'id': str(r[0]),
                    'lecture_id': str(r[1]) if r[1] else None,
                    'chunk_text': r[2],
                    'distance': float(r[3]),
                    'lecture_title': r[4] or 'Course Material',
                    'course_title': r[5] or 'VertexLearn Course'
                }
                for r in rows
            ]

        # Fallback to direct lecture transcripts
        if course_id:
            fallback = conn.execute(
                '''
                SELECT l.id, l.title, l.transcript, c.title AS course_title
                FROM lectures l
                JOIN modules m ON m.id = l.module_id
                JOIN courses c ON c.id = m.course_id
                WHERE m.course_id = %s
                  AND l.transcript IS NOT NULL
                  AND l.transcript <> ''
                LIMIT %s
                ''',
                (course_id, k)
            ).fetchall()
        else:
            fallback = conn.execute(
                '''
                SELECT l.id, l.title, l.transcript, c.title AS course_title
                FROM lectures l
                JOIN modules m ON m.id = l.module_id
                JOIN courses c ON c.id = m.course_id
                WHERE l.transcript IS NOT NULL
                  AND l.transcript <> ''
                LIMIT %s
                ''',
                (k,)
            ).fetchall()

        return [
            {
                'id': None,
                'lecture_id': str(r[0]),
                'chunk_text': f"Lecture: {r[1]}\n{r[2]}",
                'distance': 0.0,
                'lecture_title': r[1] or 'Lecture Material',
                'course_title': r[3] or 'Course'
            }
            for r in fallback
        ]
