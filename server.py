from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import json
from main import build_graph

app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"status": "ok", "message": "Reasoning Agent Server is running"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        data = await websocket.receive_text()
        request = json.loads(data)
        topic = request.get("topic")

        if not topic:
            await websocket.send_text(json.dumps({"type": "error", "message": "No topic provided"}))
            return

        workflow = build_graph()
        
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

        # Stream the graph execution
        final_report = "No report generated."
        
        for event in workflow.stream(initial_state):
            for node_name, state_update in event.items():
                
                # Capture final report if present in update
                if "final_report" in state_update and state_update["final_report"]:
                    final_report = state_update["final_report"]
                
                # Send update to client
                response = {
                    "type": "update",
                    "node": node_name,
                    "status": f"Finished {node_name}",
                    "logs": state_update.get("logs", []),
                    "sources": [d['source'] for d in state_update.get("research_data", [])] if "research_data" in state_update else [],
                    "plan": [p.query for p in state_update.get("plan", [])] if "plan" in state_update else None,
                    "draft": state_update.get("draft") if "draft" in state_update else None
                }
                await websocket.send_text(json.dumps(response))
        
        await websocket.send_text(json.dumps({
            "type": "complete",
            "report": final_report
        }))

    except Exception as e:
        print(f"Error: {e}")
        await websocket.send_text(json.dumps({"type": "error", "message": str(e)}))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
