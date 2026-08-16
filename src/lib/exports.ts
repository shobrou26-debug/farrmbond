import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

// ============================================================
// Types
// ============================================================
interface ExportColumn {
  header: string;
  key: string;
  width?: number;
}

interface ExportOptions {
  title: string;
  filename: string;
  columns: ExportColumn[];
  data: Record<string, unknown>[];
  subtitle?: string;
  includeDate?: boolean;
  includeSummary?: boolean;
  summaryData?: Record<string, unknown>;
}

interface ChartExportData {
  title: string;
  labels: string[];
  datasets: { name: string; data: number[] }[];
}

// ============================================================
// PDF Export Utilities
// ============================================================
export function generatePDF(options: ExportOptions): void {
  const doc = new jsPDF();
  const { title, filename, columns, data, subtitle, includeDate = true, includeSummary = false, summaryData } = options;

  // Header
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, 22);

  if (subtitle) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(subtitle, 14, 30);
  }

  if (includeDate) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    const date = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    doc.text(`Generated: ${date}`, 14, subtitle ? 38 : 30);
  }

  // Summary section
  let startY = subtitle || includeDate ? 45 : 35;
  if (includeSummary && summaryData) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Summary", 14, startY);
    startY += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    Object.entries(summaryData).forEach(([key, value]) => {
      doc.text(`${key}:`, 14, startY);
      doc.setFont("helvetica", "bold");
      doc.text(String(value), 60, startY);
      doc.setFont("helvetica", "normal");
      startY += 6;
    });
    startY += 5;
  }

  // Table
  const tableColumns = columns.map((col) => ({ header: col.header, dataKey: col.key }));
  const tableData = data.map((row) => {
    const rowData: (string | number)[][] = [];
    columns.forEach((col) => {
      rowData.push([String(row[col.key] ?? "")]);
    });
    return rowData.flat();
  });

  autoTable(doc, {
    columns: tableColumns,
    body: tableData,
    startY,
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [34, 197, 94],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [245, 250, 245],
    },
    margin: { top: startY },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `FarmBond - Page ${i} of ${pageCount}`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 10,
      { align: "center" }
    );
  }

  // Save
  doc.save(`${filename}.pdf`);
}

// ============================================================
// Excel Export Utilities
// ============================================================
export function generateExcel(options: ExportOptions): void {
  const { title, filename, columns, data, subtitle, summaryData } = options;

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Create summary sheet if provided
  if (summaryData && Object.keys(summaryData).length > 0) {
    const summaryRows = Object.entries(summaryData).map(([key, value]) => ({
      Metric: key,
      Value: value,
    }));
    const summaryWs = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");
  }

  // Create main data sheet
  const wsData = data.map((row) => {
    const rowData: Record<string, unknown> = {};
    columns.forEach((col) => {
      rowData[col.header] = row[col.key] ?? "";
    });
    return rowData;
  });

  const ws = XLSX.utils.json_to_sheet(wsData);

  // Set column widths
  const colWidths = columns.map((col) => ({
    wch: col.width || Math.max(col.header.length, 15),
  }));
  ws["!cols"] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31)); // Excel sheet name limit

  // Add metadata sheet
  const metadata = [
    { Field: "Report Title", Value: title },
    { Field: "Subtitle", Value: subtitle || "" },
    { Field: "Generated", Value: new Date().toLocaleString() },
    { Field: "Total Records", Value: data.length },
  ];
  const metadataWs = XLSX.utils.json_to_sheet(metadata);
  XLSX.utils.book_append_sheet(wb, metadataWs, "Info");

  // Write file
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  saveAs(blob, `${filename}.xlsx`);
}

// ============================================================
// Chart Export Utilities
// ============================================================
export function generateChartPDF(chartData: ChartExportData): void {
  const doc = new jsPDF();
  const { title, labels, datasets } = chartData;

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, 20);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 28);

  // Create table from chart data
  const columns = [{ header: "Category", dataKey: "category" }];
  datasets.forEach((ds) => {
    columns.push({ header: ds.name, dataKey: ds.name });
  });

  const tableData = labels.map((label, idx) => {
    const row: (string | number)[] = [label];
    datasets.forEach((ds) => {
      row.push(ds.data[idx] ?? 0);
    });
    return row;
  });

  autoTable(doc, {
    columns,
    body: tableData,
    startY: 35,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [34, 197, 94], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 250, 245] },
  });

  doc.save(`${title.replace(/\s+/g, "_").toLowerCase()}.pdf`);
}

export function generateChartExcel(chartData: ChartExportData): void {
  const { title, labels, datasets } = chartData;

  const wb = XLSX.utils.book_new();

  const wsData = labels.map((label, idx) => {
    const row: Record<string, unknown> = { Category: label };
    datasets.forEach((ds) => {
      row[ds.name] = ds.data[idx] ?? 0;
    });
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "Chart Data");

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  saveAs(blob, `${title.replace(/\s+/g, "_").toLowerCase()}.xlsx`);
}

// ============================================================
// Pre-configured Export Generators
// ============================================================

// Farm Report Export
export function exportFarmReport(farms: Record<string, unknown>[], format: "pdf" | "excel"): void {
  const columns: ExportColumn[] = [
    { header: "Farm Name", key: "name", width: 25 },
    { header: "Location", key: "location", width: 20 },
    { header: "Area (ha)", key: "area", width: 12 },
    { header: "Health Score", key: "health", width: 15 },
    { header: "Status", key: "status", width: 12 },
    { header: "Crops", key: "crops", width: 25 },
    { header: "Livestock", key: "livestock", width: 15 },
  ];

  const options: ExportOptions = {
    title: "Farm Report",
    subtitle: "Comprehensive farm overview and status",
    filename: `farm-report-${new Date().toISOString().split("T")[0]}`,
    columns,
    data: farms,
    includeSummary: true,
    summaryData: {
      "Total Farms": farms.length,
      "Total Area": `${farms.reduce((sum, f) => sum + (Number(f.area) || 0), 0).toFixed(1)} ha`,
      "Average Health": `${(farms.reduce((sum, f) => sum + (Number(f.health) || 0), 0) / farms.length).toFixed(1)}%`,
    },
  };

  if (format === "pdf") {
    generatePDF(options);
  } else {
    generateExcel(options);
  }
}

// Transaction History Export
// Rows arrive already converted into the user's configured currency (see
// Finances.tsx); `currencyCode` only labels the amount column and totals.
export function exportTransactionHistory(
  transactions: Record<string, unknown>[],
  format: "pdf" | "excel",
  currencyCode: string = "KES"
): void {
  const columns: ExportColumn[] = [
    { header: "Date", key: "date", width: 15 },
    { header: "Type", key: "type", width: 12 },
    { header: "Category", key: "category", width: 18 },
    { header: "Description", key: "description", width: 30 },
    { header: `Amount (${currencyCode})`, key: "amount", width: 15 },
    { header: "Farm", key: "farm", width: 20 },
    { header: "Payment Method", key: "paymentMethod", width: 18 },
  ];

  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const totalExpenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const options: ExportOptions = {
    title: "Transaction History",
    subtitle: "Complete record of farm income and expenses",
    filename: `transactions-${new Date().toISOString().split("T")[0]}`,
    columns,
    data: transactions,
    includeSummary: true,
    summaryData: {
      "Total Income": `${currencyCode} ${totalIncome.toLocaleString()}`,
      "Total Expenses": `${currencyCode} ${totalExpenses.toLocaleString()}`,
      "Net Profit": `${currencyCode} ${(totalIncome - totalExpenses).toLocaleString()}`,
      "Total Transactions": transactions.length,
    },
  };

  if (format === "pdf") {
    generatePDF(options);
  } else {
    generateExcel(options);
  }
}

// Analytics Export
// Rows arrive already converted into the user's configured currency (the
// backend summary now aggregates per-transaction in display currency, see
// getMonthlyFinancialSummary); `currencyCode` only labels the totals.
export function exportAnalyticsData(
  data: Record<string, unknown>[],
  title: string,
  format: "pdf" | "excel",
  currencyCode: string = "KES"
): void {
  const columns: ExportColumn[] = [
    { header: "Period", key: "period", width: 15 },
    { header: `Revenue (${currencyCode})`, key: "revenue", width: 15 },
    { header: `Expenses (${currencyCode})`, key: "expenses", width: 15 },
    { header: `Profit (${currencyCode})`, key: "profit", width: 15 },
    { header: "Yield (tons)", key: "yield", width: 15 },
    { header: "Active Farms", key: "farms", width: 15 },
  ];

  const options: ExportOptions = {
    title,
    subtitle: `Performance analytics and trends — all amounts in ${currencyCode}`,
    filename: `${title.replace(/\s+/g, "_").toLowerCase()}-${new Date().toISOString().split("T")[0]}`,
    columns,
    data,
    includeSummary: true,
    summaryData: {
      "Total Revenue": `${currencyCode} ${data.reduce((sum, d) => sum + (Number(d.revenue) || 0), 0).toLocaleString()}`,
      "Total Expenses": `${currencyCode} ${data.reduce((sum, d) => sum + (Number(d.expenses) || 0), 0).toLocaleString()}`,
      "Average Profit Margin": `${((data.reduce((sum, d) => sum + (Number(d.profit) || 0), 0) / data.reduce((sum, d) => sum + (Number(d.revenue) || 0), 1)) * 100).toFixed(1)}%`,
    },
  };

  if (format === "pdf") {
    generatePDF(options);
  } else {
    generateExcel(options);
  }
}

// Crop Report Export
export function exportCropReport(crops: Record<string, unknown>[], format: "pdf" | "excel"): void {
  const columns: ExportColumn[] = [
    { header: "Crop Name", key: "name", width: 20 },
    { header: "Farm", key: "farm", width: 20 },
    { header: "Status", key: "status", width: 12 },
    { header: "Health", key: "health", width: 10 },
    { header: "Area (ha)", key: "area", width: 12 },
    { header: "Yield", key: "yield", width: 12 },
    { header: "Planted Date", key: "plantedDate", width: 15 },
    { header: "Harvest Date", key: "harvestDate", width: 15 },
  ];

  const options: ExportOptions = {
    title: "Crop Report",
    subtitle: "Crop management and production overview",
    filename: `crop-report-${new Date().toISOString().split("T")[0]}`,
    columns,
    data: crops,
    includeSummary: true,
    summaryData: {
      "Total Crops": crops.length,
      "Total Area": `${crops.reduce((sum, c) => sum + (Number(c.area) || 0), 0).toFixed(1)} ha`,
      "Average Health": `${(crops.reduce((sum, c) => sum + (Number(c.health) || 0), 0) / crops.length).toFixed(1)}%`,
    },
  };

  if (format === "pdf") {
    generatePDF(options);
  } else {
    generateExcel(options);
  }
}

// Livestock Report Export
export function exportLivestockReport(livestock: Record<string, unknown>[], format: "pdf" | "excel"): void {
  const columns: ExportColumn[] = [
    { header: "Name", key: "name", width: 25 },
    { header: "Type", key: "type", width: 12 },
    { header: "Breed", key: "breed", width: 15 },
    { header: "Quantity", key: "quantity", width: 10 },
    { header: "Farm", key: "farm", width: 20 },
    { header: "Health", key: "health", width: 10 },
    { header: "Status", key: "status", width: 12 },
    { header: "Next Vaccination", key: "nextVaccination", width: 15 },
  ];

  const options: ExportOptions = {
    title: "Livestock Report",
    subtitle: "Livestock management and health overview",
    filename: `livestock-report-${new Date().toISOString().split("T")[0]}`,
    columns,
    data: livestock,
    includeSummary: true,
    summaryData: {
      "Total Animals": livestock.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0),
      "Total Groups": livestock.length,
      "Average Health": `${(livestock.reduce((sum, l) => sum + (Number(l.health) || 0), 0) / livestock.length).toFixed(1)}%`,
    },
  };

  if (format === "pdf") {
    generatePDF(options);
  } else {
    generateExcel(options);
  }
}

// Weather Report Export
export function exportWeatherReport(weatherData: Record<string, unknown>[], format: "pdf" | "excel"): void {
  const columns: ExportColumn[] = [
    { header: "Date", key: "date", width: 15 },
    { header: "Condition", key: "condition", width: 20 },
    { header: "Max Temp (°C)", key: "tempMax", width: 15 },
    { header: "Min Temp (°C)", key: "tempMin", width: 15 },
    { header: "Rainfall (mm)", key: "rainfall", width: 15 },
    { header: "Humidity (%)", key: "humidity", width: 15 },
    { header: "Wind (km/h)", key: "wind", width: 15 },
  ];

  const options: ExportOptions = {
    title: "Weather Report",
    subtitle: "Weather forecast and historical data",
    filename: `weather-report-${new Date().toISOString().split("T")[0]}`,
    columns,
    data: weatherData,
  };

  if (format === "pdf") {
    generatePDF(options);
  } else {
    generateExcel(options);
  }
}
