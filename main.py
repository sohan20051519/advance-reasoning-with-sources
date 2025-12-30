import sys
from langgraph.graph import StateGraph, END
from state import AgentState
from agents import (
    check_memory_node, 
    planner_node, 
    researcher_node, 
    writer_node, 
    critique_node, 
    save_memory_node
)

def build_graph():
    """Constructs the LangGraph workflow."""
    workflow = StateGraph(AgentState)

    # Add Nodes
    workflow.add_node("check_memory", check_memory_node)
    workflow.add_node("planner", planner_node)
    workflow.add_node("researcher", researcher_node)
    workflow.add_node("writer", writer_node)
    workflow.add_node("critique", critique_node)
    workflow.add_node("save_memory", save_memory_node)

    # Add Edges
    workflow.set_entry_point("check_memory")

    # Conditional Edge from Check Memory
    def check_memory_condition(state: AgentState):
        if state.get("memory_hit", False):
            return "end"
        return "continue"

    workflow.add_conditional_edges(
        "check_memory",
        check_memory_condition,
        {
            "end": END,
            "continue": "planner"
        }
    )

    # Normal Edges
    workflow.add_edge("planner", "researcher")
    
    # Conditional Loop for Researcher
    def research_condition(state: AgentState):
        if state.get("current_query_index", 0) < len(state.get("plan", [])):
            return "continue"
        return "done"

    workflow.add_conditional_edges(
        "researcher",
        research_condition,
        {
            "continue": "researcher",
            "done": "writer"
        }
    )
    
    workflow.add_edge("writer", "critique")

    # Conditional Edge from Critique
    def critique_condition(state: AgentState):
        score = state.get("critique_score", 0)
        count = state.get("critique_count", 0)
        
        # If score is good (>70) or retried too many times (>3), stop.
        if score > 70 or count > 3:
            return "good"
        return "retry"

    workflow.add_conditional_edges(
        "critique",
        critique_condition,
        {
            "good": "save_memory",
            "retry": "researcher" # Back to research (or could go to writer, but gathering more info is usually better)
        }
    )

    workflow.add_edge("save_memory", END)

    return workflow.compile()

def run_cli():
    print("=== P7 Autonomous Research Agent ===")
    app = build_graph()
    
    topic = input("Enter a research topic: ")
    if not topic:
        print("Topic cannot be empty.")
        return

    print(f"\nStarting research on: {topic}...\n")
    
    initial_state = {
        "topic": topic,
        "plan": [],
        "research_data": [],
        "draft": "",
        "critique_count": 0,
        "critique_score": 0,
        "memory_hit": False,
        "final_report": "",
        "current_query_index": 0
    }
    
    try:
        final_report = "No report generated."
        # Run the graph
        for output in app.stream(initial_state):
            for key, value in output.items():
                print(f"Finished Node: {key}")
                if "final_report" in value and value["final_report"]:
                    final_report = value["final_report"]
        
        print("\n=== FINAL REPORT ===\n")
        print(final_report)
        
    except Exception as e:
        print(f"An error occurred: {e}")
        print("Tip: Ensure you have set your API keys in .env")

if __name__ == "__main__":
    run_cli()
