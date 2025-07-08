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

const SYSTEM_PROMPT = `You are a data modification assistant. Analyze the user's request and return a simple JSON response.

Available operations:
- "update": modify existing rows
- "delete": remove rows  
- "add": insert new rows

Response format (REQUIRED):
{
  "operation": "update",
  "column": "FieldName", 
  "conditions": [
    {
      "column": "ColumnName",
      "operator": "equals" | "not_equals" | "contains" | "not_contains" | "starts_with" | "ends_with" | "greater_than" | "less_than" | "in" | "not_in",
      "value": "value_to_compare" | ["multiple", "values"]
    }
  ],
  "newValue": "new_value_for_updates",
  "summary": "Brief description"
}

Examples:

User: "Set all PriorityLevel to 5"
{
  "operation": "update",
  "column": "PriorityLevel",
  "conditions": [],
  "newValue": "5",
  "summary": "Set all PriorityLevel to 5"
}

User: "Set PriorityLevel 2 to 4"  
{
  "operation": "update",
  "column": "PriorityLevel",
  "conditions": [
    {"column": "PriorityLevel", "operator": "equals", "value": "2"}
  ],
  "newValue": "4",
  "summary": "Update PriorityLevel from 2 to 4"
}

User: "Set PriorityLevel to 4 for all clients except those already at 5"
{
  "operation": "update",
  "column": "PriorityLevel", 
  "conditions": [
    {"column": "PriorityLevel", "operator": "not_equals", "value": "5"}
  ],
  "newValue": "4",
  "summary": "Set PriorityLevel to 4 except those at 5"
}

User: "Update QualificationLevel to Senior for Backend and QA workers only"
{
  "operation": "update",
  "column": "QualificationLevel",
  "conditions": [
    {"column": "Group", "operator": "in", "value": ["Backend", "QA"]}
  ],
  "newValue": "Senior", 
  "summary": "Update Backend and QA workers to Senior"
}

User: "Delete inactive clients"
{
  "operation": "delete",
  "conditions": [
    {"column": "Status", "operator": "equals", "value": "inactive"}
  ],
  "summary": "Delete inactive clients"
}

User: "Change tasks with python skills to have communication skills"
{
  "operation": "update",
  "column": "RequiredSkills",
  "conditions": [
    {"column": "RequiredSkills", "operator": "contains", "value": "python"}
  ],
  "newValue": "communication",
  "summary": "Update python tasks to require communication skills"
}

User: "Update tasks containing Development to have RequiredSkills communication"
{
  "operation": "update",
  "column": "RequiredSkills",
  "conditions": [
    {"column": "TaskName", "operator": "contains", "value": "Development"}
  ],
  "newValue": "communication",
  "summary": "Update tasks containing Development to require communication skills"
}

User: "Assign phase 5 to PreferredPhases for all tasks that currently include phase 1 but not phase 3"
{
  "operation": "update",
  "column": "PreferredPhases",
  "conditions": [
    {"column": "PreferredPhases", "operator": "contains", "value": "1"},
    {"column": "PreferredPhases", "operator": "not_contains", "value": "3"}
  ],
  "newValue": "add phase 5",
  "summary": "Assign phase 5 to tasks with phase 1 but not phase 3"
}

User: "Change all worker group names that start with Dev to Development"
{
  "operation": "update",
  "column": "Group",
  "conditions": [
    {"column": "Group", "operator": "starts_with", "value": "Dev"},
    {"column": "Group", "operator": "not_equals", "value": "Development"}
  ],
  "newValue": "Development",
  "summary": "Change group names starting with Dev to Development"
}

Key patterns to recognize:
- "enterprise clients" = filter by GroupTag=enterprise, update clients
- "Frontend workers" = filter by Group=Frontend, update workers  
- "Development tasks" = filter by Category=Development, update tasks
- "Premium clients" = filter by Type=Premium, update clients
- "inactive tasks" = filter by Status=inactive
- "tasks with X" = filter by RequiredSkills contains X
- "clients in GroupB" = filter by GroupTag=GroupB

Return ONLY valid JSON, no markdown or extra text.`;

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

    const userPrompt = `Available columns: ${data.headers.join(', ')}
Total rows: ${data.rows.length}

User instruction: ${instruction}

Analyze this instruction and respond with the exact JSON format specified.`;

    const messages = [
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage(userPrompt),
    ];

    const response = await llm.invoke(messages);
    const responseContent = response.content as string;

    let aiResponse;
    try {
      // Extract JSON from response if it's wrapped in markdown or other text
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : responseContent;
      aiResponse = JSON.parse(jsonStr);
      
      console.log('AI Response:', aiResponse);
    } catch (parseError) {
      console.error('Parse error:', parseError);
      return NextResponse.json({
        success: false,
        error: `Failed to parse AI response: ${responseContent}`,
      }, { status: 500 });
    }

    // Validate required fields
    if (!aiResponse.operation) {
      return NextResponse.json({
        success: false,
        error: 'AI response missing required field: operation',
      }, { status: 400 });
    }


    // Generate modifications based on conditions array
    const modifications = [];
    
    for (let i = 0; i < data.rows.length; i++) {
      const row = data.rows[i];
      let shouldModify = true;

      // Apply all conditions (AND logic)
      if (aiResponse.conditions && aiResponse.conditions.length > 0) {
        for (const condition of aiResponse.conditions) {
          const rowValue = String(row[condition.column] || '');
          const conditionValue = condition.value;
          
          let conditionMet = false;
          
          switch (condition.operator) {
            case 'equals':
              conditionMet = rowValue === String(conditionValue);
              break;
            case 'not_equals':
              conditionMet = rowValue !== String(conditionValue);
              break;
            case 'contains':
              conditionMet = rowValue.toLowerCase().includes(String(conditionValue).toLowerCase());
              break;
            case 'not_contains':
              conditionMet = !rowValue.toLowerCase().includes(String(conditionValue).toLowerCase());
              break;
            case 'starts_with':
              conditionMet = rowValue.toLowerCase().startsWith(String(conditionValue).toLowerCase());
              break;
            case 'ends_with':
              conditionMet = rowValue.toLowerCase().endsWith(String(conditionValue).toLowerCase());
              break;
            case 'greater_than':
              conditionMet = parseFloat(rowValue) > parseFloat(String(conditionValue));
              break;
            case 'less_than':
              conditionMet = parseFloat(rowValue) < parseFloat(String(conditionValue));
              break;
            case 'in':
              if (Array.isArray(conditionValue)) {
                conditionMet = conditionValue.some(val => String(val) === rowValue);
              } else {
                conditionMet = rowValue === String(conditionValue);
              }
              break;
            case 'not_in':
              if (Array.isArray(conditionValue)) {
                conditionMet = !conditionValue.some(val => String(val) === rowValue);
              } else {
                conditionMet = rowValue !== String(conditionValue);
              }
              break;
            default:
              conditionMet = false;
          }
          
          if (!conditionMet) {
            shouldModify = false;
            break; // AND logic - if any condition fails, don't modify
          }
        }
      }

      if (shouldModify) {
        if (aiResponse.operation === 'update') {
          modifications.push({
            operation: 'update',
            rowIndex: i,
            data: { [aiResponse.column]: aiResponse.newValue },
          });
        } else if (aiResponse.operation === 'delete') {
          modifications.push({
            operation: 'delete',
            rowIndex: i,
          });
        }
      }
    }

    // Generate preview
    const preview = generatePreview(modifications, data);

    return NextResponse.json({
      success: true,
      updates: {
        target: tableName,
        modifications,
        summary: aiResponse.summary || `Applied ${modifications.length} modifications`,
      },
      preview,
      debug: process.env.NODE_ENV === 'development' ? {
        aiResponse: responseContent,
        parsedResponse: aiResponse,
        totalRows: data.rows.length,
        modificationsGenerated: modifications.length
      } : undefined
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