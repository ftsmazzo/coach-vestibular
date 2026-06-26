import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
montar = (root / "scripts/n8n-montar-resposta-api.js").read_text(encoding="utf-8")

ops = [
    {
        "type": "addNode",
        "node": {
            "name": "Webhook Extracao",
            "type": "n8n-nodes-base.webhook",
            "typeVersion": 2.1,
            "position": [-400, 520],
            "parameters": {
                "httpMethod": "POST",
                "path": "coach-extracao-prova",
                "responseMode": "responseNode",
                "options": {"binaryData": True, "binaryPropertyName": "file"},
            },
        },
    },
    {
        "type": "addNode",
        "node": {
            "name": "Extract PDF API",
            "type": "n8n-nodes-base.extractFromFile",
            "typeVersion": 1.1,
            "position": [-160, 520],
            "parameters": {
                "operation": "pdf",
                "binaryPropertyName": "file",
                "options": {"joinPages": True},
            },
        },
    },
    {
        "type": "addNode",
        "node": {
            "name": "IF API Path",
            "type": "n8n-nodes-base.if",
            "typeVersion": 2.3,
            "position": [480, 300],
            "parameters": {
                "conditions": {
                    "options": {
                        "version": 2,
                        "leftValue": "",
                        "caseSensitive": True,
                        "typeValidation": "strict",
                    },
                    "combinator": "and",
                    "conditions": [
                        {
                            "id": "webhook-exec",
                            "leftValue": "={{ $('Webhook Extracao').isExecuted }}",
                            "rightValue": True,
                            "operator": {
                                "type": "boolean",
                                "operation": "true",
                                "singleValue": True,
                            },
                        }
                    ],
                }
            },
        },
    },
    {
        "type": "addNode",
        "node": {
            "name": "Montar Resposta API",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [720, 200],
            "parameters": {"jsCode": montar},
        },
    },
    {
        "type": "addNode",
        "node": {
            "name": "Respond Extracao",
            "type": "n8n-nodes-base.respondToWebhook",
            "typeVersion": 1.5,
            "position": [960, 200],
            "parameters": {"respondWith": "json", "responseBody": "={{ $json }}"},
        },
    },
    {"type": "removeConnection", "source": "Cria Prova", "target": "Switch"},
    {"type": "addConnection", "source": "Webhook Extracao", "target": "Extract PDF API"},
    {"type": "addConnection", "source": "Extract PDF API", "target": "Cria Prova"},
    {"type": "addConnection", "source": "Cria Prova", "target": "IF API Path"},
    {
        "type": "addConnection",
        "source": "IF API Path",
        "target": "Montar Resposta API",
        "sourceIndex": 0,
    },
    {
        "type": "addConnection",
        "source": "IF API Path",
        "target": "Switch",
        "sourceIndex": 1,
    },
    {
        "type": "addConnection",
        "source": "Montar Resposta API",
        "target": "Respond Extracao",
    },
]

out = root / "tmp-n8n-update-ops.json"
out.write_text(
    json.dumps({"workflowId": "di9X3dnxu8AtFAqD", "operations": ops}, ensure_ascii=False),
    encoding="utf-8",
)
print(f"written {out} ({out.stat().st_size} bytes)")
