import Papa from 'papaparse';
import { saveAs } from 'file-saver';
import { ParsedData } from '@/types/ParsedData';

export interface ExportRule {
  type: string;
  [key: string]: any;
}

export interface ExportData {
  version: string;
  generated: string;
  rules: ExportRule[];
  priorities: Record<string, number>;
}

export function exportCSVFile(data: Record<string, unknown>[], fileName: string): void {
  if (!data || data.length === 0) {
    console.warn(`No data to export for ${fileName}`);
    return;
  }

  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, fileName);
}

export function exportCSVFileWithHeaders(
  data: Record<string, unknown>[], 
  headers: string[], 
  fileName: string
): void {
  if (!data || data.length === 0) {
    console.warn(`No data to export for ${fileName}`);
    return;
  }

  const csv = Papa.unparse({ fields: headers, data });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, fileName);
}

export function exportJSONFile(obj: object, fileName: string): void {
  const jsonString = JSON.stringify(obj, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  saveAs(blob, fileName);
}

export function filterValidRows(data: Record<string, unknown>[]): Record<string, unknown>[] {
  return data.filter(row => {
    if (typeof row === 'object' && row !== null) {
      return row.__valid !== false;
    }
    return true;
  });
}

export function cleanDataForExport(parsedData: ParsedData): Record<string, unknown>[] {
  if (!parsedData || !parsedData.rows) {
    return [];
  }

  return parsedData.rows.map(row => {
    const cleanRow = { ...row };
    delete cleanRow.__valid;
    delete cleanRow.__errors;
    delete cleanRow.__rowIndex;
    return cleanRow;
  });
}

export function exportAllData(
  clientsData: ParsedData | null,
  workersData: ParsedData | null,
  tasksData: ParsedData | null,
  rules: ExportRule[] = [],
  priorities: Record<string, number> = {}
): void {
  try {
    if (clientsData) {
      const cleanClients = cleanDataForExport(clientsData);
      const validClients = filterValidRows(cleanClients);
      exportCSVFile(validClients, 'clients.csv');
    }

    if (workersData) {
      const cleanWorkers = cleanDataForExport(workersData);
      const validWorkers = filterValidRows(cleanWorkers);
      exportCSVFile(validWorkers, 'workers.csv');
    }

    if (tasksData) {
      const cleanTasks = cleanDataForExport(tasksData);
      const validTasks = filterValidRows(cleanTasks);
      exportCSVFile(validTasks, 'tasks.csv');
    }

    const exportData: ExportData = {
      version: '1.0',
      generated: new Date().toISOString(),
      rules,
      priorities
    };

    exportJSONFile(exportData, 'rules.json');

    console.log('Export completed successfully');
  } catch (error) {
    console.error('Export failed:', error);
    throw new Error('Failed to export data. Please try again.');
  }
}

export async function exportAsZip(
  clientsData: ParsedData | null,
  workersData: ParsedData | null,
  tasksData: ParsedData | null,
  rules: ExportRule[] = [],
  priorities: Record<string, number> = {}
): Promise<void> {
  try {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    if (clientsData) {
      const cleanClients = cleanDataForExport(clientsData);
      const validClients = filterValidRows(cleanClients);
      const csv = Papa.unparse(validClients);
      zip.file('clients.csv', csv);
    }

    if (workersData) {
      const cleanWorkers = cleanDataForExport(workersData);
      const validWorkers = filterValidRows(cleanWorkers);
      const csv = Papa.unparse(validWorkers);
      zip.file('workers.csv', csv);
    }

    if (tasksData) {
      const cleanTasks = cleanDataForExport(tasksData);
      const validTasks = filterValidRows(validTasks);
      const csv = Papa.unparse(validTasks);
      zip.file('tasks.csv', csv);
    }

    const exportData: ExportData = {
      version: '1.0',
      generated: new Date().toISOString(),
      rules,
      priorities
    };

    zip.file('rules.json', JSON.stringify(exportData, null, 2));

    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'data-alchemist-export.zip');

    console.log('ZIP export completed successfully');
  } catch (error) {
    console.error('ZIP export failed:', error);
    throw new Error('Failed to export data as ZIP. Please try again.');
  }
}