from typing import List, Dict, TypedDict, Optional, Annotated
import operator
from pydantic import BaseModel, Field

# Pydantic Models for Structured Output
class SearchQuery(BaseModel):
    query: str = Field(description="A specific search query to gather information.")
    rationale: str = Field(description="Why this query is important.")

class ResearchPlan(BaseModel):
    queries: List[SearchQuery] = Field(description="List of search queries to execute.")

class Citation(BaseModel):
    source_id: str = Field(description="The url or title of the source.")
    text: str = Field(description="The specific fact or quote being cited.")

class Feedback(BaseModel):
    score: int = Field(description="Quality score from 0 to 100.")
    critique: str = Field(description="Detailed feedback on what is missing or incorrect.")
    hallucination_check: bool = Field(description="True if potential hallucinations are found.")

# LangGraph State
class AgentState(TypedDict):
    topic: str
    plan: List[SearchQuery]
    research_data: Annotated[List[Dict], operator.add] # Append-only list of gathered info
    draft: str
    critique_count: int
    critique_score: Optional[int]
    critique_feedback: Optional[str]
    final_report: Optional[str]
    memory_hit: bool # Flag if topic was found in Supabase
    logs: Annotated[List[str], operator.add] # Log messages
    current_query_index: int # helper to iterate over queries
