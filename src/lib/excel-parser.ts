import ExcelJS from "exceljs";
import path from "path";

export interface ParsedSheet {
  name: string;
  headers: string[];
  rows: (string | number | boolean | null)[][];
  rowCount: number;
  columnCount: number;
}

export interface ParsedWorkbook {
  filename: string;
  sheetCount: number;
  sheets: ParsedSheet[];
}

export async function parseExcelFile(filePath: string): Promise<ParsedWorkbook> {
  const workbook = new ExcelJS.Workbook();
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".csv") {
    await workbook.csv.readFile(filePath);
  } else {
    await workbook.xlsx.readFile(filePath);
  }

  const sheets: ParsedSheet[] = [];

  workbook.eachSheet((worksheet) => {
    const headers: string[] = [];
    const rows: (string | number | boolean | null)[][] = [];

    // First row as headers
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headers[colNumber - 1] = cell.text || `Column ${colNumber}`;
    });

    // Remaining rows as data (limit to 500 rows for preview)
    const maxRows = Math.min(worksheet.rowCount, 501);
    for (let i = 2; i <= maxRows; i++) {
      const row = worksheet.getRow(i);
      const rowData: (string | number | boolean | null)[] = [];
      let hasData = false;

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const value = cell.value;
        if (value !== null && value !== undefined && value !== "") hasData = true;

        if (value === null || value === undefined) {
          rowData[colNumber - 1] = null;
        } else if (typeof value === "object" && "result" in value) {
          // Formula cell - use the result
          rowData[colNumber - 1] = value.result as string | number | boolean | null;
        } else if (typeof value === "object" && "richText" in value) {
          rowData[colNumber - 1] = (value as ExcelJS.CellRichTextValue).richText
            .map((rt) => rt.text)
            .join("");
        } else if (value instanceof Date) {
          rowData[colNumber - 1] = value.toISOString().split("T")[0];
        } else {
          rowData[colNumber - 1] = value as string | number | boolean;
        }
      });

      if (hasData) rows.push(rowData);
    }

    sheets.push({
      name: worksheet.name,
      headers,
      rows,
      rowCount: worksheet.rowCount,
      columnCount: worksheet.columnCount,
    });
  });

  return {
    filename: path.basename(filePath),
    sheetCount: sheets.length,
    sheets,
  };
}
