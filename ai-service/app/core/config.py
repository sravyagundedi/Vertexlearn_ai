import os
DATABASE_URL=os.getenv('DATABASE_URL','postgresql://vertexlearn:vertexlearn@db:5432/vertexlearn')
ANTHROPIC_API_KEY=os.getenv('ANTHROPIC_API_KEY','')
ANTHROPIC_MODEL=os.getenv('ANTHROPIC_MODEL','claude-3-5-sonnet-latest')
