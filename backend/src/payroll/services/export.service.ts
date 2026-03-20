import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

interface PayrollRow {
  employeeId: string;
  employeeName: string;
  email: string;
  regularHours: number;
  otHours: number;
  totalHours: number;
  projects: string;
}

export async function generatePdf(
  rows: PayrollRow[],
  startDate: Date,
  endDate: Date,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(18).text('Payroll Report', { align: 'center' });
    doc
      .fontSize(10)
      .text(`${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`, {
        align: 'center',
      });
    doc.moveDown(2);

    // Table header
    const tableTop = doc.y;
    const col = { name: 50, regular: 200, ot: 280, total: 350, projects: 420 };

    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('Employee', col.name, tableTop);
    doc.text('Regular', col.regular, tableTop);
    doc.text('OT', col.ot, tableTop);
    doc.text('Total', col.total, tableTop);
    doc.text('Projects', col.projects, tableTop);

    doc
      .moveTo(50, tableTop + 15)
      .lineTo(550, tableTop + 15)
      .stroke();

    // Rows
    doc.font('Helvetica').fontSize(9);
    let y = tableTop + 25;

    for (const row of rows) {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }
      doc.text(row.employeeName, col.name, y, { width: 140 });
      doc.text(String(row.regularHours), col.regular, y);
      doc.text(String(row.otHours), col.ot, y);
      doc.text(String(row.totalHours), col.total, y);
      doc.text(row.projects || '-', col.projects, y, { width: 130 });
      y += 20;
    }

    // Summary
    doc.moveDown(2);
    const totalRegular = rows.reduce((s, r) => s + r.regularHours, 0);
    const totalOT = rows.reduce((s, r) => s + r.otHours, 0);
    const totalAll = rows.reduce((s, r) => s + r.totalHours, 0);
    doc
      .font('Helvetica-Bold')
      .text(
        `Totals: ${totalRegular}h regular, ${totalOT}h OT, ${totalAll}h total | ${rows.length} employees`,
      );

    doc.end();
  });
}

export async function generateExcel(
  rows: PayrollRow[],
  startDate: Date,
  endDate: Date,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'TimeKeeper';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Payroll Report');

  // Header row
  sheet.columns = [
    { header: 'Employee ID', key: 'employeeId', width: 36 },
    { header: 'Employee Name', key: 'employeeName', width: 25 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Regular Hours', key: 'regularHours', width: 14 },
    { header: 'OT Hours', key: 'otHours', width: 10 },
    { header: 'Total Hours', key: 'totalHours', width: 12 },
    { header: 'Projects', key: 'projects', width: 30 },
  ];

  // Style header
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  };

  // Add rows
  for (const row of rows) {
    sheet.addRow(row);
  }

  // Summary row
  const summaryRow = sheet.addRow({
    employeeName: 'TOTALS',
    regularHours: rows.reduce((s, r) => s + r.regularHours, 0),
    otHours: rows.reduce((s, r) => s + r.otHours, 0),
    totalHours: rows.reduce((s, r) => s + r.totalHours, 0),
  });
  summaryRow.font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
