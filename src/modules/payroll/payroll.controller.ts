import { Request, Response, NextFunction } from 'express';
import { payrollService, PayrollService } from './payroll.service.js';
import {
  generateSalarySchema,
  payrollConfigSchema,
  payslipQuerySchema,
  salaryQuerySchema,
  updateSalarySchema,
  updateSalaryStatusSchema,
} from './payroll.dto.js';
import { BadRequestError } from '../../utils/app-error.js';
import { prisma } from '../../config/database.js';

export class PayrollController {
  constructor(private service: PayrollService = payrollService) {}

  private getTenantId(req: Request): string {
    const tenantId = (
      req.effectiveTenantId ||
      req.tenantId ||
      req.user?.tenantId ||
      (req.user?.isSuperAdmin
        ? (req.headers['x-tenant-id'] || req.headers['x-impersonate-tenant-id'])
        : undefined)
    ) as string;

    if (!tenantId) {
      throw new BadRequestError('Tenant context is required');
    }
    return tenantId;
  }

  getConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const staffId = req.query.staffId ? String(req.query.staffId) : null;
      const config = await this.service.getConfig(tenantId, staffId);

      if (!config) {
        res.status(200).json({
          success: false,
          configured: false,
          message: 'Payroll config not found',
          data: null,
        });
        return;
      }

      res.status(200).json({
        success: true,
        configured: true,
        message: 'Payroll config retrieved successfully',
        data: config,
      });
    } catch (error) {
      next(error);
    }
  };

  getAllConfigs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const configs = await this.service.getAllConfigs(tenantId);
      res.status(200).json({
        success: true,
        message: 'All payroll configs retrieved successfully',
        data: configs,
      });
    } catch (error) {
      next(error);
    }
  };

  saveConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const input = payrollConfigSchema.parse(req.body);
      const saved = await this.service.upsertConfig(tenantId, input);
      res.status(200).json({
        success: true,
        message: 'Payroll configuration saved successfully',
        data: saved,
      });
    } catch (error) {
      next(error);
    }
  };

  generateSalaries = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const input = generateSalarySchema.parse(req.body);
      const result = await this.service.generateSalaries(tenantId, input);
      res.status(200).json({
        success: true,
        message: `Successfully generated ${result.count} staff salary records`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getSalaries = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const query = salaryQuerySchema.parse(req.query);
      const result = await this.service.getSalaries(tenantId, query);

      if (req.query.export === 'csv') {
        const tenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { name: true },
        });
        const companyName = tenant?.name?.trim() ? tenant.name : (req.user?.company?.name || undefined);
        const csv = this.service.exportSalariesToCsv(result.data, companyName);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="salary-${query.month || 'all'}-${query.year || 'all'}.csv"`);
        res.status(200).send(csv);
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Staff salaries retrieved successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getPayslip = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const query = payslipQuerySchema.parse(req.query);
      const result = await this.service.getPayslip(tenantId, query.staffId, query.month, query.year);

      if (!result.configured) {
        res.status(200).json({
          success: false,
          configured: false,
          message: result.message || 'Payroll config not found',
          data: null,
        });
        return;
      }

      res.status(200).json({
        success: true,
        configured: true,
        message: 'Payslip generated successfully',
        data: result.payslip,
      });
    } catch (error) {
      next(error);
    }
  };

  printPayslip = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const query = payslipQuerySchema.parse(req.query);
      const result = await this.service.getPayslip(tenantId, query.staffId, query.month, query.year);
      const html = this.service.generatePayslipHtml(result);

      res.setHeader('Content-Type', 'text/html');
      res.status(200).send(html);
    } catch (error) {
      next(error);
    }
  };

  getSalaryById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const salary = await this.service.getSalaryById(tenantId, id);

      res.status(200).json({
        success: true,
        message: 'Salary record retrieved successfully',
        data: salary,
      });
    } catch (error) {
      next(error);
    }
  };

  updateSalary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const input = updateSalarySchema.parse(req.body);
      const updated = await this.service.updateSalary(tenantId, id, input);

      res.status(200).json({
        success: true,
        message: 'Salary record updated successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  };

  updateSalaryStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const input = updateSalaryStatusSchema.parse(req.body);
      const updated = await this.service.updateSalary(tenantId, id, input);

      res.status(200).json({
        success: true,
        message: `Salary status updated to ${input.status}`,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  };

  paySalary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const paymentMethod = req.body?.paymentMethod || 'BANK_TRANSFER';
      const paidAt = req.body?.paidAt ? new Date(req.body.paidAt).toISOString() : new Date().toISOString();
      const notes = req.body?.notes;
      const updated = await this.service.updateSalary(tenantId, id, {
        status: 'PAID',
        paymentMethod,
        paidAt,
        ...(notes ? { notes } : {}),
      });

      res.status(200).json({
        success: true,
        message: 'Salary marked as PAID successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteSalary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const result = await this.service.deleteSalary(tenantId, id);

      res.status(200).json({
        success: true,
        message: result.message,
        data: { id: result.id },
      });
    } catch (error) {
      next(error);
    }
  };

  deleteConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const result = await this.service.deleteConfig(tenantId, id);

      res.status(200).json({
        success: true,
        message: result.message,
        data: { id: result.id },
      });
    } catch (error) {
      next(error);
    }
  };
}

export const payrollController = new PayrollController();

