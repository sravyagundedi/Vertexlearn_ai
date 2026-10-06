import logging
from fastapi import HTTPException
from .config import ANTHROPIC_API_KEY, ANTHROPIC_MODEL

logger = logging.getLogger('ai-service.llm')

def generate(system: str, user: str) -> str:
    """
    Generate an LLM completion using Anthropic Claude.
    If the API key is not configured, raises an explicit HTTP 503 error
    instructing the operator to set ANTHROPIC_API_KEY.
    """
    key = (ANTHROPIC_API_KEY or '').strip()
    if not key:
        logger.warning("Anthropic API key is not configured.")
        raise HTTPException(
            status_code=503,
            detail="AI service is not configured. Add the required AI provider API key to the environment configuration."
        )

    try:
        from anthropic import Anthropic
        client = Anthropic(api_key=key)
        msg = client.messages.create(
            model=ANTHROPIC_MODEL,
            max_tokens=1000,
            system=system,
            messages=[{'role': 'user', 'content': user}]
        )
        ans = ''.join(getattr(x, 'text', '') for x in msg.content if getattr(x, 'type', '') == 'text')
        if ans and len(ans.strip()) > 0:
            return ans
        raise HTTPException(
            status_code=502,
            detail="AI provider returned an empty response."
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Anthropic API call failed: {exc}", exc_info=True)
        raise HTTPException(
            status_code=502,
            detail=f"AI provider request failed: {str(exc)}"
        )
