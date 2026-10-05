import psycopg
from .embeddings import demo_embedding
from ..core.config import DATABASE_URL

def ingest_existing():
    try:
        with psycopg.connect(DATABASE_URL) as conn:
            rows = conn.execute(
                """
                SELECT
                    l.id,
                    m.course_id,
                    TRIM(COALESCE(l.transcript, '') || E'\n\n' || COALESCE(l.notes, '')) AS text
                FROM lectures l
                JOIN modules m ON m.id = l.module_id
                WHERE (l.transcript IS NOT NULL AND l.transcript <> '')
                   OR (l.notes IS NOT NULL AND l.notes <> '')
                """
            ).fetchall()

            for lecture_id, course_id, text in rows:
                if not text:
                    continue
                chunks = [text[i:i + 900] for i in range(0, len(text), 800)]
                for chunk in chunks:
                    chunk = chunk.strip()
                    if not chunk:
                        continue
                    exists = conn.execute(
                        """
                        SELECT 1
                        FROM document_chunks
                        WHERE lecture_id = %s
                          AND chunk_text = %s
                        LIMIT 1
                        """,
                        (lecture_id, chunk),
                    ).fetchone()

                    if not exists:
                        embedding = demo_embedding(chunk)
                        conn.execute(
                            """
                            INSERT INTO document_chunks
                            (
                                course_id,
                                lecture_id,
                                chunk_text,
                                embedding
                            )
                            VALUES (%s, %s, %s, %s::vector)
                            """,
                            (
                                course_id,
                                lecture_id,
                                chunk,
                                "[" + ",".join(map(str, embedding)) + "]",
                            ),
                        )

            conn.commit()
            print('[RAG Ingestion] Successfully ingested course chunks into pgvector.')
    except Exception as exc:
        print('[RAG Ingestion] Warning: Could not complete chunk ingestion:', exc)
