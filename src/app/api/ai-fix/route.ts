import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';

// Initialize the LLM
const llm = new ChatOpenAI({
  modelName: 'gpt-3.5-turbo',
  temperature: 0.3,
  apiKey: process.env.OPENAI_API_KEY,
});

// Define prompt templates for different issue types
const PROMPT_TEMPLATES = {
  missing_columns: `You are a data validation expert helping users fix all header issues in a spreadsheet at once.

Issue Context:
- File Type: {fileType}
- Sheet: {sheet}
- Current Headers: {currentHeaders}
- Required Headers: {requiredHeaders}
- Missing Columns: {missingColumns}
- Unexpected Columns: {unexpectedColumns}
- Sample Data (first 5 rows): {sampleData}

Task: Create an optimal fix plan by matching unexpected columns with missing columns. ONLY work with the columns listed in "Missing Columns" and "Unexpected Columns" - do not suggest actions for any other columns.

Critical Rules:
1. ONLY suggest actions for columns explicitly listed in "Missing Columns" and "Unexpected Columns"
2. If you rename an unexpected column to satisfy a missing column, DO NOT also suggest adding that missing column
3. Only suggest adding a missing column if no unexpected column can be renamed to satisfy it
4. Each unexpected column should only be used once in renames
5. NEVER suggest actions for columns that are NOT in the missing or unexpected lists
6. Analyze data content patterns for matching:
   - Column with IDs like "C1", "C2", "W1", "client_001", "worker-123" → should be "ClientID", "WorkerID", "TaskID"
   - Column with names like "John Doe", "Acme Corp", "Jane Smith", "Data Analysis Task" → should be "ClientName", "WorkerName", "TaskName"
   - Column with numbers 1-5 → likely "PriorityLevel"
   - Column with skills/tags like "javascript,python", "react,node" → likely "Skills" or "RequiredSkills"
   - Column with time values like "8", "16", "24" or arrays "[1,2,3]" → likely "Duration", "AvailableSlots", "PreferredPhases"
   - Column with groups/categories like "Premium", "Backend", "Phase1" → likely "GroupTag", "Category", "WorkerGroup"
   - Column with JSON-like text or key:value pairs → likely "AttributesJSON"
   - Column with levels/ratings like "Senior", "Junior", "Expert" → likely "QualificationLevel"
   - Column with capacity numbers like "5", "10", "20" → likely "MaxLoadPerPhase", "MaxConcurrent"

Analysis Algorithm (follow exactly):
1. Create a list of all missing columns to process
2. Create a list of all unexpected columns to process
3. For each missing column:
   a. Check if any unexpected column has matching data content
   b. If match found: suggest rename (unexpected → missing) and remove both from processing lists
   c. If no match: mark this missing column for addition
4. For any remaining unexpected columns: suggest removal
5. For any remaining missing columns: suggest addition

IMPORTANT: Once you use an unexpected column in a rename, it's GONE - don't suggest removing it separately. Once you satisfy a missing column with a rename, it's SATISFIED - don't suggest adding it separately.

Response format:
💡 **Header Fix Plan**:
[Apply the algorithm step by step. For Missing: [ClientID, ClientName] and Unexpected: [clientid, clientID]:

Step 1: Match "ClientID" with "clientid" (IDs like C1, C2) → Rename "clientid" to "ClientID"
Step 2: Match "ClientName" with "clientID" (names like Acme Corp) → Rename "clientID" to "ClientName"
Step 3: All missing columns satisfied, all unexpected columns used - DONE

Result:
- Rename "clientid" to "ClientID" (satisfies missing ClientID)
- Rename "clientID" to "ClientName" (satisfies missing ClientName)

DO NOT add or remove anything else since all columns are accounted for.]

📋 **Priority**: Renames first, then additions, finally removals
⚠️ **Note**: [Brief explanation of the matching logic used]

Solution:`,

  duplicate_ids: `You are a data validation expert helping users fix duplicate ID issues.

Issue Context:
- File Type: {fileType}
- Column: {column}
- Issue: {issueMessage}
- Duplicate Value: {currentValue}

Task: Suggest a unique replacement ID that follows the same pattern.

Response format:
💡 **Fix**: [Exact unique ID to use, e.g. "client_124", "TASK_005"]
📋 **Pattern**: [Explain the ID pattern used]
⚠️ **Note**: [Brief explanation]

Solution:`,

  malformed_lists: `You are a data validation expert helping users fix list format issues.

Issue Context:
- File Type: {fileType}
- Column: {column}
- Issue: {issueMessage}
- Current Value: {currentValue}
- Expected Format: {expectedFormat}

Task: Convert the malformed list into proper comma-separated format.

Response format:
💡 **Fix**: [Exact comma-separated list, e.g. "skill1,skill2,skill3" or "1,2,3"]
📝 **Format**: [Explain the correct format]
✅ **Example**: [Show example]

Solution:`,

  out_of_range: `You are a data validation expert helping users fix out-of-range values.

Issue Context:
- File Type: {fileType}
- Column: {column}
- Issue: {issueMessage}
- Current Value: {currentValue}
- Valid Range: {expectedFormat}

Task: Suggest a valid value within the acceptable range.

Response format:
💡 **Fix**: [Exact value within range, e.g. "3", "2.5"]
📊 **Range**: [Explain the valid range]
🎯 **Reasoning**: [Why this value makes sense]

Solution:`,

  json_fields: `You are a data validation expert helping users fix JSON format issues.

Issue Context:
- File Type: {fileType}
- Column: {column}
- Row: {row}
- Issue: {issueMessage}
- Current Value: {currentValue}
- Expected Format: {expectedFormat}

Task: Convert the invalid JSON string into a valid JSON object. Follow these rules:

CRITICAL RULES:
1. If the current value is literally "null" (the string), return just: null
2. If the current value contains meaningful data, extract key-value pairs
3. DO NOT create imaginary JSON objects - only extract what's actually there

Examples:
- "null" → null
- "name John age 30" → {"name": "John", "age": 30}
- "status active priority high" → {"status": "active", "priority": "high"}
- "location New York budget 50000" → {"location": "New York", "budget": 50000}

Response format:
💡 **Fix**: [Valid JSON - either null or object based on actual content]
📊 **Explanation**: [Why this fix works]
✅ **Example**: [Show correct format with example]

CRITICAL: If the value is "null" string, return just null. Do NOT create fake JSON objects.

Solution:`,

  references: `You are a data validation expert helping users fix reference issues.

Issue Context:
- File Type: {fileType}
- Column: {column}
- Issue: {issueMessage}
- Invalid Reference: {currentValue}

Task: Suggest valid references that exist in the target sheet.

Response format:
💡 **Fix**: [Valid reference ID that exists, or suggest removal]
🔗 **Available IDs**: [List some valid IDs if known]
📋 **Action**: [Specific action to take]

Solution:`,

  overloaded_workers: `You are a data validation expert helping users fix worker capacity issues.

Issue Context:
- File Type: {fileType}
- Issue: {issueMessage}
- Current Value: {currentValue}

Task: Suggest capacity adjustments to resolve overload.

Response format:
💡 **Fix**: [Exact value adjustment, e.g. reduce MaxLoadPerPhase to "8" or increase AvailableSlots to "12"]
👥 **Reasoning**: [Explain the capacity logic]
⚖️ **Balance**: [How this creates proper balance]

Solution:`,

  skill_coverage: `You are a data validation expert helping users fix skill coverage issues.

Issue Context:
- File Type: {fileType}
- Issue: {issueMessage}
- Missing Skill: {currentValue}

Task: Suggest how to resolve the skill coverage gap.

Response format:
💡 **Fix**: [Specific action - add worker with skill, remove task requirement, etc.]
🎯 **Skills**: [Specific skills to add or modify]
📋 **Implementation**: [How to implement the fix]

Solution:`,

  concurrency_feasibility: `You are a data validation expert helping users fix concurrency feasibility issues.

Issue Context:
- File Type: {fileType}
- Column: {column}
- Issue: {issueMessage}
- Current Invalid Value: {currentValue}

Task: Suggest a feasible MaxConcurrent value based on available qualified workers.

The issue indicates that the current MaxConcurrent value exceeds the number of qualified workers available. You need to suggest a number that matches the available worker capacity.

Response format:
💡 **Fix**: [Just the number - e.g. "2", "3", "5"]
📝 **How to Fix**: [Explain why this value is appropriate based on available workers]
⚖️ **Balance**: [How this achieves proper resource allocation]

IMPORTANT: Return ONLY the numeric value in the Fix section, not a JSON object.

Solution:`,

  circular_corun: `You are a data validation expert helping users fix circular dependency issues.

Issue Context:
- File Type: {fileType}
- Issue: {issueMessage}

Task: Suggest how to break the circular dependency.

Response format:
💡 **Fix**: [Specific action to break the cycle]
♻️ **Dependencies**: [Show the dependency chain]
🔧 **Resolution**: [How to restructure]

Solution:`,

  conflicting_rules: `You are a data validation expert helping users fix conflicting business rules.

Issue Context:
- File Type: {fileType}
- Issue: {issueMessage}

Task: Suggest how to resolve the rule conflict.

Response format:
💡 **Fix**: [Specific rule modification]
⚠️ **Conflict**: [Explain the conflict]
🔧 **Resolution**: [How to resolve]

Solution:`,

  phase_saturation: `You are a data validation expert helping users fix phase capacity issues.

Issue Context:
- File Type: {fileType}
- Issue: {issueMessage}

Task: Suggest capacity adjustments for phases.

Response format:
💡 **Fix**: [Specific capacity adjustment]
📈 **Saturation**: [Explain the saturation issue]
⚖️ **Balance**: [How to rebalance]

Solution:`,

  missing_data: `You are a data validation expert helping users fix missing data issues.

Issue Context:
- File Type: {fileType}
- Column: {column}
- Row: {row}
- Issue: {issueMessage}

Task: Suggest appropriate values or methods to fill missing required data. Be specific about the exact value.

Response format:
💡 **Suggested Value**: [Exact value to use - be specific, e.g. "client_123" for ClientID, "3" for priority]
🎯 **Reasoning**: [Why this value makes sense]
📋 **Alternatives**: [Other valid options]

Important: The Suggested Value should be the EXACT text to put in the cell.

Solution:`,

  natural_language_query: `You are a JavaScript filter function generator. Convert natural language queries into JavaScript filter functions for data retrieval.

Context:
- Target Sheet: {sheet}
- Data Schema: {schema}
- User Query: "{query}"

Important parsing rules:
- PreferredPhases: Array like [1,2,3] or parsed from ranges/comma-separated values
- Skills/RequiredSkills: Arrays of strings
- Duration: Numeric values (number of phases)
- IDs: String values, may be arrays for multiple references
- Priority/Level fields: Numeric or string values
- All field names are already parsed and available as properties

Task: Generate a JavaScript function body that returns true/false for filtering.

Examples:
- "tasks longer than 2 phases" → "task.Duration > 2"
- "tasks that prefer phase 3" → "task.PreferredPhases && task.PreferredPhases.includes(3)"
- "high priority clients" → "client.PriorityLevel && (String(client.PriorityLevel).toLowerCase().includes('high') || Number(client.PriorityLevel) >= 4)"
- "workers with JavaScript skills" → "worker.Skills && worker.Skills.some(skill => skill.toLowerCase().includes('javascript'))"

Return ONLY the JavaScript expression that evaluates to true/false (without 'return' keyword):

`
};

// File type context for better suggestions
const FILE_CONTEXTS = {
  clients: {
    description: 'Client information and contact details',
    requiredHeaders: ['ClientID', 'ClientName', 'PriorityLevel', 'RequestedTaskIDs', 'GroupTag', 'AttributesJSON'],
    dataTypes: {
      PriorityLevel: 'integer (1-5)',
      RequestedTaskIDs: 'comma-separated TaskIDs',
      AttributesJSON: 'valid JSON metadata'
    }
  },
  workers: {
    description: 'Worker profiles and assignments',
    requiredHeaders: ['WorkerID', 'WorkerName', 'Skills', 'AvailableSlots', 'MaxLoadPerPhase', 'WorkerGroup', 'QualificationLevel'],
    dataTypes: {
      Skills: 'comma-separated tags',
      AvailableSlots: 'array of phase numbers (e.g. [1,3,5])',
      MaxLoadPerPhase: 'integer'
    }
  },
  tasks: {
    description: 'Task definitions and requirements',
    requiredHeaders: ['TaskID', 'TaskName', 'Category', 'Duration', 'RequiredSkills', 'PreferredPhases', 'MaxConcurrent'],
    dataTypes: {
      Duration: 'number of phases (≥1)',
      RequiredSkills: 'comma-separated tags',
      PreferredPhases: 'list or range syntax (e.g. "1-3" or [2,4,5])',
      MaxConcurrent: 'integer (max parallel assignments)'
    }
  }
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { issue, query, category, context, currentHeaders, sampleData, missingColumns, unexpectedColumns, requiredHeaders, sheet } = body;

    // Handle natural language query requests
    if (category === 'natural_language_query' && query && context) {
      const templateKey = 'natural_language_query';
      const promptTemplate = PROMPT_TEMPLATES[templateKey];

      // Create prompt variables for natural language query
      const promptVariables: Record<string, string> = {
        sheet: context.sheet || 'unknown',
        schema: context.schema || 'No schema provided',
        query: query || 'No query provided'
      };

      // Process template
      let processedTemplate = promptTemplate;
      Object.entries(promptVariables).forEach(([varName, value]) => {
        processedTemplate = processedTemplate.replace(new RegExp(`\\{${varName}\\}`, 'g'), value);
      });

      const response = await llm.invoke(processedTemplate);

      return NextResponse.json({
        suggestion: response.content || response,
        issueType: category,
        query: query,
      });
    }

    if (!issue) {
      return NextResponse.json(
        { error: 'Issue data is required' },
        { status: 400 }
      );
    }

    // Get file context
    const fileContext = FILE_CONTEXTS[issue.sheet as keyof typeof FILE_CONTEXTS];
    
    // Select appropriate prompt template
    const templateKey = issue.category as keyof typeof PROMPT_TEMPLATES;
    const promptTemplate = PROMPT_TEMPLATES[templateKey] || PROMPT_TEMPLATES.json_fields;

    // Helper function to sanitize values for LangChain
    const sanitizeValue = (value: unknown): string => {
      if (value === null || value === undefined) return 'Not provided';
      if (typeof value === 'string') {
        // Remove any special characters that might cause issues
        return value.replace(/[{}]/g, '').trim() || 'Not provided';
      }
      return String(value).replace(/[{}]/g, '').trim() || 'Not provided';
    };

    // Format sample data for display
    const formatSampleData = (data: Record<string, any[]>) => {
      if (!data || Object.keys(data).length === 0) return 'No sample data available';
      
      // Debug: Log the actual sample data
      console.log('Sample data being sent to AI:', JSON.stringify(data, null, 2));
      
      const formatted = Object.entries(data).map(([column, values]) => {
        const sampleValues = values.slice(0, 5).map(v => `"${v}"`).join(', ');
        return `${column}: [${sampleValues}]`;
      }).join('\n');
      
      console.log('Formatted sample data for AI:', formatted);
      return formatted;
    };

    // Debug: Log what we're receiving
    console.log('AI Fix Debug - Received data:');
    console.log('- currentHeaders:', currentHeaders);
    console.log('- requiredHeaders:', requiredHeaders);
    console.log('- missingColumns:', missingColumns);
    console.log('- unexpectedColumns:', unexpectedColumns);

    // Create a comprehensive variable set with all possible variables that any template might need
    const promptVariables: Record<string, string> = {
      // Base variables (used in all templates)
      fileType: sanitizeValue(`${issue.sheet} (${fileContext?.description || 'data file'})`),
      issueMessage: sanitizeValue(issue.message),
      sheet: sanitizeValue(sheet || issue.sheet || 'Unknown'),
      
      // Header-specific variables (for missing_columns template)
      currentHeaders: sanitizeValue(currentHeaders ? currentHeaders.join(', ') : 'Not provided'),
      requiredHeaders: sanitizeValue(requiredHeaders ? requiredHeaders.join(', ') : fileContext?.requiredHeaders?.join(', ') || 'Not specified'),
      missingColumns: sanitizeValue(missingColumns ? missingColumns.join(', ') : 'None'),
      unexpectedColumns: sanitizeValue(unexpectedColumns ? unexpectedColumns.join(', ') : 'None'),
      sampleData: formatSampleData(sampleData || {}),
      
      // Data/row-specific variables (for other templates)
      column: sanitizeValue(issue.column || 'Unknown'),
      row: sanitizeValue(issue.row !== undefined ? (issue.row + 1).toString() : 'Unknown'),
      currentValue: sanitizeValue(issue.value || sampleData?.currentValue || 'Empty'),
      expectedFormat: sanitizeValue(fileContext?.dataTypes?.[issue.column as keyof typeof fileContext.dataTypes] || 'As per requirements'),
      dataType: sanitizeValue(fileContext?.dataTypes?.[issue.column as keyof typeof fileContext.dataTypes] || 'Standard format'),
    };

    // Ensure all variables are non-empty strings
    Object.keys(promptVariables).forEach(key => {
      if (!promptVariables[key] || promptVariables[key].trim() === '') {
        promptVariables[key] = 'Not provided';
      }
    });

    // Extract variables from template for processing
    const templateVars = promptTemplate.match(/\{([^}]+)\}/g) || [];
    const expectedVars = templateVars.map(v => v.slice(1, -1)); // Remove { }

    // Try alternative approach without LangChain PromptTemplate
    try {
      // Manually replace template variables to bypass LangChain template issues
      let processedTemplate = promptTemplate;
      expectedVars.forEach(varName => {
        const value = promptVariables[varName] || 'Not provided';
        processedTemplate = processedTemplate.replace(new RegExp(`\\{${varName}\\}`, 'g'), value);
      });


      // Create a simple prompt without PromptTemplate
      const response = await llm.invoke(processedTemplate);

      return NextResponse.json({
        suggestion: response.content || response,
        issueType: issue.category,
        fileType: issue.sheet,
      });
    } catch (templateError) {
      console.error('Template creation/invocation error:', templateError);
      
      // Try with even simpler approach
      try {
        const simplePrompt = `You are a data validation expert. 

Issue: ${promptVariables.issueMessage}
Current Value: ${promptVariables.currentValue}
Required Format: ${promptVariables.dataType}

Convert the current value to proper JSON format. Create a flat JSON object with meaningful key-value pairs extracted from the text.

Examples:
- "location New York budget 50000" → {"location": "New York", "budget": 50000}
- "ensure deliverables align with project scope" → {"description": "ensure deliverables align with project scope"}

Response format:
💡 **Fix**: [Only the JSON object - no column name wrapping]
📝 **Explanation**: [how to fix it]

IMPORTANT: Return ONLY the JSON object in the Fix section.

Fix:`;

        const response = await llm.invoke(simplePrompt);
        
        return NextResponse.json({
          suggestion: response.content || response,
          issueType: issue.category,
          fileType: issue.sheet,
        });
      } catch (simpleError) {
        console.error('Simple prompt also failed:', simpleError);
        throw templateError;
      }
    }


  } catch (error) {
    console.error('AI Fix API Error:', error);
    
    // Fallback response
    const requestBody = await request.json().catch(() => ({}));
    const fallbackSuggestion = getFallbackSuggestion(requestBody?.issue);
    
    return NextResponse.json({
      suggestion: fallbackSuggestion,
      issueType: requestBody?.issue?.category || 'unknown',
      fileType: requestBody?.issue?.sheet || 'unknown',
      fallback: true,
    });
  }
}

// Fallback suggestions when AI is unavailable
function getFallbackSuggestion(issue: { category?: string; message?: string; sheet?: string; column?: string; row?: number }): string {
  if (!issue || !issue.message) return 'Please check your data format and try again.';

  switch (issue.category) {
    case 'missing_columns':
      if (issue.message.includes('Missing required column')) {
        const columnName = issue.column || 'unknown';
        return `💡 **Add Missing Column**: Add a column named "${columnName}" to your ${issue.sheet} file.\n\n📋 **Steps**:\n1. Open your file in Excel/Google Sheets\n2. Add "${columnName}" as a new column header\n3. Fill the column with appropriate data\n4. Save and re-upload the file`;
      } else if (issue.message.includes('Unexpected column')) {
        const columnName = issue.column || 'unknown';
        return `💡 **Remove Unexpected Column**: The column "${columnName}" should not be in the ${issue.sheet} file.\n\n📋 **Options**:\n1. Delete this column if not needed\n2. Move this data to the correct file type\n3. Rename if it matches a required column`;
      }
      break;

    case 'duplicate_ids':
      const duplicateValue = (issue as any).value || 'unknown';
      return `💡 **Fix Duplicate ID**: Change the duplicate ID "${duplicateValue}" to a unique identifier.\n\n🔄 **Suggestions**:\n• Add a suffix: ${duplicateValue}_2\n• Use a timestamp: ${duplicateValue}_${Date.now()}\n• Follow your ID pattern`;

    case 'malformed_lists':
      return `💡 **Fix List Format**: Update ${issue.column} to use comma-separated values.\n\n📝 **Examples**:\n• Skills: "javascript,python,react"\n• IDs: "1,2,3,4"\n• Remove extra spaces and special characters`;

    case 'out_of_range':
      return `💡 **Fix Range Value**: Update ${issue.column} to use a valid range value.\n\n📊 **Check**:\n• PriorityLevel: Use numbers 1-5\n• Duration: Use positive numbers\n• Ensure numeric values are within limits`;

    case 'json_fields':
      return `💡 **Fix JSON Format**: Update ${issue.column} to use valid JSON syntax.\n\n🔧 **Example**:\n• Good: {"key": "value", "number": 123}\n• Bad: {key: value, number: 123}\n• Ensure quotes around keys and string values`;

    case 'references':
      return `💡 **Fix Reference**: Ensure the referenced ID exists in the target sheet.\n\n🔗 **Actions**:\n• Check if the ID exists in the referenced sheet\n• Remove invalid references\n• Update to valid IDs`;

    case 'overloaded_workers':
      return `💡 **Fix Worker Capacity**: Adjust worker capacity settings.\n\n👥 **Options**:\n• Reduce MaxLoadPerPhase\n• Increase AvailableSlots\n• Redistribute workload`;

    case 'skill_coverage':
      return `💡 **Fix Skill Coverage**: Ensure all required skills are available.\n\n🎯 **Solutions**:\n• Add workers with missing skills\n• Update worker skill lists\n• Remove tasks requiring unavailable skills`;

    case 'concurrency_feasibility':
      return `💡 **Fix Concurrency**: Update concurrency settings for feasibility.\n\n⚡ **Check**:\n• Ensure MaxConcurrent is positive\n• Verify capacity limits\n• Adjust based on worker availability`;

    default:
      return 'Please review the data format requirements and update accordingly.';
  }

  return 'Please review the data format requirements and update accordingly.';
}