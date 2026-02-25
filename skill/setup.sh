#!/bin/bash
echo "Starting CamoFox MCP in HTTP mode..."
echo "Ensure CamoFox Browser is running on port 9377"
echo ""
CAMOFOX_TRANSPORT=http npx camofox-mcp@1.10.0
