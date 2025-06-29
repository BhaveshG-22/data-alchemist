import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

interface NLModifyRequest {
  data: {
    headers: string[];
    rows: Record<string, unknown>[];
  };
  instruction: string;
  tableName?: string;
}

interface NLModifyResponse {
  success: boolean;
  updates?: {
    target: string;
    modifications: Array<{
      operation: 'update' | 'delete' | 'add';
      rowIndex?: number;
      rowId?: string;
      data?: Record<string, unknown>;
      newRow?: Record<string, unknown>;
    }>;
    summary: string;
  };
  error?: string;
  preview?: string;
}

const SYSTEM_PROMPT = `You are an assistant that helps modify spreadsheet-style data using natural language instructions.

You will receive:
1. Table data as JSON with headers and rows
2. A natural language instruction

Your task is to:
1. Understand the instruction and identify what changes need to be made
2. Return a structured response with the exact modifications needed
3. Be conservative - only modify what's explicitly requested
4. Preserve data types and schema structure

Response format:
{
  "target": "table_name",
  "modifications": [
    {
      "operation": "update",
      "rowIndex": 0,
      "data": { "column": "new_value" }
    }
  ],
  "summary": "Updated 3 rows: set PriorityLevel to 4 for all clients in GroupB"
}

Operations:
- "update": Modify existing row fields
- "delete": Remove rows (include rowIndex)
- "add": Add new rows (include newRow)

Rules:
1. Use rowIndex (0-based) to identify rows for updates/deletes
2. For updates, only include fields that actually change
3. Preserve existing data types (numbers as numbers, strings as strings)
4. If a row has an ID field, include it in modifications for safety
5. Be specific about what changed in the summary
6. If instruction is unclear or would cause data loss, explain the issue

Example data types to preserve:
- Numbers: keep as numbers (not strings)
- Arrays: ["item1", "item2"] format
- Booleans: true/false
- IDs: usually strings starting with letters`;

export async function POST(request: NextRequest) {
  try {
    const { data, instruction, tableName = 'data' }: NLModifyRequest = await request.json();

    if (!data || !instruction) {
      return NextResponse.json(
        { success: false, error: 'Missing data or instruction' },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const llm = new ChatOpenAI({
      modelName: 'gpt-3.5-turbo',
      temperature: 0.1,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    const userPrompt = `Table: ${tableName}
Headers: ${data.headers.join(', ')}

Data (showing first 10 rows for context):
${JSON.stringify(data.rows.slice(0, 10), null, 2)}

Total rows: ${data.rows.length}

Instruction: ${instruction}

Please provide the modifications needed to fulfill this instruction. Be precise and conservative.`;

    const messages = [
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage(userPrompt),
    ];

    const response = await llm.invoke(messages);
    const responseContent = response.content as string;

    let parsedResponse;
    try {
      // Extract JSON from response if it's wrapped in markdown or other text
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : responseContent;
      parsedResponse = JSON.parse(jsonStr);
    } catch (parseError) {
      return NextResponse.json({
        success: false,
        error: `Failed to parse AI response: ${responseContent}`,
      }, { status: 500 });
    }

    // Validate response structure
    if (!parsedResponse.modifications || !Array.isArray(parsedResponse.modifications)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid response format from AI',
      }, { status: 500 });
    }

    // Validate modifications
    for (const mod of parsedResponse.modifications) {
      if (!['update', 'delete', 'add'].includes(mod.operation)) {
        return NextResponse.json({
          success: false,
          error: `Invalid operation: ${mod.operation}`,
        }, { status: 400 });
      }

      if ((mod.operation === 'update' || mod.operation === 'delete') && 
          (typeof mod.rowIndex !== 'number' || mod.rowIndex < 0 || mod.rowIndex >= data.rows.length)) {
        return NextResponse.json({
          success: false,
          error: `Invalid rowIndex: ${mod.rowIndex}`,
        }, { status: 400 });
      }
    }

    // Generate preview
    const preview = generatePreview(parsedResponse.modifications, data);

    return NextResponse.json({
      success: true,
      updates: {
        target: parsedResponse.target || tableName,
        modifications: parsedResponse.modifications,
        summary: parsedResponse.summary || 'Data modifications prepared',
      },
      preview,
    });

  } catch (error) {
    console.error('Error in nl-modify API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function generatePreview(modifications: any[], data: { headers: string[]; rows: Record<string, unknown>[] }): string {
  const changes: string[] = [];
  
  for (const mod of modifications) {
    switch (mod.operation) {
      case 'update':
        const oldRow = data.rows[mod.rowIndex];
        const changedFields = Object.keys(mod.data || {});
        const oldValues = changedFields.map(field => `${field}: ${oldRow[field]}`).join(', ');
        const newValues = changedFields.map(field => `${field}: ${mod.data[field]}`).join(', ');
        changes.push(`Row ${mod.rowIndex + 1}: ${oldValues} → ${newValues}`);
        break;
      case 'delete':
        changes.push(`Delete row ${mod.rowIndex + 1}`);
        break;
      case 'add':
        const newRowStr = Object.entries(mod.newRow || {}).map(([k, v]) => `${k}: ${v}`).join(', ');
        changes.push(`Add new row: ${newRowStr}`);
        break;
    }
  }

  return changes.join('\n');
}