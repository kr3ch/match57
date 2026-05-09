"""Realtime layer: WebSocket endpoint + ConnectionManager singleton.

Used by REST handlers (likes, messages, admin) to push events to connected
clients without coupling to the WS module.
"""

from app.realtime.manager import ConnectionManager, manager

__all__ = ["ConnectionManager", "manager"]
