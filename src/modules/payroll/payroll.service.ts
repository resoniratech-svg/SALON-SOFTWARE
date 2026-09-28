import { PayrollRepository } from './payroll.repository.js';
import {
  GenerateSalaryInput,
  PayrollConfigInput,
  PayslipResponse,
  SalaryFilterQuery,
  UpdateSalaryInput,
} from './payroll.types.js';

export class PayrollService {
  constructor(private repository: PayrollRepository = new PayrollRepository()) {}

  async getConfig(tenantId: string, staffId?: string | null) {
    return this.repository.getConfig(tenantId, staffId);
  }

  async getAllConfigs(tenantId: string) {
    return this.repository.getAllConfigs(tenantId);
  }

  async upsertConfig(tenantId: string, input: PayrollConfigInput) {
    return this.repository.upsertConfig(tenantId, input);
  }

  async deleteConfig(tenantId: string, id: string) {
    return this.repository.deleteConfig(tenantId, id);
  }

  async generateSalaries(tenantId: string, input: GenerateSalaryInput) {
    return this.repository.generateSalaries(tenantId, input);
  }

  async getSalaries(tenantId: string, filters: SalaryFilterQuery) {
    return this.repository.findSalaries(tenantId, filters);
  }

  async getSalaryById(tenantId: string, id: string) {
    return this.repository.findSalaryById(tenantId, id);
  }

  async updateSalary(tenantId: string, id: string, input: UpdateSalaryInput) {
    return this.repository.updateSalary(tenantId, id, input);
  }

  async deleteSalary(tenantId: string, id: string) {
    return this.repository.deleteSalary(tenantId, id);
  }

  async getPayslip(tenantId: string, staffId: string, month: number, year: number) {
    return this.repository.getPayslip(tenantId, staffId, month, year);
  }

  exportSalariesToCsv(salaries: any[], companyName?: string): string {
    const headers = companyName
      ? ['Company', 'Staff Name', 'Month', 'Year', 'Basic Salary', 'Allowances', 'Gross Salary', 'Deductions', 'Net Salary', 'Status']
      : ['Staff Name', 'Month', 'Year', 'Basic Salary', 'Allowances', 'Gross Salary', 'Deductions', 'Net Salary', 'Status'];
    const rows = salaries.map((s) => {
      const row = [
        s.staff?.name || s.staffName || '',
        s.month,
        s.year,
        s.basicSalary,
        s.allowances,
        s.grossSalary,
        s.deductions,
        s.netSalary,
        s.status,
      ];
      if (companyName) {
        row.unshift(companyName);
      }
      return row;
    });

    const csvLines = [headers.join(',')];
    for (const r of rows) {
      csvLines.push(r.map((v) => `"${v}"`).join(','));
    }
    return csvLines.join('\n');
  }

  generatePayslipHtml(res: PayslipResponse): string {
    if (!res.configured || !res.payslip) {
      return `<!DOCTYPE html><html><body><h2>Payroll config not found</h2><p>${res.message || ''}</p></body></html>`;
    }

    const { staff, period, earnings, deductions, summary, company } = res.payslip;
    const companyDisplayName = company?.name?.trim() ? company.name : 'SALON';

    const earningsRows = earnings
      .map(
        (e) => `<tr><td style="padding:8px;border-bottom:1px solid #eee;">${e.name}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">₹${e.amount.toFixed(2)}</td></tr>`
      )
      .join('');

    const deductionsRows = deductions
      .map(
        (d) => `<tr><td style="padding:8px;border-bottom:1px solid #eee;">${d.name}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">₹${d.amount.toFixed(2)}</td></tr>`
      )
      .join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${companyDisplayName} - Payslip - ${staff.name} - ${period.monthName} ${period.year}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 40px; color: #333; background: #fff; }
    .container { max-width: 800px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
    .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 24px; }
    .header h1 { margin: 0; color: #1e3a8a; font-size: 24px; text-transform: uppercase; letter-spacing: 1px; }
    .header p { margin: 4px 0 0; color: #6b7280; font-size: 14px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; font-size: 14px; }
    .meta-item { display: flex; justify-content: space-between; border-bottom: 1px dashed #e5e7eb; padding: 4px 0; }
    .meta-label { color: #6b7280; font-weight: 500; }
    .meta-value { color: #111827; font-weight: 600; }
    .tables-container { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { background: #f8fafc; padding: 8px; text-align: left; border-bottom: 2px solid #cbd5e1; color: #475569; font-weight: 600; }
    th:last-child { text-align: right; }
    .total-row { font-weight: bold; background: #f1f5f9; }
    .total-row td { padding: 10px 8px; border-top: 2px solid #cbd5e1; }
    .net-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 16px; text-align: right; margin-top: 16px; }
    .net-label { font-size: 14px; color: #1e40af; font-weight: 600; }
    .net-amount { font-size: 24px; color: #1e3a8a; font-weight: bold; }
    .footer { margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 16px; }
    @media print {
      body { margin: 0; }
      .container { border: none; box-shadow: none; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${companyDisplayName.toUpperCase()}</h1>
      ${company?.address ? `<p style="font-size: 13px; color: #64748b; margin-top: 4px; margin-bottom: 2px;">${company.address}</p>` : ''}
      ${company?.contactEmail || company?.contactPhone ? `<p style="font-size: 12px; color: #94a3b8; margin-top: 2px; margin-bottom: 6px;">Contact: ${company.contactEmail || ''} ${company.contactPhone ? `| Phone: ${company.contactPhone}` : ''}</p>` : ''}
      <p style="margin-top: 6px;">SALARY SLIP FOR THE MONTH OF ${period.monthName.toUpperCase()} ${period.year}</p>
    </div>

    <div class="meta-grid">
      <div>
        <div class="meta-item"><span class="meta-label">Staff Name:</span><span class="meta-value">${staff.name}</span></div>
        <div class="meta-item"><span class="meta-label">Designation:</span><span class="meta-value">${staff.designation || 'Salon Specialist'}</span></div>
        <div class="meta-item"><span class="meta-label">Joining Date:</span><span class="meta-value">${staff.joiningDate || 'N/A'}</span></div>
        <div class="meta-item"><span class="meta-label">Mobile:</span><span class="meta-value">${staff.mobile || 'N/A'}</span></div>
      </div>
      <div>
        <div class="meta-item"><span class="meta-label">Working Days:</span><span class="meta-value">${period.workingDays}</span></div>
        <div class="meta-item"><span class="meta-label">Present Days:</span><span class="meta-value">${period.presentDays}</span></div>
        <div class="meta-item"><span class="meta-label">Bank Name:</span><span class="meta-value">${staff.bankName || 'N/A'}</span></div>
        <div class="meta-item"><span class="meta-label">Account No:</span><span class="meta-value">${staff.accountNumber || 'N/A'}</span></div>
      </div>
    </div>

    <div class="tables-container">
      <div>
        <table>
          <thead><tr><th>Earnings</th><th style="text-align:right;">Amount (₹)</th></tr></thead>
          <tbody>
            ${earningsRows}
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td>Total Gross Earnings</td>
              <td style="text-align:right;">₹${summary.totalEarnings.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div>
        <table>
          <thead><tr><th>Deductions</th><th style="text-align:right;">Amount (₹)</th></tr></thead>
          <tbody>
            ${deductionsRows.length > 0 ? deductionsRows : '<tr><td colspan="2" style="padding:8px;color:#9ca3af;text-align:center;">No deductions</td></tr>'}
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td>Total Deductions</td>
              <td style="text-align:right;">₹${summary.totalDeductions.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <div class="net-box">
      <div class="net-label">NET TAKE-HOME PAYABLE SALARY:</div>
      <div class="net-amount">₹${summary.netSalary.toFixed(2)}</div>
      <div style="font-size: 13px; color: #4b5563; margin-top: 4px;">Status: <strong>${summary.status}</strong> | Payment Method: ${summary.paymentMethod || 'BANK_TRANSFER'}</div>
    </div>

    <div class="footer">
      <div>Authorized Signatory: ____________________</div>
      <div>Employee Signature: ____________________</div>
      <div>This is a computer-generated payslip.</div>
    </div>
  </div>
</body>
</html>`;
  }
}

export const payrollService = new PayrollService();

