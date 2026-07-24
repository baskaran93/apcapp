const { jsPDF } = require('jspdf');
const fs = require('fs');

function generateSample() {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const M = 14;
  let y = M;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.text('Clinic / Hospital Name', pageWidth / 2, y, { align: 'center' });
  y += 7;
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Address line 1, City - PIN', pageWidth / 2, y, { align: 'center' });
  y += 5;
  pdf.text('Phone: 0000000000 | Email: contact@clinic.example', pageWidth / 2, y, { align: 'center' });
  y += 8;

  pdf.setDrawColor(200);
  pdf.setLineWidth(0.6);
  pdf.line(M, y, pageWidth - M, y);
  y += 8;

  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Patient', M, y);
  pdf.text('Invoice', pageWidth - M - 40, y);
  y += 6;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  const patientName = 'John Doe';
  pdf.text(`Name: ${patientName}`, M, y);
  pdf.text(`Date: ${new Date().toLocaleDateString()}`, pageWidth - M - 40, y);
  y += 6;
  pdf.text(`Phone: 9876543210`, M, y);
  pdf.text(`Doctor: Dr. Smith`, pageWidth - M - 40, y);
  y += 6;
  pdf.text(`Age/DOB: 30`, M, y);
  pdf.text(`Invoice No: 12345`, pageWidth - M - 40, y);
  y += 10;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  const col1X = M;
  pdf.text('Treatment Description', col1X, y);
  pdf.text('Amount (₹)', pageWidth - M, y, { align: 'right' });
  y += 6;
  pdf.setLineWidth(0.4);
  pdf.line(M, y, pageWidth - M, y);
  y += 6;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  const items = [
    { treatment_name: 'Consultation', cost: 200 },
    { treatment_name: 'X-Ray', cost: 500 },
    { treatment_name: 'Medicine', cost: 150 },
  ];
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    pdf.text(item.treatment_name, col1X, y);
    pdf.text(item.cost.toFixed(2), pageWidth - M, y, { align: 'right' });
    y += 6;
    total += item.cost;
  }

  y += 6;
  pdf.setLineWidth(0.5);
  pdf.line(M, y, pageWidth - M, y);
  y += 6;

  pdf.setFont('helvetica', 'bold');
  pdf.text('Total', col1X, y);
  pdf.text(total.toFixed(2), pageWidth - M, y, { align: 'right' });
  y += 12;

  pdf.setFontSize(9);
  pdf.setTextColor(110);
  pdf.text('This is a computer-generated bill.', pageWidth / 2, pageHeight - M + 6, { align: 'center' });

  const out = pdf.output('arraybuffer');
  fs.writeFileSync('assets/pdffiles/Bill_A4_sample.pdf', Buffer.from(out));
  console.log('Sample PDF written to assets/pdffiles/Bill_A4_sample.pdf');
}

generateSample();
