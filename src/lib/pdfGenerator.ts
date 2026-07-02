import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export interface InvoiceData {
  invoiceNumber: string;
  date: string;
  customerName: string;
  customerPhone: string;
  services: { name: string; quantity: number; price: number; amount: number }[];
  products: { name: string; quantity: number; price: number; amount: number }[];
  subtotal: number;
  tax: number;
  discount: number;
  grandTotal: number;
  paymentMethod?: string;
}

export const generateInvoicePDF = (data: InvoiceData) => {
  const doc = new jsPDF();
  
  // Salon Header
  doc.setFontSize(22);
  doc.setTextColor(200, 157, 60); // Gold color
  doc.text('VJ HAIR SALON', 14, 22);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text('Luxury Hair & Beauty', 14, 28);
  doc.text('tower, F13, Khushil, First floor, 14/15', 14, 34);
  doc.text('Govindnagar, Dahod, Gujarat 389151', 14, 39);
  doc.text('Phone: +91 98765 43210', 14, 44);

  // Invoice Title
  doc.setFontSize(16);
  doc.setTextColor(50, 50, 50);
  doc.text('INVOICE', 140, 22);
  
  doc.setFontSize(10);
  doc.text(`Invoice #: ${data.invoiceNumber}`, 140, 28);
  doc.text(`Date: ${format(new Date(data.date), 'dd MMM yyyy, hh:mm a')}`, 140, 34);

  // Customer Details
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text('Bill To:', 14, 59);
  doc.setFontSize(10);
  doc.text(data.customerName || 'Walk-in Customer', 14, 66);
  if (data.customerPhone) {
    doc.text(`Phone: ${data.customerPhone}`, 14, 72);
  }

  // Table Data
  let startY = 80;
  
  const allItems = [
    ...data.services.map(s => [s.name, s.quantity, `Rs. ${s.price}`, `Rs. ${s.amount}`]),
    ...data.products.map(p => [`${p.name} (Product)`, p.quantity, `Rs. ${p.price}`, `Rs. ${p.amount}`])
  ];

  if (allItems.length > 0) {
    autoTable(doc, {
      startY,
      head: [['Description', 'Qty', 'Rate', 'Amount']],
      body: allItems,
      theme: 'grid',
      headStyles: { fillColor: [20, 20, 20], textColor: [200, 157, 60] },
      styles: { fontSize: 10, cellPadding: 4 },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { halign: 'center', cellWidth: 20 },
        2: { halign: 'right', cellWidth: 30 },
        3: { halign: 'right', cellWidth: 30 },
      }
    });
    
    startY = (doc as any).lastAutoTable.finalY + 10;
  }

  // Totals
  doc.setFontSize(10);
  doc.text('Subtotal:', 130, startY);
  doc.text(`Rs. ${data.subtotal.toFixed(2)}`, 190, startY, { align: 'right' });
  
  if (data.discount > 0) {
    startY += 8;
    doc.text('Discount:', 130, startY);
    doc.text(`- Rs. ${data.discount.toFixed(2)}`, 190, startY, { align: 'right' });
  }

  if (data.tax > 0) {
    startY += 8;
    doc.text('Tax:', 130, startY);
    doc.text(`+ Rs. ${data.tax.toFixed(2)}`, 190, startY, { align: 'right' });
  }

  startY += 10;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Grand Total:', 130, startY);
  doc.setTextColor(200, 157, 60);
  doc.text(`Rs. ${data.grandTotal.toFixed(2)}`, 190, startY, { align: 'right' });

  if (data.paymentMethod) {
    startY += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Payment Method:', 130, startY);
    doc.text(data.paymentMethod, 190, startY, { align: 'right' });
  }

  // Footer
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150, 150, 150);
  doc.text('Thank you for choosing VJ Hair Salon!', 105, 280, { align: 'center' });

  // Save PDF
  doc.save(`VJ_Invoice_${data.invoiceNumber}.pdf`);
};
