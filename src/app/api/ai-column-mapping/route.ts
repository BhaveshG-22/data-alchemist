import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';

const llm = new ChatOpenAI({
  modelName: 'gpt-3.5-turbo',
  temperature: 0.2,
  apiKey: process.env.OPENAI_API_KEY,
});

const REQUIRED_COLUMNS = {
  clients: ['ClientID', 'ClientName', 'PriorityLevel', 'RequestedTaskIDs', 'GroupTag', 'AttributesJSON'],
  workers: ['WorkerID', 'WorkerName', 'Skills', 'AvailableSlots', 'MaxLoadPerPhase', 'WorkerGroup', 'QualificationLevel'],
  tasks: ['TaskID', 'TaskName', 'Category', 'Duration', 'RequiredSkills', 'PreferredPhases', 'MaxConcurrent']
};

interface ColumnMapping {
  originalHeader: string;
  suggestedHeader: string;
  confidence: number;
  reasoning: string;
}

interface MappingResponse {
  mappings: ColumnMapping[];
  unmappedColumns: string[];
  missingColumns: string[];
  confidence: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileType, headers, sampleData } = body;

    if (!fileType || !headers || !Array.isArray(headers)) {
      return NextResponse.json(
        { error: 'fileType, headers array required' },
        { status: 400 }
      );
    }

    const requiredHeaders = REQUIRED_COLUMNS[fileType as keyof typeof REQUIRED_COLUMNS];
    if (!requiredHeaders) {
      return NextResponse.json(
        { error: 'Invalid file type. Must be clients, workers, or tasks' },
        { status: 400 }
      );
    }

    // Format sample data for AI analysis
    const formatSampleData = (data: Record<string, unknown[]>) => {
      if (!data || Object.keys(data).length === 0) return 'No sample data available';
      
      return Object.entries(data).map(([column, values]) => {
        const sampleValues = values.slice(0, 3).map(v => 
          typeof v === 'string' ? `"${v}"` : String(v)
        ).join(', ');
        return `${column}: [${sampleValues}]`;
      }).join('\n');
    };

    const prompt = `You are an expert data analyst specializing in intelligent column mapping for business data files.

Your Task: Analyze uploaded data and intelligently map misnamed or rearranged columns to their correct schema positions.

Input Data:
- File Type: ${fileType}
- Current Headers: ${headers.join(', ')}
- Required Schema: ${requiredHeaders.join(', ')}
- Sample Data (first 3 rows): ${formatSampleData(sampleData || {})}

Mapping Intelligence Guidelines:
1. Content Pattern Analysis:
   - IDs (C001, W123, T-45, client_1) → ClientID, WorkerID, TaskID
   - Names (John Doe, Acme Corp, Data Analysis) → ClientName, WorkerName, TaskName
   - Numbers 1-5 → PriorityLevel
   - Skill lists (js,python | javascript,react) → Skills, RequiredSkills
   - Time values (8,16,24) → Duration, AvailableSlots
   - JSON-like text → AttributesJSON
   - Groups/categories → WorkerGroup, Category, GroupTag
   - Levels/ratings → QualificationLevel

2. Header Similarity Matching:
   - Fuzzy matching: "clientId" → "ClientID", "worker_name" → "WorkerName"
   - Common variations: "Name" → "ClientName" (context-dependent)
   - Abbreviations: "Dur" → "Duration", "Req" → "Required"

3. Column Position Context:
   - First column often contains IDs
   - Second column often contains names
   - Consider logical data flow patterns

Response Format (JSON only):
{
  "mappings": [
    {
      "originalHeader": "client_id",
      "suggestedHeader": "ClientID",
      "confidence": 0.95,
      "reasoning": "Column contains ID patterns (C001, C002) and semantic match with ClientID"
    }
  ],
  "unmappedColumns": ["extra_column"],
  "missingColumns": ["GroupTag"],
  "confidence": 0.87
}

Important Rules:
- Only suggest mappings with confidence ≥ 0.7
- Each original column can only map to one target column
- Each target column can only be mapped once
- Include clear reasoning for each mapping decision
- Overall confidence should reflect the quality of all mappings
- Respond with valid JSON only

Analyze the data and provide intelligent column mappings:`;

    console.log('🤖 Sending column mapping request to AI for:', fileType);
    console.log('📋 Current headers:', headers);
    console.log('🎯 Required headers:', requiredHeaders);

    const response = await llm.invoke(prompt);
    const aiResponse = typeof response.content === 'string' ? response.content : String(response.content);

    // Parse AI response - extract JSON from response
    let mappingResult: MappingResponse;
    try {
      // Look for JSON in the response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const jsonText = jsonMatch[0];
        mappingResult = JSON.parse(jsonText);
      } else {
        throw new Error('No JSON found in AI response');
      }
    } catch {
      console.warn('Failed to parse AI JSON response, using fallback mapping');
      mappingResult = createFallbackMapping(headers, requiredHeaders);
    }

    // Validate and clean up the mapping result
    const validatedResult = validateMappingResult(mappingResult, headers, requiredHeaders);

    console.log('✅ AI mapping result:', {
      mappings: validatedResult.mappings.length,
      confidence: validatedResult.confidence,
      unmapped: validatedResult.unmappedColumns.length,
      missing: validatedResult.missingColumns.length
    });

    return NextResponse.json(validatedResult);

  } catch (error) {
    console.error('AI Column Mapping Error:', error);
    
    // Fallback to rule-based mapping
    try {
      const body = await request.json();
      const { fileType, headers } = body;
      const requiredHeaders = REQUIRED_COLUMNS[fileType as keyof typeof REQUIRED_COLUMNS] || [];
      const fallbackResult = createFallbackMapping(headers || [], requiredHeaders);
      
      return NextResponse.json({
        ...fallbackResult,
        fallback: true,
        error: 'AI unavailable, using rule-based mapping'
      });
    } catch {
      return NextResponse.json(
        { error: 'Column mapping service unavailable' },
        { status: 500 }
      );
    }
  }
}

function createFallbackMapping(currentHeaders: string[], requiredHeaders: string[]): MappingResponse {
  const mappings: ColumnMapping[] = [];
  const unmappedColumns: string[] = [];
  const missingColumns: string[] = [...requiredHeaders];

  // Simple rule-based mapping
  currentHeaders.forEach(header => {
    const normalizedHeader = header.toLowerCase().replace(/[_\s-]/g, '');
    let bestMatch: string | null = null;
    let maxScore = 0;

    requiredHeaders.forEach(required => {
      const normalizedRequired = required.toLowerCase().replace(/[_\s-]/g, '');
      
      // Exact match
      if (normalizedHeader === normalizedRequired) {
        bestMatch = required;
        maxScore = 1.0;
        return;
      }
      
      // Substring match
      if (normalizedHeader.includes(normalizedRequired) || normalizedRequired.includes(normalizedHeader)) {
        const score = 0.8;
        if (score > maxScore) {
          bestMatch = required;
          maxScore = score;
        }
      }
      
      // Common patterns
      const patterns: Array<[RegExp, string]> = [
        [/^(client|customer).*id$/i, 'ClientID'],
        [/^(client|customer).*name$/i, 'ClientName'],
        [/^worker.*id$/i, 'WorkerID'],
        [/^worker.*name$/i, 'WorkerName'],
        [/^task.*id$/i, 'TaskID'],
        [/^task.*name$/i, 'TaskName'],
        [/^priority$/i, 'PriorityLevel'],
        [/^skill/i, 'Skills'],
        [/^duration$/i, 'Duration']
      ];
      
      patterns.forEach(([pattern, target]) => {
        if (pattern.test(header) && target === required) {
          const score = 0.75;
          if (score > maxScore) {
            bestMatch = required;
            maxScore = score;
          }
        }
      });
    });

    if (bestMatch && maxScore >= 0.7) {
      mappings.push({
        originalHeader: header,
        suggestedHeader: bestMatch,
        confidence: maxScore,
        reasoning: `Pattern-based match (${Math.round(maxScore * 100)}% confidence)`
      });
      
      // Remove from missing columns
      const index = missingColumns.indexOf(bestMatch);
      if (index > -1) {
        missingColumns.splice(index, 1);
      }
    } else {
      unmappedColumns.push(header);
    }
  });

  return {
    mappings,
    unmappedColumns,
    missingColumns,
    confidence: mappings.length > 0 ? mappings.reduce((sum, m) => sum + m.confidence, 0) / mappings.length : 0
  };
}

function validateMappingResult(result: MappingResponse, currentHeaders: string[], requiredHeaders: string[]): MappingResponse {
  const validMappings: ColumnMapping[] = [];
  const usedTargets = new Set<string>();
  const usedSources = new Set<string>();

  // Validate each mapping
  result.mappings?.forEach(mapping => {
    if (
      mapping.originalHeader &&
      mapping.suggestedHeader &&
      mapping.confidence >= 0.5 &&
      currentHeaders.includes(mapping.originalHeader) &&
      requiredHeaders.includes(mapping.suggestedHeader) &&
      !usedTargets.has(mapping.suggestedHeader) &&
      !usedSources.has(mapping.originalHeader)
    ) {
      validMappings.push(mapping);
      usedTargets.add(mapping.suggestedHeader);
      usedSources.add(mapping.originalHeader);
    }
  });

  // Calculate unmapped and missing
  const unmappedColumns = currentHeaders.filter(h => !usedSources.has(h));
  const missingColumns = requiredHeaders.filter(h => !usedTargets.has(h));

  return {
    mappings: validMappings,
    unmappedColumns,
    missingColumns,
    confidence: validMappings.length > 0 ? 
      validMappings.reduce((sum, m) => sum + m.confidence, 0) / validMappings.length : 0
  };
}