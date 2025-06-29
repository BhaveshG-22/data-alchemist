import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export interface ParsedData {
  headers: string[];
  rows: Record<string, unknown>[];
}

export const parseFile = (file: File): Promise<ParsedData> => {
  return new Promise((resolve, reject) => {
    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    if (fileExtension === 'csv') {
      // First try with Papa Parse with robust configuration
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        quoteChar: '"',
        escapeChar: '"',
        delimiter: ',',
        newline: '\n',
        dynamicTyping: false,
        skipEmptyLines: 'greedy',
        fastMode: false, // Disable fast mode for better error handling
        transformHeader: (header) => {
          return header ? header.toString().trim() : '';
        },
        transform: (value, field) => {
          // Handle empty values and preserve them as empty strings
          if (value === null || value === undefined) {
            return '';
          }
          // For string values, trim but preserve empty strings
          if (typeof value === 'string') {
            return value.trim();
          }
          return String(value);
        },
        complete: (results) => {
          const headers = results.meta.fields || [];
          const rawRows = results.data as Record<string, unknown>[];
          
          // Handle parsing errors more gracefully
          if (results.errors.length > 0) {
            const fieldMismatchErrors = results.errors.filter(error => 
              error.type === 'FieldMismatch'
            );
            
            if (fieldMismatchErrors.length > 0) {
              console.warn(`CSV parsing warnings: ${fieldMismatchErrors.length} field mismatch issues detected, continuing with best effort parsing...`);
            }
            
            // Only reject on critical errors, not field mismatches
            const criticalErrors = results.errors.filter(error => 
              error.type !== 'FieldMismatch' && error.type !== 'TooManyFields'
            );
            
            if (criticalErrors.length > 0) {
              const errorMsg = criticalErrors[0];
              reject(new Error(`CSV parsing error: ${errorMsg.message}${errorMsg.row !== undefined ? ` at row ${errorMsg.row + 1}` : ''}`));
              return;
            }
          }
          
          // Clean up rows to ensure consistent field count and handle malformed data
          const cleanedRows = rawRows.map((row) => {
            const cleanedRow: Record<string, unknown> = {};
            
            // Get all keys from the row (may be more than headers due to parsing issues)
            const rowKeys = Object.keys(row);
            
            // If we have more keys than headers, it likely means field splitting issues
            if (rowKeys.length > headers.length) {
              // Try to reconstruct by taking only the expected number of fields
              headers.forEach((header, i) => {
                cleanedRow[header] = rowKeys[i] ? row[rowKeys[i]] : '';
              });
              
              // If the last field appears to be JSON, try to reconstruct it
              const lastHeaderIndex = headers.length - 1;
              const lastHeader = headers[lastHeaderIndex];
              
              if (lastHeader && (lastHeader.toLowerCase().includes('json') || lastHeader.toLowerCase().includes('attributes'))) {
                // Reconstruct the JSON field from remaining values
                const jsonParts = rowKeys.slice(lastHeaderIndex).map(key => row[key]).filter(val => val !== '');
                if (jsonParts.length > 1) {
                  cleanedRow[lastHeader] = jsonParts.join(',');
                }
              }
            } else {
              // Normal case: ensure all headers have a corresponding value
              headers.forEach(header => {
                cleanedRow[header] = row[header] !== undefined ? row[header] : '';
              });
            }
            
            return cleanedRow;
          }).filter(row => {
            // Filter out completely empty rows
            return Object.values(row).some(value => value !== '' && value !== null && value !== undefined);
          });
          
          console.log(`Successfully parsed CSV: ${headers.length} headers, ${cleanedRows.length} data rows (${results.errors.length} warnings)`);
          
          resolve({ headers, rows: cleanedRows });
        },
        error: (error) => {
          reject(new Error(`CSV parsing failed: ${error.message}`));
        }
      });
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          if (jsonData.length === 0) {
            reject(new Error('Excel file is empty'));
            return;
          }
          
          const headers = jsonData[0] as string[];
          const rows = jsonData.slice(1).map((row) => {
            const rowArray = row as unknown[];
            const rowObj: Record<string, unknown> = {};
            headers.forEach((header, index) => {
              rowObj[header] = rowArray[index] || '';
            });
            return rowObj;
          });
          
          resolve({ headers, rows });
        } catch (error) {
          reject(new Error('Excel parsing error: ' + (error as Error).message));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      reader.readAsArrayBuffer(file);
    } else {
      reject(new Error('Unsupported file format. Please use CSV or Excel files.'));
    }
  });
};