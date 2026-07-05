import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import PDFDocument from 'pdfkit';

@Injectable()
export class GenerateStatementUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    workspaceId: string,
    walletId: string,
    startDateStr?: string,
    endDateStr?: string,
  ): Promise<Buffer> {
    const wallet = await this.prisma.wallet.findFirst({
      where: { id: walletId, workspaceId },
      include: { customer: true },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const startDate = startDateStr ? new Date(startDateStr) : new Date(0);
    const endDate = endDateStr ? new Date(endDateStr) : new Date();

    const ledgerEntries = await this.prisma.ledgerEntry.findMany({
      where: {
        walletId,
        workspaceId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      // --- Draw header ---
      doc
        .fillColor('#6366f1')
        .fontSize(24)
        .text('WALLET-PRIMITIVE', 50, 50)
        .fontSize(10)
        .fillColor('#6b7280')
        .text('Fintech Wallet Statement', 50, 80);

      doc
        .strokeColor('#e5e7eb')
        .lineWidth(1)
        .moveTo(50, 95)
        .lineTo(550, 95)
        .stroke();

      // --- Customer and account metadata ---
      doc
        .fillColor('#1f2937')
        .fontSize(12)
        .text('Account Holder:', 50, 115)
        .fontSize(11)
        .fillColor('#4b5563')
        .text(`Name: ${wallet.customer.name}`)
        .text(`Email: ${wallet.customer.email}`);

      doc
        .fillColor('#1f2937')
        .fontSize(12)
        .text('Wallet Information:', 300, 115)
        .fontSize(11)
        .fillColor('#4b5563')
        .text(`Bank Name: ${wallet.bankName}`)
        .text(`Account Number: ${wallet.accountNumber}`)
        .text(`Current Balance: NGN ${wallet.balance.toFixed(2)}`);

      doc
        .strokeColor('#e5e7eb')
        .lineWidth(1)
        .moveTo(50, 185)
        .lineTo(550, 185)
        .stroke();

      // --- Transaction Table Header ---
      doc
        .fillColor('#111827')
        .fontSize(11)
        .text('Date', 50, 205)
        .text('Description', 160, 205)
        .text('Type', 360, 205)
        .text('Amount', 420, 205)
        .text('Balance', 490, 205);

      doc
        .strokeColor('#9ca3af')
        .lineWidth(1)
        .moveTo(50, 220)
        .lineTo(550, 220)
        .stroke();

      // --- Transactions List ---
      let y = 230;
      doc.fillColor('#4b5563').fontSize(9);

      if (ledgerEntries.length === 0) {
        doc.text('No transactions found in the specified date range.', 50, y);
      } else {
        ledgerEntries.forEach((entry) => {
          const descriptionText = entry.description || 'No description';
          const desc =
            descriptionText.length > 30
              ? descriptionText.substring(0, 27) + '...'
              : descriptionText;
          const dateStr = entry.createdAt.toISOString().split('T')[0];
          const typeStr = entry.type;
          const amountStr = `NGN ${entry.amount.toFixed(2)}`;
          const balanceStr = `NGN ${entry.runningBalance.toFixed(2)}`;

          // Check page boundary
          if (y > 700) {
            doc.addPage();
            y = 50; // reset y on new page
            // redraw table headers
            doc
              .fillColor('#111827')
              .fontSize(11)
              .text('Date', 50, y)
              .text('Description', 160, y)
              .text('Type', 360, y)
              .text('Amount', 420, y)
              .text('Balance', 490, y);

            doc
              .strokeColor('#9ca3af')
              .lineWidth(1)
              .moveTo(50, y + 15)
              .lineTo(550, y + 15)
              .stroke();

            y += 25;
            doc.fillColor('#4b5563').fontSize(9);
          }

          doc
            .text(dateStr, 50, y)
            .text(desc, 160, y)
            .text(typeStr, 360, y)
            .text(amountStr, 420, y)
            .text(balanceStr, 490, y);

          y += 20;
        });
      }

      // --- Footer ---
      doc
        .fillColor('#9ca3af')
        .fontSize(8)
        .text(
          `Statement generated on ${new Date().toLocaleDateString()}`,
          50,
          750,
          { align: 'center' },
        );

      doc.end();
    });
  }
}
