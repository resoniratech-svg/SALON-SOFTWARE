import { StaffRepository, staffRepository } from './staff.repository.js';
import { CreateStaffInput, UpdateStaffInput, StaffListQuery } from './staff.types.js';
import { BadRequestError, NotFoundError, AppError } from '../../utils/app-error.js';

export class StaffService {
  constructor(private repo: StaffRepository = staffRepository) {}

  async createStaff(tenantId: string, input: CreateStaffInput) {
    // 1. Resolve Designation (either by UUID or findOrCreate by name)
    let designationId = input.joiningDetails.designationId;
    if (designationId) {
      const isUuid = /^[0-9a-fA-F-]{36}$/.test(designationId);
      if (isUuid) {
        const designation = await this.repo.findDesignationById(tenantId, designationId);
        if (!designation) {
          // Fallback: auto-create if name was passed in designationId field
          const autoDesig = await this.repo.findOrCreateDesignation(tenantId, designationId);
          designationId = autoDesig.id;
        }
      } else {
        const autoDesig = await this.repo.findOrCreateDesignation(tenantId, designationId);
        designationId = autoDesig.id;
      }
    } else {
      const defaultDesig = await this.repo.findOrCreateDesignation(tenantId, 'Stylist');
      designationId = defaultDesig.id;
    }
    input.joiningDetails.designationId = designationId;

    // 2. Ensure Employee Number is unique
    let empNumber = input.joiningDetails.employeeNumber?.trim();
    if (!empNumber) {
      empNumber = `EMP-${Date.now().toString().slice(-4)}`;
      input.joiningDetails.employeeNumber = empNumber;
    }
    const existingEmployee = await this.repo.findEmployeeNumber(tenantId, empNumber);
    if (existingEmployee) {
      input.joiningDetails.employeeNumber = `${empNumber}-${Date.now().toString().slice(-3)}`;
    }

    // 3. Verify Reporting To staff exists if provided
    if (input.joiningDetails.reportingToId) {
      const isUuid = /^[0-9a-fA-F-]{36}$/.test(input.joiningDetails.reportingToId);
      if (isUuid) {
        const reportingStaff = await this.repo.findStaffById(tenantId, input.joiningDetails.reportingToId);
        if (!reportingStaff) {
          input.joiningDetails.reportingToId = null;
        }
      } else {
        const reportingStaff = await this.repo.findStaffByName(tenantId, input.joiningDetails.reportingToId);
        input.joiningDetails.reportingToId = reportingStaff ? reportingStaff.id : null;
      }
    }

    // 4. Verify Shifts in Weekly Schedule
    if (input.weeklySchedule && input.weeklySchedule.length > 0) {
      for (const item of input.weeklySchedule) {
        if (!item.isWeeklyOff && item.shiftId) {
          const shift = await this.repo.findShiftById(tenantId, item.shiftId);
          if (!shift) {
            item.shiftId = null;
          }
        }
      }
    }

    // 5. Execute creation within transaction
    const createdStaff = await this.repo.createStaffTransaction(tenantId, input);
    return this.getStaffById(tenantId, createdStaff.id);
  }

  async getStaffList(tenantId: string, query: StaffListQuery) {
    const result = await this.repo.listStaff(tenantId, query);

    // Sanitize list view: mask sensitive bank account number
    const sanitizedItems = result.items.map((staff) => {
      const item: any = { ...staff };
      if (item.bankDetails?.accountNumber) {
        const raw = item.bankDetails.accountNumber;
        item.bankDetails = {
          ...item.bankDetails,
          accountNumber: raw.length > 4 ? `****${raw.slice(-4)}` : '****',
        };
      }
      return item;
    });

    return {
      ...result,
      items: sanitizedItems,
    };
  }

  async exportStaffCsv(tenantId: string, query: StaffListQuery): Promise<string> {
    const result = await this.repo.listStaff(tenantId, {
      ...query,
      page: 1,
      limit: 10000,
    });

    const headers = [
      'Name',
      'Employee Number',
      'Designation',
      'Mobile',
      'Email',
      'Gender',
      'Status',
      'Appointments Enabled',
      'Joining Date',
      'Created At',
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = result.items.map((staff: any) => [
      escapeCsv(staff.name || ''),
      escapeCsv(staff.joiningDetails?.employeeNumber || ''),
      escapeCsv(staff.joiningDetails?.designation?.name || ''),
      escapeCsv(staff.personalDetails?.mobile || ''),
      escapeCsv(staff.personalDetails?.email || ''),
      escapeCsv(staff.personalDetails?.gender || ''),
      escapeCsv(staff.isActive ? 'Active' : 'Inactive'),
      escapeCsv(staff.appointmentSettings?.enableAppointments ? 'Yes' : 'No'),
      escapeCsv(staff.joiningDetails?.joiningDate ? new Date(staff.joiningDetails.joiningDate).toISOString().slice(0, 10) : ''),
      escapeCsv(staff.createdAt ? new Date(staff.createdAt).toISOString() : ''),
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
  }

  async getStaffById(tenantId: string, id: string) {
    const staff = await this.repo.findStaffById(tenantId, id);
    if (!staff) {
      throw new NotFoundError(`Staff member not found with ID '${id}'`);
    }
    return staff;
  }

  async updateStaff(tenantId: string, id: string, input: UpdateStaffInput) {
    const existing = await this.repo.findStaffById(tenantId, id);
    if (!existing) {
      throw new NotFoundError(`Staff member not found with ID '${id}'`);
    }

    // 1. Employee number uniqueness check if changing
    if (input.joiningDetails?.employeeNumber) {
      const conflict = await this.repo.findEmployeeNumber(tenantId, input.joiningDetails.employeeNumber, id);
      if (conflict) {
        throw new AppError(`Employee number '${input.joiningDetails.employeeNumber}' is already registered to another staff`, 409);
      }
    }

    // 2. Designation check if provided
    if (input.joiningDetails?.designationId) {
      const isUuid = /^[0-9a-fA-F-]{36}$/.test(input.joiningDetails.designationId);
      if (!isUuid) {
        const desig = await this.repo.findOrCreateDesignation(tenantId, input.joiningDetails.designationId);
        input.joiningDetails.designationId = desig.id;
      } else {
        const designation = await this.repo.findDesignationById(tenantId, input.joiningDetails.designationId);
        if (!designation) {
          throw new BadRequestError(`Designation not found with ID '${input.joiningDetails.designationId}'`);
        }
      }
    }

    // 3. Self-reporting check
    if (input.joiningDetails?.reportingToId) {
      if (input.joiningDetails.reportingToId === id) {
        throw new BadRequestError('Staff member cannot report to themselves');
      }
      const isUuid = /^[0-9a-fA-F-]{36}$/.test(input.joiningDetails.reportingToId);
      if (isUuid) {
        const reportingStaff = await this.repo.findStaffById(tenantId, input.joiningDetails.reportingToId);
        if (!reportingStaff) {
          input.joiningDetails.reportingToId = null;
        }
      } else {
        const manager = await this.repo.findStaffByName(tenantId, input.joiningDetails.reportingToId);
        input.joiningDetails.reportingToId = manager ? manager.id : null;
      }
    }

    // 4. Shift check if weekly schedule updated
    if (input.weeklySchedule && input.weeklySchedule.length > 0) {
      for (const item of input.weeklySchedule) {
        if (!item.isWeeklyOff && item.shiftId) {
          const shift = await this.repo.findShiftById(tenantId, item.shiftId);
          if (!shift) {
            throw new BadRequestError(`Shift not found with ID '${item.shiftId}' for day ${item.dayOfWeek}`);
          }
        }
      }
    }

    await this.repo.updateStaffTransaction(id, input);
    return this.getStaffById(tenantId, id);
  }

  async updateStatus(tenantId: string, id: string, isActive: boolean) {
    const existing = await this.repo.findStaffById(tenantId, id);
    if (!existing) {
      throw new NotFoundError(`Staff member not found with ID '${id}'`);
    }

    await this.repo.updateStatus(id, isActive);
    return {
      id,
      name: existing.name,
      isActive,
      message: `Staff member marked as ${isActive ? 'active' : 'inactive'}`,
    };
  }

  async deleteStaff(tenantId: string, id: string) {
    const existing = await this.repo.findStaffById(tenantId, id);
    if (!existing) {
      throw new NotFoundError(`Staff member not found with ID '${id}'`);
    }
    await this.repo.deleteStaff(id);
    return {
      id,
      name: existing.name,
      message: 'Staff member deleted successfully',
    };
  }

  async getDesignations(tenantId: string) {
    return this.repo.listDesignations(tenantId);
  }

  async getShifts(tenantId: string) {
    return this.repo.listShifts(tenantId);
  }
}

export const staffService = new StaffService();
