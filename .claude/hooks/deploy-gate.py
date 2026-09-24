#!/usr/bin/env python3
"""Before a real deploy of the games hub, ask Seif to confirm (PreToolUse hook on Bash).

A deploy touches a machine shared with fleet-critical services, and approval in one context
doesn't carry over to the next. So any command that runs deploy/deploy.sh (other than
--checks, which only reads) pauses for a human yes, and reminds Claude of the hub-deploy skill.
"""
import json
import re
import sys

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)

command = (data.get("tool_input") or {}).get("command") or ""
# Run as a command (start of line, or after ; & | ( &&), directly or through bash/sh; not just read.
deploys = re.search(r"(?:^|[;&|(\n])\s*(?:(?:ba)?sh\s+)?(?:\S*/)?deploy/deploy\.sh\b(?![^;&|\n]*--checks)", command)
if data.get("tool_name") == "Bash" and deploys:
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "ask",
            "permissionDecisionReason": (
                "Deploy to trix.rheona.space (shared Rheona VPS). The hub-deploy skill applies: "
                "Seif's go for this change, a clean tree, the full regression green, neighbours healthy first."
            ),
        }
    }))
sys.exit(0)
