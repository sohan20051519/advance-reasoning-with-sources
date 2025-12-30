import os
from typing import Dict, Any, List
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import SystemMessage, HumanMessage
from dotenv import load_dotenv

from state import AgentState, ResearchPlan, Feedback
from tools import ToolManager

load_dotenv()

# Initialize LLM
# Using available model from user environment (1.5-flash is 404)
llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash-lite", 
    temperature=0,
    google_api_key=os.getenv("GOOGLE_API_KEY")
)

tools = ToolManager()

def check_memory_node(state: AgentState) -> AgentState:
    """Checks if the topic exists in Supabase memory."""
    print(f"--- Checking Memory for: {state['topic']} ---")
    existing_data = tools.check_memory(state['topic'])
    
    if existing_data:
        print("--- Memory Hit! Returning cached report. ---")
        return {
            **state, 
            "memory_hit": True, 
            "final_report": existing_data.get('content', {}).get('report', 'No report content found.') if isinstance(existing_data.get('content'), dict) else existing_data.get('content'),
            "logs": ["--- Memory Hit! Returning cached report. ---"]
        }
    
    print("--- No Memory Found. Proceeding to Plan. ---")
    return {**state, "memory_hit": False, "logs": [f"Checking Memory for: {state['topic']}", "--- No Memory Found. Proceeding to Plan. ---"]}

def planner_node(state: AgentState) -> AgentState:
    """Generates a research plan based on the topic."""
    print("--- Planning Research ---")
    
    # Structured output binding
    planner_llm = llm.with_structured_output(ResearchPlan)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a Senior Research Planner. Breakdown the user topic into 3-5 distinct, actionable search queries to gather comprehensive information."),
        ("human", "Topic: {topic}")
    ])
    
    chain = prompt | planner_llm
    plan: ResearchPlan = chain.invoke({"topic": state['topic']})
    
    return {**state, "plan": plan.queries, "research_data": [], "logs": ["--- Planning Research ---", f"Generated {len(plan.queries)} search queries."], "current_query_index": 0}

def researcher_node(state: AgentState) -> AgentState:
    """Executes the research plan using Tavily and Firecrawl."""
    queries = state['plan']
    current_index = state.get('current_query_index', 0)
    
    if current_index >= len(queries):
        return {"logs": ["All queries completed."]} # Should be handled by conditional edge, but safety check.

    q = queries[current_index]
    log_buffer = [f"--- Researching Query {current_index + 1}/{len(queries)}: {q.query} ---"]
    print(f"Searching: {q.query}")
    
    results = tools.search_tavily(q.query)
    
    new_data = []
    for result in results[:2]:
        content = result.get('content', '')
        url = result.get('url', '')
        
        new_data.append({
            "source": url,
            "content": content,
            "query": q.query
        })

    # Return only the updates. 
    # research_data is Annotated with add, so we return the list of NEW items.
    # logs is Annotated with add, so we return NEW logs.
    # current_query_index is overwritten.
    return {
        "research_data": new_data, 
        "logs": log_buffer,
        "current_query_index": current_index + 1
    }

def writer_node(state: AgentState) -> AgentState:
    """Synthesizes research data into a report."""
    print("--- Writing Draft ---")
    data_summary = "\n\n".join([f"Source: {d['source']}\nContent: {d['content']}" for d in state['research_data']])
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a Professional Technical Writer. Synthesize the provided research data into a comprehensive Markdown report. \\n\\n"
                   "Follow these rules STRICTLY:\\n"
                   "1. Start with a clear level 1 header (# Title) for the report title.\\n"
                   "2. Use level 2 headers (## Section) for main sections and level 3 (### Subsection) for subsections.\\n"
                   "3. Use bolding (**bold**) for key terms and important concepts.\\n"
                   "4. Ensure there is a blank line between every paragraph and list item for proper spacing.\\n"
                   "5. Use bullet points for lists of features or takeaways.\\n"
                   "6. Cite sources inline using [Source Title](URL) format.\\n"
                   "7. Add a 'References' section at the end.\\n"
                   "8. Do NOT output raw text blocks without formatting. Make it visually structured and easy to read."),
        ("human", "Topic: {topic}\n\nResearch Data:\n{data}")
    ])
    
    chain = prompt | llm
    draft = chain.invoke({"topic": state['topic'], "data": data_summary})
    
    return {**state, "draft": draft.content, "logs": ["--- Writing Draft ---", "Draft generated."]}

def critique_node(state: AgentState) -> AgentState:
    """Reviews the draft for quality and hallucinations."""
    print("--- Critiquing Draft ---")
    
    critique_llm = llm.with_structured_output(Feedback)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a Strict Editor. Review the draft for completeness, accuracy, and adherence to the topic. Rate it 0-100."),
        ("human", "Topic: {topic}\n\nDraft:\n{draft}")
    ])
    
    chain = prompt | critique_llm
    feedback: Feedback = chain.invoke({"topic": state['topic'], "draft": state['draft']})
    
    count = state.get('critique_count', 0) + 1
    
    return {
        **state, 
        "critique_score": feedback.score, 
        "critique_feedback": feedback.critique,
        "critique_count": count,
        "logs": ["--- Critiquing Draft ---", f"Critique Score: {feedback.score}/100"],
        "current_query_index": 0
    }

def save_memory_node(state: AgentState) -> AgentState:
    """Saves the final authorized report to Supabase."""
    print("--- Saving to Memory ---")
    # If we are here, the report is finalized (either good score or max retries)
    final_content = state['draft']
    tools.save_memory(state['topic'], final_content)
    return {**state, "final_report": final_content, "logs": ["--- Saving to Memory ---", "Report saved to database."]}
