"""Keeper agent swarm (WS3) — LangGraph over Fireworks OSS models.

Public API:
    build_graph()        -> compiled LangGraph
    astream_events(id)   -> async generator of Contract-C event dicts (for the WS)
    run_demo(id)         -> sync end-to-end replay (prints the stream)

See keeper/tasks/TASK_WS3_agents.md and CONTRACTS.md (Contract C).
"""
from .graph import astream_events, build_graph, run_demo

__all__ = ["astream_events", "build_graph", "run_demo"]
