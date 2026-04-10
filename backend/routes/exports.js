const express = require('express');
const dayjs = require('dayjs');
const ExcelJS = require('exceljs');
const Transaction = require('../models/Transaction');
const { logAudit } = require('../utils/audit');
const { requireAuth, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

function asCsvValue(input) {
  const text = String(input ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

function parseExportQuery(rawQuery) {
  const from = rawQuery.from && dayjs(rawQuery.from).isValid() ? dayjs(rawQuery.from).startOf('day').toDate() : null;
  const to = rawQuery.to && dayjs(rawQuery.to).isValid() ? dayjs(rawQuery.to).endOf('day').toDate() : null;
  const minAmount = rawQuery.minAmount === '' || rawQuery.minAmount == null ? null : Number(rawQuery.minAmount);
  const maxAmount = rawQuery.maxAmount === '' || rawQuery.maxAmount == null ? null : Number(rawQuery.maxAmount);

  const query = {};
  if (from || to) {
    query.date = {};
    if (from) query.date.$gte = from;
    if (to) query.date.$lte = to;
  }

  if (rawQuery.type && ['income', 'outgoing'].includes(rawQuery.type)) {
    query.type = rawQuery.type;
  }

  if (Number.isFinite(minAmount) || Number.isFinite(maxAmount)) {
    query.amount = {};
    if (Number.isFinite(minAmount)) query.amount.$gte = minAmount;
    if (Number.isFinite(maxAmount)) query.amount.$lte = maxAmount;
  }

  return query;
}

async function fetchExportRows(rawQuery) {
  const query = parseExportQuery(rawQuery);

  return Transaction.find(query)
    .populate('ledgerId', 'name type')
    .sort({ date: -1, createdAt: -1 })
    .lean();
}

function buildExportDescription(format, rowCount) {
  return `Exported ${rowCount} transaction rows as ${String(format).toUpperCase()}`;
}

router.get('/transactions.csv', requireAuth, authorizeRoles('admin'), async (req, res) => {
  try {
    const rows = await fetchExportRows(req.query);

    const header = [
      'Date',
      'Type',
      'Ledger',
      'Ledger Type',
      'Amount',
      'Description',
      'Created By',
      'Updated By',
    ];

    const lines = [header.map(asCsvValue).join(',')];

    for (const row of rows) {
      lines.push(
        [
          dayjs(row.date).format('YYYY-MM-DD'),
          row.type,
          row.ledgerId?.name || '',
          row.ledgerId?.type || '',
          row.amount,
          row.description,
          row.createdBy || 'system',
          row.updatedBy || 'system',
        ]
          .map(asCsvValue)
          .join(',')
      );
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="transactions-${dayjs().format('YYYYMMDD-HHmmss')}.csv"`
    );

    logAudit({
      req,
      entityType: 'export',
      entityId: 'transactions',
      action: 'EXPORT_TRANSACTIONS_CSV',
      userId: String(req.user.id || ''),
      userName: req.user.username || req.user.name,
      role: req.user.role,
      status: 'SUCCESS',
      description: buildExportDescription('csv', rows.length),
      metadata: { format: 'csv', filters: req.query, rowCount: rows.length },
    });

    res.send(lines.join('\n'));
  } catch (error) {
    res.status(500).json({ message: 'Failed to export CSV', error: error.message });
  }
});

router.get('/transactions.xlsx', requireAuth, authorizeRoles('admin'), async (req, res) => {
  try {
    const rows = await fetchExportRows(req.query);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'M/S Kamrul Traders';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Transactions', {
      views: [{ state: 'frozen', ySplit: 4 }],
    });

    worksheet.columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Type', key: 'type', width: 14 },
      { header: 'Ledger', key: 'ledger', width: 34 },
      { header: 'Ledger Type', key: 'ledgerType', width: 16 },
      { header: 'Income Amount', key: 'incomeAmount', width: 18 },
      { header: 'Outgoing Amount', key: 'outgoingAmount', width: 18 },
      { header: 'Description', key: 'description', width: 42 },
      { header: 'Created By', key: 'createdBy', width: 18 },
      { header: 'Updated By', key: 'updatedBy', width: 18 },
    ];

    worksheet.mergeCells('A1:I1');
    worksheet.getCell('A1').value = 'M/S Kamrul Traders - Transaction Report';
    worksheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getCell('A1').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' },
    };
    worksheet.getRow(1).height = 28;

    worksheet.mergeCells('A2:I2');
    worksheet.getCell('A2').value = `Generated: ${dayjs().format('YYYY-MM-DD HH:mm:ss')} | Rows: ${rows.length}`;
    worksheet.getCell('A2').font = { size: 11, color: { argb: 'FF334155' } };
    worksheet.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getCell('A2').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' },
    };
    worksheet.getRow(2).height = 22;

    const headerRow = worksheet.getRow(4);
    headerRow.values = [
      'Date',
      'Type',
      'Ledger',
      'Ledger Type',
      'Income Amount (BDT)',
      'Outgoing Amount (BDT)',
      'Description',
      'Created By',
      'Updated By',
    ];
    headerRow.height = 22;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E40AF' },
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF93C5FD' } },
        left: { style: 'thin', color: { argb: 'FF93C5FD' } },
        bottom: { style: 'thin', color: { argb: 'FF93C5FD' } },
        right: { style: 'thin', color: { argb: 'FF93C5FD' } },
      };
    });

    rows.forEach((row) => {
      const amount = Number(row.amount || 0);
      const isIncome = row.type === 'income';
      const excelRow = worksheet.addRow({
        date: dayjs(row.date).format('YYYY-MM-DD'),
        type: String(row.type || '').toUpperCase(),
        ledger: row.ledgerId?.name || '',
        ledgerType: row.ledgerId?.type || '',
        incomeAmount: isIncome ? amount : null,
        outgoingAmount: isIncome ? null : amount,
        description: row.description || '',
        createdBy: row.createdBy || 'system',
        updatedBy: row.updatedBy || 'system',
      });

      excelRow.height = 20;

      excelRow.eachCell((cell) => {
        cell.alignment = { vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      });

      const typeCell = excelRow.getCell(2);
      if (isIncome) {
        typeCell.font = { bold: true, color: { argb: 'FF047857' } };
      } else {
        typeCell.font = { bold: true, color: { argb: 'FFB91C1C' } };
      }

      const incomeCell = excelRow.getCell(5);
      incomeCell.numFmt = '#,##0';
      incomeCell.alignment = { horizontal: 'right', vertical: 'middle' };
      if (isIncome) {
        incomeCell.font = { bold: true, color: { argb: 'FF047857' } };
      }

      const outgoingCell = excelRow.getCell(6);
      outgoingCell.numFmt = '#,##0';
      outgoingCell.alignment = { horizontal: 'right', vertical: 'middle' };
      if (!isIncome) {
        outgoingCell.font = { bold: true, color: { argb: 'FFB91C1C' } };
      }
    });

    const firstDataRow = 5;
    const lastDataRow = worksheet.rowCount;
    for (let rowNumber = firstDataRow; rowNumber <= lastDataRow; rowNumber += 1) {
      if (rowNumber % 2 === 0) {
        worksheet.getRow(rowNumber).eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' },
          };
        });
      }
    }

    logAudit({
      req,
      entityType: 'export',
      entityId: 'transactions',
      action: 'EXPORT_TRANSACTIONS_XLSX',
      userId: String(req.user.id || ''),
      userName: req.user.username || req.user.name,
      role: req.user.role,
      status: 'SUCCESS',
      description: buildExportDescription('xlsx', rows.length),
      metadata: { format: 'xlsx', filters: req.query, rowCount: rows.length },
    });

    const totalIncome = rows.reduce((sum, item) => sum + (item.type === 'income' ? Number(item.amount || 0) : 0), 0);
    const totalOutgoing = rows.reduce((sum, item) => sum + (item.type === 'outgoing' ? Number(item.amount || 0) : 0), 0);
    const balance = totalIncome - totalOutgoing;

    function styleSummaryRow(row, fillColor) {
      row.eachCell((cell, columnNumber) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: fillColor },
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF93C5FD' } },
          left: { style: 'thin', color: { argb: 'FF93C5FD' } },
          bottom: { style: 'thin', color: { argb: 'FF93C5FD' } },
          right: { style: 'thin', color: { argb: 'FF93C5FD' } },
        };
        if (columnNumber === 4) {
          cell.font = { bold: true, color: { argb: 'FF0F172A' } };
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        }
        if (columnNumber === 5 || columnNumber === 6) {
          cell.font = { bold: true, color: { argb: 'FF0F172A' } };
          cell.numFmt = '#,##0';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        }
      });
    }

    const totalRow = worksheet.addRow([null, null, null, 'Total', totalIncome, totalOutgoing, null, null, null]);
    styleSummaryRow(totalRow, 'FFEFF6FF');
    totalRow.getCell(5).font = { bold: true, color: { argb: 'FF047857' } };
    totalRow.getCell(6).font = { bold: true, color: { argb: 'FFB91C1C' } };

    const balanceRow = worksheet.addRow([null, null, null, 'Balance', balance, null, null, null, null]);
    styleSummaryRow(balanceRow, 'FFF8FAFC');
    balanceRow.getCell(4).font = { bold: true, color: { argb: 'FF1E40AF' } };
    worksheet.mergeCells(`E${balanceRow.number}:F${balanceRow.number}`);
    balanceRow.getCell(5).numFmt = '#,##0';
    balanceRow.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
    balanceRow.getCell(5).font = { bold: true, color: { argb: balance >= 0 ? 'FF047857' : 'FFB91C1C' } };

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="transactions-${dayjs().format('YYYYMMDD-HHmmss')}.xlsx"`
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ message: 'Failed to export Excel', error: error.message });
  }
});

module.exports = router;
