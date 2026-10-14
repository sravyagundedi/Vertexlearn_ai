import os

DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://vertexlearn:vertexlearn@db:5432/vertexlearn')
ANTHROPIC_API_KEY = os.getenv('ANTHROPIC_API_KEY', '')
ANTHROPIC_MODEL = os.getenv('ANTHROPIC_MODEL', 'claude-3-5-sonnet-latest')
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')
OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'gpt-4o-mini')
GROQ_API_KEY = os.getenv('GROQ_API_KEY', '')
GROQ_MODEL = os.getenv('GROQ_MODEL', 'llama-3.3-70b-versatile')
OLLAMA_BASE_URL = os.getenv('OLLAMA_BASE_URL', '')
OLLAMA_MODEL = os.getenv('OLLAMA_MODEL', 'llama3')
