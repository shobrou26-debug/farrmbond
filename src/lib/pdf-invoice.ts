import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ============================================================
// PDF Invoice Generator
// Generate professional invoices offline using jsPDF
// ============================================================

interface InvoiceData {
  id: string;
  number: string;
  status: string;
  created: number;
  amountPaid: number;
  amountDue: number;
  currency: string;
  periodStart: number;
  periodEnd: number;
  paymentMethodLast4?: string;
  tax?: number;
  items?: InvoiceItem[];
  customer?: CustomerInfo;
}

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface CustomerInfo {
  name?: string;
  email?: string;
  address?: string;
  city?: string;
  country?: string;
}

// ============================================================
// Helper Functions
// ============================================================

function formatCurrency(amountInCents: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountInCents / 100);
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateShort(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ============================================================
// Main PDF Generation Function
// ============================================================

export function generateInvoicePDF(invoice: InvoiceData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // ============================================================
  // Header Section
  // ============================================================

  // Company Logo/Name
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(34, 197, 94); // Green color
  doc.text("FarmBond", margin, y + 8);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("AI-Powered Smart Farming Platform", margin, y + 16);

  // Invoice Title
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(50, 50, 50);
  doc.text("INVOICE", pageWidth - margin, y + 8, { align: "right" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`Invoice #${invoice.number || invoice.id.slice(-8)}`, pageWidth - margin, y + 16, { align: "right" });

  y += 30;

  // ============================================================
  // Status Badge
  // ============================================================

  const statusColors: Record<string, [number, number, number]> = {
    paid: [34, 197, 94],
    open: [245, 158, 11],
    void: [156, 163, 175],
    draft: [59, 130, 246],
  };

  const statusColor = statusColors[invoice.status] || [100, 100, 100];
  doc.setFillColor(...statusColor);
  doc.roundedRect(pageWidth - margin - 30, y - 5, 30, 8, 2, 2, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(invoice.status.toUpperCase(), pageWidth - margin - 15, y + 1, { align: "center" });

  y += 15;

  // ============================================================
  // Divider Line
  // ============================================================

  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // ============================================================
  // Invoice Details & Customer Info (Side by side)
  // ============================================================

  // Left column - Invoice Details
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(80, 80, 80);
  doc.text("INVOICE DETAILS", margin, y);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  doc.text(`Date: ${formatDate(invoice.created)}`, margin, y + 8);
  doc.text(`Invoice ID: ${invoice.id}`, margin, y + 16);
  doc.text(`Status: ${invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}`, margin, y + 24);

  // Right column - Customer Info
  if (invoice.customer) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(80, 80, 80);
    doc.text("BILL TO", pageWidth / 2, y);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    if (invoice.customer.name) {
      doc.text(invoice.customer.name, pageWidth / 2, y + 8);
    }
    if (invoice.customer.email) {
      doc.text(invoice.customer.email, pageWidth / 2, y + 16);
    }
    if (invoice.customer.address) {
      doc.text(invoice.customer.address, pageWidth / 2, y + 24);
    }
  }

  y += 40;

  // ============================================================
  // Service Period
  // ============================================================

  doc.setFillColor(245, 245, 245);
  doc.roundedRect(margin, y, contentWidth, 20, 3, 3, "F");

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(80, 80, 80);
  doc.text("SERVICE PERIOD", margin + 5, y + 8);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  doc.text(
    `${formatDateShort(invoice.periodStart)} — ${formatDateShort(invoice.periodEnd)}`,
    margin + 5,
    y + 15
  );

  y += 30;

  // ============================================================
  // Line Items Table
  // ============================================================

  const items = invoice.items || [
    {
      description: "FarmBond Pro Subscription",
      quantity: 1,
      unitPrice: invoice.amountDue || 500,
      amount: invoice.amountDue || 500,
    },
  ];

  const tableData = items.map((item) => [
    item.description,
    item.quantity.toString(),
    formatCurrency(item.unitPrice, invoice.currency),
    formatCurrency(item.amount, invoice.currency),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Description", "Qty", "Unit Price", "Amount"]],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: [34, 197, 94],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [60, 60, 60],
    },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 20, halign: "center" },
      2: { cellWidth: 35, halign: "right" },
      3: { cellWidth: 35, halign: "right" },
    },
    margin: { left: margin, right: margin },
  });

  // @ts-ignore - autoTable returns the final Y position
  y = doc.lastAutoTable.finalY + 10;

  // ============================================================
  // Totals Section
  // ============================================================

  const totalsX = pageWidth - margin - 70;

  // Subtotal
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text("Subtotal", totalsX, y);
  doc.text(formatCurrency(invoice.amountDue || 0, invoice.currency), pageWidth - margin, y, { align: "right" });
  y += 8;

  // Tax
  if (invoice.tax && invoice.tax > 0) {
    doc.text("Tax", totalsX, y);
    doc.text(formatCurrency(invoice.tax, invoice.currency), pageWidth - margin, y, { align: "right" });
    y += 8;
  }

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.line(totalsX, y, pageWidth - margin, y);
  y += 5;

  // Total
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(34, 197, 94);
  doc.text("TOTAL PAID", totalsX, y);
  doc.text(formatCurrency(invoice.amountPaid || 0, invoice.currency), pageWidth - margin, y, { align: "right" });

  y += 20;

  // ============================================================
  // Payment Information
  // ============================================================

  doc.setFillColor(245, 245, 245);
  doc.roundedRect(margin, y, contentWidth, 25, 3, 3, "F");

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(80, 80, 80);
  doc.text("PAYMENT INFORMATION", margin + 5, y + 8);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  doc.text(
    `Payment Method: •••• ${invoice.paymentMethodLast4 || "4242"}`,
    margin + 5,
    y + 16
  );
  doc.text(
    `Payment Status: ${invoice.status === "paid" ? "Paid" : "Pending"}`,
    margin + 5,
    y + 22
  );

  y += 35;

  // ============================================================
  // Footer
  // ============================================================

  // Divider
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // Thank you message
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(50, 50, 50);
  doc.text("Thank you for your subscription!", pageWidth / 2, y, { align: "center" });
  y += 6;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text(
    "For billing inquiries, contact support@farmbond.com",
    pageWidth / 2,
    y,
    { align: "center" }
  );
  y += 4;

  doc.text(
    "FarmBond — AI-Powered Smart Farming Platform",
    pageWidth / 2,
    y,
    { align: "center" }
  );

  // ============================================================
  // Page Numbers
  // ============================================================

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }

  // ============================================================
  // Save the PDF
  // ============================================================

  const filename = `FarmBond_Invoice_${invoice.number || invoice.id.slice(-8)}.pdf`;
  doc.save(filename);
}

// ============================================================
// Batch Download (Multiple Invoices)
// ============================================================

export function generateAllInvoicesPDF(invoices: InvoiceData[]): void {
  // Generate a combined PDF with all invoices
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = margin;

  // Title Page
  doc.setFontSize(32);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(34, 197, 94);
  doc.text("FarmBond", pageWidth / 2, 60, { align: "center" });

  doc.setFontSize(24);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);
  doc.text("Invoice Summary", pageWidth / 2, 75, { align: "center" });

  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Generated on ${formatDate(Date.now())}`,
    pageWidth / 2,
    90,
    { align: "center" }
  );

  // Summary Table
  const totalPaid = invoices.reduce((sum, inv) => sum + (inv.amountPaid || 0), 0);
  const totalPending = invoices.reduce((sum, inv) => sum + (inv.amountDue || 0), 0);

  doc.setFontSize(14);
  doc.setTextColor(50, 50, 50);
  doc.text("Summary", margin, 110);

  autoTable(doc, {
    startY: 115,
    head: [["Invoice", "Date", "Amount", "Status"]],
    body: invoices.map((inv) => [
      inv.number || inv.id.slice(-8),
      formatDateShort(inv.created),
      formatCurrency(inv.amountPaid || 0, inv.currency),
      inv.status.charAt(0).toUpperCase() + inv.status.slice(1),
    ]),
    theme: "grid",
    headStyles: {
      fillColor: [34, 197, 94],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    margin: { left: margin, right: margin },
  });

  // Save
  doc.save(`FarmBond_Invoices_${formatDateShort(Date.now()).replace(/ /g, "_")}.pdf`);
}

// ============================================================
// Receipt Generation
// ============================================================

export function generateReceiptPDF(invoice: InvoiceData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = margin;

  // Header
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(34, 197, 94);
  doc.text("PAYMENT RECEIPT", pageWidth / 2, y + 10, { align: "center" });

  y += 25;

  // Receipt details
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 50, 3, 3, "F");

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(80, 80, 80);
  doc.text("RECEIPT DETAILS", margin + 5, y + 10);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  doc.text(`Receipt #: ${invoice.number || invoice.id.slice(-8)}`, margin + 5, y + 20);
  doc.text(`Date: ${formatDate(invoice.created)}`, margin + 5, y + 30);
  doc.text(`Amount: ${formatCurrency(invoice.amountPaid || 0, invoice.currency)}`, margin + 5, y + 40);

  y += 65;

  // Payment info
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  doc.text("Payment received for FarmBond Pro Subscription", margin, y);
  y += 8;
  doc.text(`Card ending in ${invoice.paymentMethodLast4 || "4242"}`, margin, y);

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 30;
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("FarmBond — AI-Powered Smart Farming Platform", pageWidth / 2, footerY, { align: "center" });
  doc.text("support@farmbond.com", pageWidth / 2, footerY + 6, { align: "center" });

  // Save
  doc.save(`FarmBond_Receipt_${invoice.number || invoice.id.slice(-8)}.pdf`);
}
