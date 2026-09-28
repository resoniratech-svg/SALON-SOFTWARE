import { prisma } from '../../config/database.js';
import { CreateStaffInput, UpdateStaffInput, StaffListQuery } from './staff.types.js';

export class StaffRepository {
  async findEmployeeNumber(tenantId: string, employeeNumber: string, excludeStaffId?: string) {
    return prisma.staffJoiningDetail.findFirst({
      where: {
        employeeNumber,
        staff: { tenantId },
        ...(excludeStaffId ? { staffId: { not: excludeStaffId } } : {}),
      },
    });
  }

  async findDesignationById(tenantId: string, id: string) {
    return prisma.designation.findFirst({
      where: { id, tenantId },
    });
  }

  async findShiftById(tenantId: string, id: string) {
    return prisma.shift.findFirst({
      where: { id, tenantId },
    });
  }

  async findStaffById(tenantId: string, id: string) {
    return prisma.staff.findFirst({
      where: { id, tenantId },
      include: {
        personalDetails: true,
        documents: true,
        joiningDetails: {
          include: {
            designation: true,
            reportingTo: {
              include: {
                personalDetails: true,
              },
            },
          },
        },
        bankDetails: true,
        appointmentSettings: true,
        weeklySchedules: {
          include: {
            shift: true,
          },
          orderBy: {
            dayOfWeek: 'asc',
          },
        },
      },
    });
  }

  async listStaff(tenantId: string, query: StaffListQuery) {
    const { search, designationId, isActive, enableAppointments, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (designationId) {
      where.joiningDetails = {
        designationId,
      };
    }

    if (enableAppointments !== undefined) {
      where.appointmentSettings = {
        enableAppointments,
      };
    }

    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          personalDetails: {
            mobile: {
              contains: search,
            },
          },
        },
        {
          joiningDetails: {
            employeeNumber: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.staff.count({ where }),
      prisma.staff.findMany({
        where,
        skip,
        take: limit,
        include: {
          personalDetails: true,
          joiningDetails: {
            include: {
              designation: true,
              reportingTo: {
                include: {
                  personalDetails: true,
                },
              },
            },
          },
          appointmentSettings: true,
          bankDetails: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ]);

    return { total, page, limit, items };
  }

  async createStaffTransaction(tenantId: string, input: CreateStaffInput) {
    const fullName = `${input.personalDetails.firstName} ${input.personalDetails.lastName}`.trim();

    return prisma.$transaction(async (tx) => {
      // 1. Create Staff Master Record stamped with tenantId
      const staff = await tx.staff.create({
        data: {
          tenantId,
          name: fullName,
          isActive: true,
        },
      });

      // 2. Personal Details
      await tx.staffPersonalDetail.create({
        data: {
          staffId: staff.id,
          firstName: input.personalDetails.firstName,
          lastName: input.personalDetails.lastName,
          displayName: input.personalDetails.displayName || fullName,
          gender: input.personalDetails.gender || null,
          dob: input.personalDetails.dob ? new Date(input.personalDetails.dob) : null,
          mobile: input.personalDetails.mobile,
          email: input.personalDetails.email || null,
          address: input.personalDetails.address || null,
          emergencyContactName: input.personalDetails.emergencyContactName || null,
          emergencyContactNumber: input.personalDetails.emergencyContactNumber || null,
          avatarUrl: input.personalDetails.avatarUrl || null,
        },
      });

      // 3. Documents
      if (input.documents && input.documents.length > 0) {
        await tx.staffDocument.createMany({
          data: input.documents.map((doc) => ({
            staffId: staff.id,
            documentType: doc.documentType,
            documentNumber: doc.documentNumber || null,
            documentUrl: doc.documentUrl,
          })),
        });
      }

      // 4. Joining Details
      await tx.staffJoiningDetail.create({
        data: {
          staffId: staff.id,
          joiningDate: new Date(input.joiningDetails.joiningDate),
          designationId: input.joiningDetails.designationId,
          employeeNumber: input.joiningDetails.employeeNumber,
          reportingToId: input.joiningDetails.reportingToId || null,
          workingHours: input.joiningDetails.workingHours,
        },
      });

      // 5. Bank Details
      if (input.bankDetails) {
        await tx.staffBankDetail.create({
          data: {
            staffId: staff.id,
            bankName: input.bankDetails.bankName,
            branch: input.bankDetails.branch,
            accountNumber: input.bankDetails.accountNumber,
            ifsc: input.bankDetails.ifsc,
          },
        });
      }

      // 6. Appointment Settings
      if (input.appointmentSettings) {
        await tx.staffAppointmentSetting.create({
          data: {
            staffId: staff.id,
            enableAppointments: input.appointmentSettings.enableAppointments ?? true,
            showAllAppointments: input.appointmentSettings.showAllAppointments ?? false,
          },
        });
      }

      // 7. Weekly Schedules
      if (input.weeklySchedule && input.weeklySchedule.length > 0) {
        await tx.staffWeeklySchedule.createMany({
          data: input.weeklySchedule.map((ws) => ({
            staffId: staff.id,
            dayOfWeek: ws.dayOfWeek,
            shiftId: ws.shiftId || null,
            isWeeklyOff: ws.isWeeklyOff,
          })),
        });
      }

      return staff;
    });
  }

  async updateStaffTransaction(id: string, input: UpdateStaffInput) {
    return prisma.$transaction(async (tx) => {
      // 1. Update Personal Details
      if (input.personalDetails) {
        const pdData: any = {};
        if (input.personalDetails.firstName !== undefined) pdData.firstName = input.personalDetails.firstName;
        if (input.personalDetails.lastName !== undefined) pdData.lastName = input.personalDetails.lastName;
        if (input.personalDetails.displayName !== undefined) pdData.displayName = input.personalDetails.displayName;
        if (input.personalDetails.gender !== undefined) pdData.gender = input.personalDetails.gender;
        if (input.personalDetails.dob !== undefined) pdData.dob = input.personalDetails.dob ? new Date(input.personalDetails.dob) : null;
        if (input.personalDetails.mobile !== undefined) pdData.mobile = input.personalDetails.mobile;
        if (input.personalDetails.email !== undefined) pdData.email = input.personalDetails.email;
        if (input.personalDetails.address !== undefined) pdData.address = input.personalDetails.address;
        if (input.personalDetails.emergencyContactName !== undefined) pdData.emergencyContactName = input.personalDetails.emergencyContactName;
        if (input.personalDetails.emergencyContactNumber !== undefined) pdData.emergencyContactNumber = input.personalDetails.emergencyContactNumber;
        if (input.personalDetails.avatarUrl !== undefined) pdData.avatarUrl = input.personalDetails.avatarUrl;

        await tx.staffPersonalDetail.update({
          where: { staffId: id },
          data: pdData,
        });

        if (input.personalDetails.firstName || input.personalDetails.lastName) {
          const currentPD = await tx.staffPersonalDetail.findUnique({ where: { staffId: id } });
          if (currentPD) {
            await tx.staff.update({
              where: { id },
              data: { name: `${currentPD.firstName} ${currentPD.lastName}`.trim() },
            });
          }
        }
      }

      // 2. Update Documents
      if (input.documents !== undefined) {
        await tx.staffDocument.deleteMany({ where: { staffId: id } });
        if (input.documents.length > 0) {
          await tx.staffDocument.createMany({
            data: input.documents.map((doc) => ({
              staffId: id,
              documentType: doc.documentType,
              documentNumber: doc.documentNumber || null,
              documentUrl: doc.documentUrl,
            })),
          });
        }
      }

      // 3. Update Joining Details
      if (input.joiningDetails) {
        const jdData: any = {};
        if (input.joiningDetails.joiningDate !== undefined) jdData.joiningDate = new Date(input.joiningDetails.joiningDate);
        if (input.joiningDetails.designationId !== undefined) jdData.designationId = input.joiningDetails.designationId;
        if (input.joiningDetails.employeeNumber !== undefined) jdData.employeeNumber = input.joiningDetails.employeeNumber;
        if (input.joiningDetails.reportingToId !== undefined) jdData.reportingToId = input.joiningDetails.reportingToId || null;
        if (input.joiningDetails.workingHours !== undefined) jdData.workingHours = input.joiningDetails.workingHours;

        await tx.staffJoiningDetail.update({
          where: { staffId: id },
          data: jdData,
        });
      }

      // 4. Update Bank Details
      if (input.bankDetails) {
        await tx.staffBankDetail.update({
          where: { staffId: id },
          data: input.bankDetails,
        });
      }

      // 5. Update Appointment Settings
      if (input.appointmentSettings) {
        await tx.staffAppointmentSetting.update({
          where: { staffId: id },
          data: input.appointmentSettings,
        });
      }

      // 6. Update Weekly Schedule
      if (input.weeklySchedule !== undefined) {
        await tx.staffWeeklySchedule.deleteMany({ where: { staffId: id } });
        if (input.weeklySchedule.length > 0) {
          await tx.staffWeeklySchedule.createMany({
            data: input.weeklySchedule.map((ws) => ({
              staffId: id,
              dayOfWeek: ws.dayOfWeek,
              shiftId: ws.shiftId || null,
              isWeeklyOff: ws.isWeeklyOff,
            })),
          });
        }
      }

      return tx.staff.findUnique({ where: { id } });
    });
  }

  async updateStatus(id: string, isActive: boolean) {
    return prisma.staff.update({
      where: { id },
      data: { isActive },
    });
  }

  async listDesignations(tenantId: string) {
    return prisma.designation.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async listShifts(tenantId: string) {
    return prisma.shift.findMany({
      where: { tenantId },
      orderBy: { startTime: 'asc' },
    });
  }
}

export const staffRepository = new StaffRepository();
