from fastapi import FastAPI
from .routers.chat import router as chat_router
from .routers.content import router as content_router
from .rag.ingest import ingest_existing
app=FastAPI(title='VertexLearn AI Service',version='1.0.0')
@app.get('/health')
def health(): return {'status':'ok','service':'ai'}
app.include_router(chat_router)
app.include_router(content_router)

@app.on_event('startup')
def startup():
    try: ingest_existing()
    except Exception as exc: print('RAG bootstrap skipped:', exc)
