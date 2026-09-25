from fastapi import APIRouter
from pydantic import BaseModel
from ..core.llm import generate
router=APIRouter(prefix='/ai',tags=['AI Content'])
class TextBody(BaseModel): text:str
@router.post('/summarize')
def summarize(b:TextBody): return {'summary':generate('Summarize only the provided lesson text into concise learning points.',b.text)}
@router.post('/generate-quiz')
def quiz(b:TextBody): return {'draft':generate('Create 5 multiple-choice questions from the provided lesson. Return clear questions, four options and the correct option. Do not use outside knowledge.',b.text)}
@router.post('/flashcards')
def flashcards(b:TextBody): return {'flashcards':generate('Create 8 concise Q/A flashcards from the provided lesson.',b.text)}
@router.post('/study-plan')
def study_plan(b:TextBody): return {'plan':generate('Create a practical personalized study plan from this learner performance history. Include topics, time blocks and revision actions.',b.text)}
