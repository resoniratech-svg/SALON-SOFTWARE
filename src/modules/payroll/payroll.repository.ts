import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import {
  GenerateSalaryInput,
  PayrollConfigInput,
  PayslipResponse,
  SalaryFilterQuery,
  UpdateSalaryInput,
} from './payroll.types.js';
import { BadRequestError, NotFoundError } from '../../utils/app-error.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export class PayrollRepository {
  // ==========================================
  // 1. CONFIGURATION
  // ==========================================

  async getConfig(tenantId: string, staffId?: string | null) {
    if (staffId) {
      const staffConfig = await prisma.payrollConfig.findFirst({
        where: { tenantId, staffId, isActive: true },
      });
      if (staffConfig) return staffConfig;
    }

    // Default tenant-wide config (staffId is null)
    return prisma.payrollConfig.findFirst({
      where: { tenantId, staffId: null, isActive: true },
    });
  }

  async getAllConfigs(tenantId: string) {
    return prisma.payrollConfig.findMany({
      where: { tenantId },
      include: {
        staff: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async upsertConfig(tenantId: string, input: PayrollConfigInput) {
    const staffId = input.staffId || null;

    const existing = await prisma.payrollConfig.findFirst({
      where: { tenantId, staffId },
    });

    if (existing) {
      return prisma.payrollConfig.update({
        where: { id: existing.id },
        data: {
          basicSalary: new Prisma.Decimal(input.basicSalary),
          hra: new Prisma.Decimal(input.hra || 0),
          conveyance: new Prisma.Decimal(input.conveyance || 0),
          medicalAllowance: new Prisma.Decimal(input.medicalAllowance || 0),
          specialAllowance: new Prisma.Decimal(input.specialAllowance || 0),
          pfPercentage: new Prisma.Decimal(input.pfPercentage || 0),
          esiPercentage: new Prisma.Decimal(input.esiPercentage || 0),
          professionalTax: new Prisma.Decimal(input.professionalTax || 0),
          tdsPercentage: new Prisma.Decimal(input.tdsPercentage || 0),
          isActive: input.isActive !== undefined ? input.isActive : true,
        },
      });
    }

    return prisma.payrollConfig.create({
      data: {
        tenantId,
        staffId,
        basicSalary: new Prisma.Decimal(input.basicSalary),
        hra: new Prisma.Decimal(input.hra || 0),
        conveyance: new Prisma.Decimal(input.conveyance || 0),
        medicalAllowance: new Prisma.Decimal(input.medicalAllowance || 0),
        specialAllowance: new Prisma.Decimal(input.specialAllowance || 0),
        pfPercentage: new Prisma.Decimal(input.pfPercentage || 0),
        esiPercentage: new Prisma.Decimal(input.esiPercentage || 0),
        professionalTax: new Prisma.Decimal(input.professionalTax || 0),
        tdsPercentage: new Prisma.Decimal(input.tdsPercentage || 0),
        isActive: input.isActive !== undefined ? input.isActive : true,
      },
    });
  }

  // ==========================================
  // 2. SALARY GENERATION & LISTING
  // ==========================================

  async generateSalaries(tenantId: string, input: GenerateSalaryInput) {
    // 1. Check if any payroll config exists for this tenant
    const globalConfig = await this.getConfig(tenantId);
    if (!globalConfig) {
      // Check if any individual config exists
      const anyConfig = await prisma.payrollConfig.findFirst({
        where: { tenantId, isActive: true },
      });
      if (!anyConfig) {
        throw new BadRequestError('Payroll config not found');
      }
    }

    // 2. Identify staff members to process
    let staffMembers: { id: string; name: string }[] = [];
    if (input.staffId) {
      const staff = await prisma.staff.findFirst({
        where: { id: input.staffId, tenantId, isActive: true },
        select: { id: true, name: true },
      });
      if (!staff) {
        throw new NotFoundError('Staff not found or inactive');
      }
      staffMembers = [staff];
    } else {
      staffMembers = await prisma.staff.findMany({
        where: { tenantId, isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });
    }

    if (staffMembers.length === 0) {
      throw new BadRequestError('No active staff found for salary generation');
    }

    const workingDays = input.workingDays || 30;
    const presentDays = input.presentDays !== undefined ? input.presentDays : workingDays;
    const attendanceFactor = Math.min(1, Math.max(0, presentDays / workingDays));

    const generatedResults: any[] = [];

    await prisma.$transaction(async (tx) => {
      for (const st of staffMembers) {
        // Resolve configuration for this staff
        let config = await tx.payrollConfig.findFirst({
          where: { tenantId, staffId: st.id, isActive: true },
        });
        if (!config) {
          config = globalConfig || (await tx.payrollConfig.findFirst({ where: { tenantId, staffId: null, isActive: true } }));
        }

        if (!config) {
          continue; // Skip staff without config if generating for all
        }

        // Check if salary already exists for this staff, month, year
        const existingSalary = await tx.staffSalary.findFirst({
          where: {
            tenantId,
            staffId: st.id,
            month: input.month,
            year: input.year,
          },
        });

        if (existingSalary && !input.forceRegenerate) {
          // Keep existing, do not duplicate
          generatedResults.push({
            ...existingSalary,
            staffName: st.name,
            alreadyExisted: true,
          });
          continue;
        }

        // Authoritative Server-Side Salary Calculation
        const basic = Number(config.basicSalary) * attendanceFactor;
        const hra = Number(config.hra) * attendanceFactor;
        const conveyance = Number(config.conveyance) * attendanceFactor;
        const medical = Number(config.medicalAllowance) * attendanceFactor;
        const special = Number(config.specialAllowance) * attendanceFactor;

        const totalAllowances = hra + conveyance + medical + special;
        const incentives = input.incentives !== undefined ? Number(input.incentives) : 0;
        const bonuses = input.bonuses !== undefined ? Number(input.bonuses) : 0;

        const grossSalary = basic + totalAllowances + incentives + bonuses;

        const pf = (basic * Number(config.pfPercentage)) / 100;
        const esi = (grossSalary * Number(config.esiPercentage)) / 100;
        const pt = Number(config.professionalTax);
        const tds = (grossSalary * Number(config.tdsPercentage)) / 100;

        const totalDeductions = pf + esi + pt + tds;
        const netSalary = Math.max(0, grossSalary - totalDeductions);

        const dataPayload = {
          basicSalary: new Prisma.Decimal(basic.toFixed(2)),
          allowances: new Prisma.Decimal(totalAllowances.toFixed(2)),
          deductions: new Prisma.Decimal(totalDeductions.toFixed(2)),
          incentives: new Prisma.Decimal(incentives.toFixed(2)),
          bonuses: new Prisma.Decimal(bonuses.toFixed(2)),
          grossSalary: new Prisma.Decimal(grossSalary.toFixed(2)),
          netSalary: new Prisma.Decimal(netSalary.toFixed(2)),
          workingDays,
          presentDays,
          status: 'PENDING',
          paymentMethod: input.paymentMethod || 'BANK_TRANSFER',
          notes: input.notes || null,
        };

        let saved: any;
        if (existingSalary) {
          saved = await tx.staffSalary.update({
            where: { id: existingSalary.id },
            data: dataPayload,
          });
        } else {
          saved = await tx.staffSalary.create({
            data: {
              tenantId,
              staffId: st.id,
              month: input.month,
              year: input.year,
              ...dataPayload,
            },
          });
        }

        generatedResults.push({
          ...saved,
          staffName: st.name,
          alreadyExisted: false,
        });
      }
    });

    return {
      success: true,
      month: input.month,
      year: input.year,
      count: generatedResults.length,
      salaries: generatedResults,
    };
  }

  async findSalaries(tenantId: string, filters: SalaryFilterQuery) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.StaffSalaryWhereInput = {
      tenantId,
    };

    if (filters.staffId) where.staffId = filters.staffId;
    if (filters.month) where.month = filters.month;
    if (filters.year) where.year = filters.year;
    if (filters.status) where.status = filters.status;

    const [total, data] = await Promise.all([
      prisma.staffSalary.count({ where }),
      prisma.staffSalary.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        include: {
          staff: {
            select: {
              id: true,
              name: true,
              personalDetails: { select: { mobile: true, email: true } },
              bankDetails: { select: { bankName: true, accountNumber: true } },
              joiningDetails: { select: { designation: { select: { name: true } }, joiningDate: true } },
            },
          },
        },
      }),
    ]);

    return {
      data: data.map((s) => ({
        ...s,
        basicSalary: Number(s.basicSalary),
        allowances: Number(s.allowances),
        deductions: Number(s.deductions),
        incentives: Number(s.incentives),
        bonuses: Number(s.bonuses),
        grossSalary: Number(s.grossSalary),
        netSalary: Number(s.netSalary),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ==========================================
  // 3. PAYSLIP
  // ==========================================

  async getPayslip(tenantId: string, staffId: string, month: number, year: number): Promise<PayslipResponse> {
    const staff = await prisma.staff.findFirst({
      where: { id: staffId, tenantId },
      include: {
        personalDetails: true,
        bankDetails: true,
        joiningDetails: { include: { designation: true } },
      },
    });

    if (!staff) {
      throw new NotFoundError('Staff not found');
    }

    // 1. Check if Salary record already generated
    const salary = await prisma.staffSalary.findFirst({
      where: { tenantId, staffId, month, year },
    });

    // 2. Resolve Tenant / Company Information
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        code: true,
        address: true,
        contactEmail: true,
        contactPhone: true,
      },
    });

    // 3. Resolve Config
    const config = await this.getConfig(tenantId, staffId);

    // If neither salary record nor configuration exists, return real unconfigured application state
    if (!salary && !config) {
      return {
        configured: false,
        message: 'Payroll config not found',
      };
    }

    const workingDays = salary ? salary.workingDays : 30;
    const presentDays = salary ? salary.presentDays : 30;
    const factor = Math.min(1, Math.max(0, presentDays / workingDays));

    let basic = salary ? Number(salary.basicSalary) : Number(config!.basicSalary) * factor;
    let allowances = salary ? Number(salary.allowances) : (Number(config!.hra) + Number(config!.conveyance) + Number(config!.medicalAllowance) + Number(config!.specialAllowance)) * factor;
    let deductions = salary ? Number(salary.deductions) : 0;
    let netSalary = salary ? Number(salary.netSalary) : basic + allowances - deductions;

    const earningsList = [
      { name: 'Basic Salary', amount: Number(basic.toFixed(2)) },
    ];

    if (config) {
      if (Number(config.hra) > 0) earningsList.push({ name: 'HRA', amount: Number((Number(config.hra) * factor).toFixed(2)) });
      if (Number(config.conveyance) > 0) earningsList.push({ name: 'Conveyance Allowance', amount: Number((Number(config.conveyance) * factor).toFixed(2)) });
      if (Number(config.medicalAllowance) > 0) earningsList.push({ name: 'Medical Allowance', amount: Number((Number(config.medicalAllowance) * factor).toFixed(2)) });
      if (Number(config.specialAllowance) > 0) earningsList.push({ name: 'Special Allowance', amount: Number((Number(config.specialAllowance) * factor).toFixed(2)) });
    }

    if (salary && Number(salary.incentives) > 0) {
      earningsList.push({ name: 'Incentives', amount: Number(salary.incentives) });
    }
    if (salary && Number(salary.bonuses) > 0) {
      earningsList.push({ name: 'Bonus', amount: Number(salary.bonuses) });
    }

    const totalEarnings = earningsList.reduce((s, e) => s + e.amount, 0);

    const deductionsList: { name: string; amount: number }[] = [];
    if (config) {
      const pf = (basic * Number(config.pfPercentage)) / 100;
      const esi = (totalEarnings * Number(config.esiPercentage)) / 100;
      const pt = Number(config.professionalTax);
      const tds = (totalEarnings * Number(config.tdsPercentage)) / 100;
      if (pf > 0) deductionsList.push({ name: 'Provident Fund (PF)', amount: Number(pf.toFixed(2)) });
      if (esi > 0) deductionsList.push({ name: 'Employee State Insurance (ESI)', amount: Number(esi.toFixed(2)) });
      if (pt > 0) deductionsList.push({ name: 'Professional Tax (PT)', amount: Number(pt.toFixed(2)) });
      if (tds > 0) deductionsList.push({ name: 'Tax Deducted at Source (TDS)', amount: Number(tds.toFixed(2)) });
    }

    const totalDeductions = deductionsList.reduce((s, d) => s + d.amount, 0);
    netSalary = Math.max(0, totalEarnings - totalDeductions);

    return {
      configured: true,
      payslip: {
        salaryId: salary?.id || 'PROJECTED',
        company: {
          id: tenant?.id || tenantId,
          name: tenant?.name?.trim() ? tenant.name : (tenant?.code || 'Company Name Not Configured'),
          code: tenant?.code || null,
          address: tenant?.address || null,
          contactEmail: tenant?.contactEmail || null,
          contactPhone: tenant?.contactPhone || null,
        },
        staff: {
          id: staff.id,
          name: staff.name,
          email: staff.personalDetails?.email,
          mobile: staff.personalDetails?.mobile,
          designation: staff.joiningDetails?.designation?.name || null,
          joiningDate: staff.joiningDetails?.joiningDate ? staff.joiningDetails.joiningDate.toISOString().split('T')[0] : null,
          bankName: staff.bankDetails?.bankName || null,
          accountNumber: staff.bankDetails?.accountNumber || null,
        },
        period: {
          month,
          monthName: MONTH_NAMES[month - 1] || `Month ${month}`,
          year,
          workingDays,
          presentDays,
        },
        earnings: earningsList,
        deductions: deductionsList,
        summary: {
          basicSalary: Number(basic.toFixed(2)),
          totalEarnings: Number(totalEarnings.toFixed(2)),
          totalDeductions: Number(totalDeductions.toFixed(2)),
          netSalary: Number(netSalary.toFixed(2)),
          status: salary?.status || 'PROJECTED',
          paymentMethod: salary?.paymentMethod || 'BANK_TRANSFER',
          paidAt: salary?.paidAt ? salary.paidAt.toISOString() : null,
        },
      },
    };
  }

  // ==========================================
  // 4. SALARY MANAGEMENT & LIFECYCLE
  // ==========================================

  async findSalaryById(tenantId: string, id: string) {
    const salary = await prisma.staffSalary.findFirst({
      where: { id, tenantId },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            personalDetails: { select: { mobile: true, email: true } },
            bankDetails: { select: { bankName: true, accountNumber: true } },
            joiningDetails: { select: { designation: { select: { name: true } }, joiningDate: true } },
          },
        },
      },
    });

    if (!salary) {
      throw new NotFoundError('Salary record not found');
    }

    return {
      ...salary,
      basicSalary: Number(salary.basicSalary),
      allowances: Number(salary.allowances),
      deductions: Number(salary.deductions),
      incentives: Number(salary.incentives),
      bonuses: Number(salary.bonuses),
      grossSalary: Number(salary.grossSalary),
      netSalary: Number(salary.netSalary),
    };
  }

  async updateSalary(tenantId: string, id: string, input: UpdateSalaryInput) {
    const existing = await prisma.staffSalary.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Salary record not found');
    }

    const basic = input.basicSalary !== undefined ? input.basicSalary : Number(existing.basicSalary);
    const allowances = input.allowances !== undefined ? input.allowances : Number(existing.allowances);
    const deductions = input.deductions !== undefined ? input.deductions : Number(existing.deductions);
    const incentives = input.incentives !== undefined ? input.incentives : Number(existing.incentives);
    const bonuses = input.bonuses !== undefined ? input.bonuses : Number(existing.bonuses);

    const grossSalary = basic + allowances + incentives + bonuses;
    const netSalary = Math.max(0, grossSalary - deductions);

    const updated = await prisma.staffSalary.update({
      where: { id },
      data: {
        basicSalary: new Prisma.Decimal(basic.toFixed(2)),
        allowances: new Prisma.Decimal(allowances.toFixed(2)),
        deductions: new Prisma.Decimal(deductions.toFixed(2)),
        incentives: new Prisma.Decimal(incentives.toFixed(2)),
        bonuses: new Prisma.Decimal(bonuses.toFixed(2)),
        grossSalary: new Prisma.Decimal(grossSalary.toFixed(2)),
        netSalary: new Prisma.Decimal(netSalary.toFixed(2)),
        ...(input.workingDays !== undefined && { workingDays: input.workingDays }),
        ...(input.presentDays !== undefined && { presentDays: input.presentDays }),
        ...(input.status && { status: input.status }),
        ...(input.paymentMethod && { paymentMethod: input.paymentMethod }),
        ...(input.paidAt !== undefined && { paidAt: input.paidAt ? new Date(input.paidAt) : null }),
        ...(input.status === 'PAID' && !input.paidAt && !existing.paidAt && { paidAt: new Date() }),
        ...(input.notes !== undefined && { notes: input.notes }),
      },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            personalDetails: { select: { mobile: true, email: true } },
            bankDetails: { select: { bankName: true, accountNumber: true } },
            joiningDetails: { select: { designation: { select: { name: true } }, joiningDate: true } },
          },
        },
      },
    });

    return {
      ...updated,
      basicSalary: Number(updated.basicSalary),
      allowances: Number(updated.allowances),
      deductions: Number(updated.deductions),
      incentives: Number(updated.incentives),
      bonuses: Number(updated.bonuses),
      grossSalary: Number(updated.grossSalary),
      netSalary: Number(updated.netSalary),
    };
  }

  async deleteSalary(tenantId: string, id: string) {
    const existing = await prisma.staffSalary.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Salary record not found');
    }

    await prisma.staffSalary.delete({
      where: { id },
    });

    return { success: true, message: 'Salary record deleted successfully', id };
  }

  async deleteConfig(tenantId: string, id: string) {
    const existing = await prisma.payrollConfig.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Payroll config not found');
    }

    await prisma.payrollConfig.delete({
      where: { id },
    });

    return { success: true, message: 'Payroll configuration deleted successfully', id };
  }
}

