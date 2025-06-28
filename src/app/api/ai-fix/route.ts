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
  header: `You are a data validation expert helping users fix file structure issues.

Issue Context:
- File Type: {fileType}
- Issue: {issueMessage}
- Current Headers: {currentHeaders}
- Required Headers: {requiredHeaders}

Task: Provide a specific header fix that can be applied automatically. Focus on exact header names to rename or add.

Response format:
💡 **Fix**: [Exact header name to use, e.g. "ClientID", "WorkerName"]
📋 **Action**: [Specific action like "Rename customer_id to ClientID" or "Add missing ClientName column"]
⚠️ **Note**: [Brief explanation]

IMPORTANT: The Fix section should contain only the exact header name that should be used.

Solution:`,

  data: `You are a data validation expert helping users fix data type and format issues.

Issue Context:
- File Type: {fileType}
- Column: {column}
- Row: {row}
- Issue: {issueMessage}
- Current Value: {currentValue}
- Expected Format: {expectedFormat}

Task: Provide a specific solution to fix this data validation issue. Be very specific about the exact value to use.

Response format:
💡 **Fix**: [Exact value or format to use - be specific, e.g. "3" for priority, "[1,2,3]" for arrays]
📊 **Explanation**: [Why this fix works]
✅ **Example**: [Show correct format with example]

Important: The Fix section should contain the EXACT value that should replace the current value.

Solution:`,

  format: `You are a data validation expert helping users fix format and structure issues.

Issue Context:
- File Type: {fileType}
- Column: {column}
- Issue: {issueMessage}
- Current Invalid Value: {currentValue}
- Data Type Required: {dataType}

Task: Convert the current invalid value into proper JSON format. The result should be a flat JSON object with meaningful key-value pairs extracted from the text, NOT nested under the column name.

Examples of good conversions:
- "location New York budget 50000" → {"location": "New York", "budget": 50000}
- "priority high deadline 2024-01-15" → {"priority": "high", "deadline": "2024-01-15"}
- "ensure deliverables align with project scope" → {"description": "ensure deliverables align with project scope"}
- "status active category premium" → {"status": "active", "category": "premium"}

Response format:
💡 **Fix**: [Only the JSON object - no wrapping, no column name prefix]
📝 **How to Fix**: [Explain the conversion logic]

IMPORTANT: Return ONLY the JSON object in the Fix section. Do not wrap it with the column name.

Solution:`,

  missing: `You are a data validation expert helping users fix missing data issues.

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

  smart_header_match: `You are a data validation expert helping users fix header mapping issues by analyzing sample data.

Issue Context:
- File Type: {fileType}
- Missing Required Header: {missingHeader}
- Unexpected Headers: {unexpectedHeaders}
- Sample Data from Unexpected Headers: {sampleData}

Task: Determine if any unexpected header should be renamed to the missing required header based on the sample data content.

Analysis Guidelines:
1. Look at the sample data values in each unexpected header
2. Consider if the data type and content match what the missing header should contain
3. Check for obvious spelling mistakes or variations
4. Consider common naming patterns (e.g., worker_name vs WorkerName, clientID vs ClientID)

Response format:
💡 **Fix**: [Either the unexpected header name that should be renamed, or "AddNewColumn" if none match]
📊 **Reasoning**: [Explain why this header matches or why a new column is needed]
🔍 **Data Analysis**: [Brief analysis of the sample data that led to this decision]

Examples:
- If "WorkerNamee" contains names like "John", "Mary" → rename to "WorkerName"
- If "client_id" contains IDs like "C001", "C002" → rename to "ClientID"  
- If no unexpected header has matching data → suggest "AddNewColumn"

Important: Only suggest renaming if you're confident the data content matches the expected field type.

Solution:`
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
    const { issue, currentHeaders, sampleData } = body;

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
    const promptTemplate = PROMPT_TEMPLATES[templateKey] || PROMPT_TEMPLATES.data;

    // Helper function to sanitize values for LangChain
    const sanitizeValue = (value: unknown): string => {
      if (value === null || value === undefined) return 'Not provided';
      if (typeof value === 'string') {
        // Remove any special characters that might cause issues
        return value.replace(/[{}]/g, '').trim() || 'Not provided';
      }
      return String(value).replace(/[{}]/g, '').trim() || 'Not provided';
    };

    // Create a comprehensive variable set with all possible variables that any template might need
    const promptVariables: Record<string, string> = {
      // Base variables (used in all templates)
      fileType: sanitizeValue(`${issue.sheet} (${fileContext?.description || 'data file'})`),
      issueMessage: sanitizeValue(issue.message),
      
      // Header-specific variables (for header template)
      currentHeaders: sanitizeValue(currentHeaders ? currentHeaders.join(', ') : 'Not provided'),
      requiredHeaders: sanitizeValue(fileContext?.requiredHeaders?.join(', ') || 'Not specified'),
      
      // Data/row-specific variables (for data, missing, format templates)
      column: sanitizeValue(issue.column || 'Unknown'),
      row: sanitizeValue(issue.row !== undefined ? (issue.row + 1).toString() : 'Unknown'),
      currentValue: sanitizeValue(sampleData?.currentValue || 'Empty'),
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
    case 'header':
      if (issue.message.includes('Missing required header')) {
        const headerName = issue.message.split(': ')[1];
        return `💡 **Add Missing Header**: Add a column named "${headerName}" to your ${issue.sheet} file.\n\n📋 **Steps**:\n1. Open your file in Excel/Google Sheets\n2. Add "${headerName}" as a new column header\n3. Fill the column with appropriate data\n4. Save and re-upload the file`;
      } else if (issue.message.includes('Unexpected header')) {
        const headerName = issue.message.split(': ')[1];
        return `💡 **Remove Unexpected Header**: The column "${headerName}" should not be in the ${issue.sheet} file.\n\n📋 **Options**:\n1. Delete this column if not needed\n2. Move this data to the correct file type\n3. Rename if it matches a required header`;
      }
      break;

    case 'data':
      return `💡 **Fix Data Value**: Update the value in ${issue.column} to match the required format.\n\n📊 **Common fixes**:\n• PriorityLevel: Use numbers 1-5\n• Numeric fields: Use whole numbers\n• JSON fields: Ensure valid JSON format`;

    case 'missing':
      return `💡 **Fill Missing Data**: Add a value for ${issue.column} in row ${(issue.row || 0) + 1}.\n\n🎯 **Suggestions**:\n• Use appropriate default values\n• Reference your business requirements\n• Ensure consistency with other rows`;

    case 'format':
      return `💡 **Fix Format**: Update ${issue.column} to use the correct data format.\n\n📝 **Check**:\n• JSON fields need valid JSON syntax\n• Arrays should be formatted as [1,2,3]\n• Numbers should not contain text`;
  }

  return 'Please review the data format requirements and update accordingly.';
}