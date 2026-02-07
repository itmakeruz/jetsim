import * as ExcelJS from 'exceljs';

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
}

export async function generateExcel(
  data: Record<string, unknown>[],
  columns: ExcelColumn[],
  sheetName = 'Sheet1',
): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width ?? 15,
  }));

  sheet.getRow(1).font = { bold: true };

  for (const row of data) {
    sheet.addRow(row);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ExcelJS.Buffer;
}
