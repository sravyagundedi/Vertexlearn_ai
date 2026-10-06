import json
import re
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..core.llm import generate

router = APIRouter(prefix='/ai', tags=['AI Content'])

class TextBody(BaseModel):
    text: str

@router.post('/summarize')
def summarize(b: TextBody):
    system_prompt = (
        "You are an expert educational AI summarizer. Generate a structured, concise lesson summary "
        "grounded strictly in the provided lecture material. "
        "Your summary MUST include the following 5 markdown sections:\n"
        "### 📌 Overview\n"
        "### 💡 Key Concepts\n"
        "### 🎯 Important Points\n"
        "### 📖 Key Definitions\n"
        "### 📝 Exam & Revision Points\n\n"
        "Format cleanly with bullet points and bold terms."
    )
    return {
        'summary': generate(system_prompt, f"LESSON MATERIAL:\n{b.text}")
    }

@router.post('/generate-quiz')
def quiz(b: TextBody):
    system_prompt = (
        "You are an expert LMS exam creator. Generate exactly 5 high quality multiple-choice questions "
        "grounded strictly in the provided course lesson material. "
        "Return ONLY a valid JSON array of objects with keys: "
        "question_text (string), "
        "options (array of 4 objects each with option_text string and is_correct boolean), "
        "explanation (string explaining why the correct option is right)."
    )
    raw = generate(system_prompt, f"LESSON MATERIAL:\n{b.text}")

    # Try to extract JSON if present in raw
    parsed_questions = None
    try:
        json_match = re.search(r'\[\s*\{.*\}\s*\]', raw, re.DOTALL)
        if json_match:
            parsed_questions = json.loads(json_match.group(0))
    except Exception:
        parsed_questions = None

    if not parsed_questions or not isinstance(parsed_questions, list):
        raise HTTPException(
            status_code=502,
            detail="Failed to generate valid quiz questions from the AI model."
        )

    return {
        'draft': raw,
        'questions': parsed_questions
    }

class FlashcardsBody(BaseModel):
    text: str
    count: int = 8

@router.post('/flashcards')
def flashcards(b: FlashcardsBody):
    system_prompt = (
        "You are an expert LMS educator. Create between 6 to 10 concise Q/A flashcards strictly "
        "grounded in the provided course lesson material.\n"
        "Return ONLY a valid JSON array of objects with keys:\n"
        "\"question\" (string concept or question for front of card),\n"
        "\"answer\" (string concise explanation or definition for back of card).\n"
        "Do NOT return markdown formatting outside the JSON array."
    )
    raw = generate(system_prompt, f"LESSON MATERIAL:\n{b.text}")

    parsed_cards = None
    try:
        json_match = re.search(r'\[\s*\{.*\}\s*\]', raw, re.DOTALL)
        if json_match:
            parsed_cards = json.loads(json_match.group(0))
    except Exception:
        parsed_cards = None

    if not parsed_cards or not isinstance(parsed_cards, list):
        raise HTTPException(
            status_code=502,
            detail="Failed to generate valid flashcards from the AI model."
        )

    return {
        'draft': raw,
        'flashcards': parsed_cards
    }

    return {
        'draft': raw,
        'flashcards': parsed_cards
    }

@router.post('/study-plan')
def study_plan(b: TextBody):
    return {
        'plan': generate('Create a practical personalized study plan from this learner performance history. Include topics, time blocks and revision actions.', b.text)
    }
