"""
Structured Audit Logging for MERIDIAN.
"""
from __future__ import annotations
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional
from src.config import Config

logger = logging.getLogger("meridian")
logger.setLevel(logging.INFO)

# Console handler
console_handler = logging.StreamHandler()
console_formatter = logging.Formatter("[%(asctime)s] [%(levelname)s] %(message)s", "%Y-%m-%d %H:%M:%S")
console_handler.setFormatter(console_formatter)
logger.addHandler(console_handler)


class AuditLogger:
    """Writes machine-readable structured JSON audit logs for each pipeline phase."""

    def __init__(self, log_dir: Optional[Path] = None):
        self.log_dir = log_dir or Config.LOGS_DIR
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self.log_file = self.log_dir / "meridian_audit.jsonl"

    def log_event(self, event_type: str, payload: Dict[str, Any], level: str = "INFO") -> None:
        """Append an audit log event in JSON Lines format."""
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event_type": event_type,
            "level": level,
            "payload": payload,
        }

        # Write to JSONL
        try:
            with open(self.log_file, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry, default=str) + "\n")
        except Exception as e:
            logger.error(f"Failed to write audit log: {e}")

        # Echo human message to standard log
        msg = f"[{event_type}] {payload.get('summary') or payload.get('message') or json.dumps(payload)}"
        if level == "ERROR":
            logger.error(msg)
        elif level == "WARNING":
            logger.warning(msg)
        else:
            logger.info(msg)


# Default global audit logger instance
audit_logger = AuditLogger()
