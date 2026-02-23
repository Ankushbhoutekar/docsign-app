const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

/**
 * Embeds signatures into a PDF and generates a final signed document
 * @param {string} sourcePdfPath - Path to original PDF
 * @param {Array} signatureFields - Array of signature field configs
 * @param {Array} signers - Array of signers with their signature data
 * @returns {Buffer} - Signed PDF buffer
 */
const embedSignatures = async (sourcePdfPath, signatureFields, signers) => {
  const pdfBytes = fs.readFileSync(sourcePdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const field of signatureFields) {
    const signer = signers.find(s => s.email === field.signerEmail && s.status === 'signed');
    if (!signer || !signer.signatureData) continue;

    const pageIndex = (field.page || 1) - 1;
    const page = pages[pageIndex];
    if (!page) continue;

    const { width: pageWidth, height: pageHeight } = page.getSize();

    // Convert coordinates from top-left (frontend) to bottom-left (PDF)
    const pdfX = field.x;
    const pdfY = pageHeight - field.y - field.height;
    const sigWidth = field.width || 200;
    const sigHeight = field.height || 60;

    // Draw signature box border
    page.drawRectangle({
      x: pdfX,
      y: pdfY,
      width: sigWidth,
      height: sigHeight,
      borderColor: rgb(0.1, 0.4, 0.8),
      borderWidth: 1.5,
    });

    // Embed signature image if base64 data exists
    if (signer.signatureData && signer.signatureData.startsWith('data:image')) {
      try {
        const base64Data = signer.signatureData.split(',')[1];
        const imageBytes = Buffer.from(base64Data, 'base64');
        
        let embeddedImage;
        if (signer.signatureData.includes('data:image/png')) {
          embeddedImage = await pdfDoc.embedPng(imageBytes);
        } else {
          embeddedImage = await pdfDoc.embedJpg(imageBytes);
        }
        
        page.drawImage(embeddedImage, {
          x: pdfX + 5,
          y: pdfY + 5,
          width: sigWidth - 10,
          height: sigHeight - 25,
        });
      } catch (e) {
        // Fallback to text if image embedding fails
        page.drawText(signer.name || signer.email, {
          x: pdfX + 10,
          y: pdfY + sigHeight / 2,
          size: 14,
          font,
          color: rgb(0.1, 0.1, 0.6),
        });
      }
    }

    // Draw signer info at bottom of signature box
    const signerLabel = `${signer.name || signer.email} | ${new Date(signer.signedAt).toLocaleDateString()}`;
    page.drawText(signerLabel, {
      x: pdfX + 5,
      y: pdfY + 4,
      size: 7,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
  }

  // Add audit trail page at end
  const auditPage = pdfDoc.addPage();
  const { width: auditWidth, height: auditHeight } = auditPage.getSize();
  
  auditPage.drawText('DOCUMENT AUDIT TRAIL', {
    x: 50,
    y: auditHeight - 60,
    size: 18,
    font,
    color: rgb(0.1, 0.4, 0.8),
  });

  auditPage.drawLine({
    start: { x: 50, y: auditHeight - 70 },
    end: { x: auditWidth - 50, y: auditHeight - 70 },
    thickness: 2,
    color: rgb(0.1, 0.4, 0.8),
  });

  let yPos = auditHeight - 100;
  const lineHeight = 20;

  auditPage.drawText(`Document generated: ${new Date().toISOString()}`, {
    x: 50, y: yPos, size: 10, font, color: rgb(0.3, 0.3, 0.3)
  });
  yPos -= lineHeight;

  for (const signer of signers) {
    if (signer.status === 'signed') {
      auditPage.drawText(`✓ Signed by: ${signer.email}`, {
        x: 50, y: yPos, size: 10, font, color: rgb(0.1, 0.6, 0.2)
      });
      yPos -= lineHeight * 0.8;
      auditPage.drawText(`  Name: ${signer.name || 'N/A'} | Date: ${new Date(signer.signedAt).toISOString()}`, {
        x: 50, y: yPos, size: 9, font, color: rgb(0.4, 0.4, 0.4)
      });
      yPos -= lineHeight * 0.8;
      auditPage.drawText(`  IP: ${signer.ipAddress || 'N/A'}`, {
        x: 50, y: yPos, size: 9, font, color: rgb(0.4, 0.4, 0.4)
      });
      yPos -= lineHeight * 1.2;
    }
  }

  return await pdfDoc.save();
};

/**
 * Save signed PDF to disk
 */
const saveSignedPdf = async (sourcePdfPath, signatureFields, signers, outputDir) => {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const pdfBuffer = await embedSignatures(sourcePdfPath, signatureFields, signers);
  const filename = `signed-${Date.now()}.pdf`;
  const outputPath = path.join(outputDir, filename);
  
  fs.writeFileSync(outputPath, pdfBuffer);
  return { filename, path: outputPath };
};

module.exports = { embedSignatures, saveSignedPdf };
