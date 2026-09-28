import { appointmentRepository, AppointmentRepository } from './appointment.repository.js';
import {
  CreateAppointmentDto,
  ListAppointmentsQueryDto,
  RescheduleAppointmentDto,
  UpdateAppointmentDto,
} from './appointment.dto.js';
import { prisma } from '../../config/database.js';

export class AppointmentService {
  private repository: AppointmentRepository;

  constructor() {
    this.repository = appointmentRepository;
  }

  private toMinutes(timeStr: string): number {
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  /**
   * Helper: check if two time windows [s1, e1) and [s2, e2) overlap
   */
  private timesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
    return this.toMinutes(s1) < this.toMinutes(e2) && this.toMinutes(s2) < this.toMinutes(e1);
  }

  /**
   * Check for staff and resource scheduling conflicts
   */
  async checkConflicts(
    tenantId: string,
    appointmentDate: string,
    items: Array<{
      staffId?: string | null;
      resourceId?: string | null;
      startTime: string;
      endTime?: string;
      durationMinutes?: number;
    }>,
    excludeAppointmentId?: string
  ) {
    const conflicts: string[] = [];
    const dateObj = new Date(appointmentDate);

    // Fetch existing appointments on that date
    const existing = await prisma.appointment.findMany({
      where: {
        tenantId,
        appointmentDate: dateObj,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        id: excludeAppointmentId ? { not: excludeAppointmentId } : undefined,
      },
      include: {
        items: {
          include: {
            staff: { select: { name: true } },
            resource: { select: { name: true } },
          },
        },
      },
    });

    for (const newItem of items) {
      const newDuration = newItem.durationMinutes || 30;
      const [h, m] = newItem.startTime.split(':').map(Number);
      const totalMinutes = h * 60 + m + newDuration;
      const endH = Math.floor(totalMinutes / 60) % 24;
      const endM = totalMinutes % 60;
      const newEndTime = newItem.endTime || `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

      for (const appt of existing) {
        for (const item of appt.items) {
          if (this.timesOverlap(newItem.startTime, newEndTime, item.startTime, item.endTime)) {
            if (newItem.staffId && item.staffId && newItem.staffId === item.staffId) {
              conflicts.push(
                `Staff ${item.staff?.name || item.staffId} is already booked between ${item.startTime} and ${item.endTime} on #${appt.appointmentNumber}`
              );
            }
            if (newItem.resourceId && item.resourceId && newItem.resourceId === item.resourceId) {
              conflicts.push(
                `Resource ${item.resource?.name || item.resourceId} is already occupied between ${item.startTime} and ${item.endTime} on #${appt.appointmentNumber}`
              );
            }
          }
        }
      }
    }

    return conflicts;
  }

  /**
   * Create an appointment
   */
  async createAppointment(tenantId: string, data: CreateAppointmentDto) {
    // Check conflicts (non-blocking warning or strict validation if preferred)
    const conflicts = await this.checkConflicts(tenantId, data.appointmentDate, data.items);

    const appointment = await this.repository.create(tenantId, data);
    return {
      appointment,
      conflicts: conflicts.length > 0 ? conflicts : undefined,
    };
  }

  /**
   * Calendar grid for UI view
   */
  async getCalendarGrid(
    tenantId: string,
    dateStr?: string,
    view: 'staff' | 'resource' = 'staff',
    statusFilter?: string
  ) {
    const today = new Date().toISOString().split('T')[0];
    const targetDate = dateStr || today;

    return await this.repository.findCalendar(tenantId, targetDate, view, statusFilter);
  }

  /**
   * Get single appointment by ID
   */
  async getAppointmentById(tenantId: string, id: string) {
    const appointment = await this.repository.findById(tenantId, id);
    if (!appointment) {
      throw new Error('Appointment not found');
    }
    return appointment;
  }

  /**
   * List appointments with pagination & filters
   */
  async listAppointments(tenantId: string, query: ListAppointmentsQueryDto) {
    return await this.repository.findMany(tenantId, query);
  }

  /**
   * Update appointment
   */
  async updateAppointment(tenantId: string, id: string, data: UpdateAppointmentDto) {
    if (data.items && data.appointmentDate) {
      await this.checkConflicts(tenantId, data.appointmentDate, data.items, id);
    }
    return await this.repository.update(tenantId, id, data);
  }

  /**
   * Update status
   */
  async updateStatus(tenantId: string, id: string, status: string, cancelledReason?: string | null) {
    const updated = await this.repository.updateStatus(tenantId, id, status, cancelledReason);
    if (!updated) {
      throw new Error('Appointment not found');
    }
    return updated;
  }

  /**
   * Reschedule appointment
   */
  async rescheduleAppointment(tenantId: string, id: string, data: RescheduleAppointmentDto) {
    return await this.repository.reschedule(tenantId, id, data);
  }

  /**
   * Checkout to POS: seamlessly convert appointment to POS order
   */
  async checkoutToPos(tenantId: string, id: string, cashierId?: string) {
    return await this.repository.checkoutToPos(tenantId, id, cashierId);
  }

  /**
   * Delete appointment
   */
  async deleteAppointment(tenantId: string, id: string) {
    const deleted = await this.repository.delete(tenantId, id);
    if (!deleted) {
      throw new Error('Appointment not found');
    }
    return { success: true, message: 'Appointment deleted successfully' };
  }

  /**
   * Export appointments as CSV
   */
  async exportAppointmentsCsv(tenantId: string, query: ListAppointmentsQueryDto): Promise<string> {
    const { data } = await this.repository.findMany(tenantId, { ...query, limit: 10000, page: 1 });

    const headers = [
      'Appointment Number',
      'Date',
      'Start Time',
      'End Time',
      'Guest Name',
      'Guest Mobile',
      'Services',
      'Staff',
      'Total Amount',
      'Status',
      'Booking Source',
      'Created At',
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = data.map((appt: any) => {
      const dateStr = appt.appointmentDate ? new Date(appt.appointmentDate).toISOString().split('T')[0] : '';
      const serviceNames = (appt.items || []).map((it: any) => it.service?.name || '').filter(Boolean).join('; ');
      const staffNames = (appt.items || []).map((it: any) => it.staff?.name || '').filter(Boolean).join('; ');
      const firstItem = appt.items?.[0];
      const lastItem = appt.items?.[appt.items.length - 1];
      const startTime = firstItem?.startTime || '';
      const endTime = lastItem?.endTime || '';
      const createdAtStr = appt.createdAt ? new Date(appt.createdAt).toISOString() : '';

      return [
        escapeCsv(appt.appointmentNumber),
        escapeCsv(dateStr),
        escapeCsv(startTime),
        escapeCsv(endTime),
        escapeCsv(appt.guest?.name || ''),
        escapeCsv(appt.guest?.mobile || ''),
        escapeCsv(serviceNames),
        escapeCsv(staffNames),
        escapeCsv(appt.totalAmount ?? 0),
        escapeCsv(appt.status),
        escapeCsv(appt.bookingSource),
        escapeCsv(createdAtStr),
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }
}

export const appointmentService = new AppointmentService();
