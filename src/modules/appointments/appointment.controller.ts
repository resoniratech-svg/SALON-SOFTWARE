import { Request, Response } from 'express';
import { appointmentService, AppointmentService } from './appointment.service.js';
import {
  CalendarQuerySchema,
  CreateAppointmentSchema,
  ListAppointmentsQuerySchema,
  RescheduleAppointmentSchema,
  UpdateAppointmentSchema,
  UpdateAppointmentStatusSchema,
} from './appointment.dto.js';

export class AppointmentController {
  private service: AppointmentService;

  constructor() {
    this.service = appointmentService;
  }

  private getTenantId(req: Request): string {
    const tenantId = (req as any).effectiveTenantId || (req as any).user?.tenantId;
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }
    return tenantId;
  }

  /**
   * GET /api/v1/appointments/calendar
   */
  getCalendar = async (req: Request, res: Response) => {
    try {
      const tenantId = this.getTenantId(req);
      const parsed = CalendarQuerySchema.parse(req.query);

      const result = await this.service.getCalendarGrid(
        tenantId,
        parsed.date,
        parsed.view,
        parsed.status
      );

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ success: false, errors: error.errors });
      }
      return res.status(500).json({ success: false, message: error.message });
    }
  };

  /**
   * GET /api/v1/appointments
   */
  list = async (req: Request, res: Response) => {
    try {
      const tenantId = this.getTenantId(req);
      const parsed = ListAppointmentsQuerySchema.parse(req.query);

      if (parsed.export === 'csv') {
        const csv = await this.service.exportAppointmentsCsv(tenantId, parsed);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="appointments-export-${new Date().toISOString().slice(0, 10)}.csv"`
        );
        return res.status(200).send(csv);
      }

      const result = await this.service.listAppointments(tenantId, parsed);
      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ success: false, errors: error.errors });
      }
      return res.status(500).json({ success: false, message: error.message });
    }
  };

  /**
   * GET /api/v1/appointments/:id
   */
  getById = async (req: Request, res: Response) => {
    try {
      const tenantId = this.getTenantId(req);
      const id = req.params.id as string;

      const result = await this.service.getAppointmentById(tenantId, id);
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      return res.status(500).json({ success: false, message: error.message });
    }
  };

  /**
   * POST /api/v1/appointments
   */
  create = async (req: Request, res: Response) => {
    try {
      const tenantId = this.getTenantId(req);
      const parsed = CreateAppointmentSchema.parse(req.body);

      const result = await this.service.createAppointment(tenantId, parsed);
      return res.status(201).json({
        success: true,
        message: 'Appointment created successfully',
        data: result.appointment,
        conflicts: result.conflicts,
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ success: false, errors: error.errors });
      }
      if (error.message.includes('not found') || error.message.includes('Invalid')) {
        return res.status(400).json({ success: false, message: error.message });
      }
      return res.status(500).json({ success: false, message: error.message });
    }
  };

  /**
   * PUT /api/v1/appointments/:id
   */
  update = async (req: Request, res: Response) => {
    try {
      const tenantId = this.getTenantId(req);
      const id = req.params.id as string;
      const parsed = UpdateAppointmentSchema.parse(req.body);

      const result = await this.service.updateAppointment(tenantId, id, parsed);
      return res.status(200).json({
        success: true,
        message: 'Appointment updated successfully',
        data: result,
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ success: false, errors: error.errors });
      }
      if (error.message.includes('not found')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      return res.status(500).json({ success: false, message: error.message });
    }
  };

  /**
   * PATCH /api/v1/appointments/:id/status
   */
  updateStatus = async (req: Request, res: Response) => {
    try {
      const tenantId = this.getTenantId(req);
      const id = req.params.id as string;
      const parsed = UpdateAppointmentStatusSchema.parse(req.body);

      const result = await this.service.updateStatus(
        tenantId,
        id,
        parsed.status,
        parsed.cancelledReason
      );

      return res.status(200).json({
        success: true,
        message: `Appointment status updated to ${parsed.status}`,
        data: result,
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ success: false, errors: error.errors });
      }
      if (error.message.includes('not found')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      return res.status(500).json({ success: false, message: error.message });
    }
  };

  /**
   * PATCH /api/v1/appointments/:id/reschedule
   */
  reschedule = async (req: Request, res: Response) => {
    try {
      const tenantId = this.getTenantId(req);
      const id = req.params.id as string;
      const parsed = RescheduleAppointmentSchema.parse(req.body);

      const result = await this.service.rescheduleAppointment(tenantId, id, parsed);
      return res.status(200).json({
        success: true,
        message: 'Appointment rescheduled successfully',
        data: result,
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ success: false, errors: error.errors });
      }
      if (error.message.includes('not found')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      return res.status(500).json({ success: false, message: error.message });
    }
  };

  /**
   * POST /api/v1/appointments/:id/checkout
   * Convert appointment to POS Order
   */
  checkout = async (req: Request, res: Response) => {
    try {
      const tenantId = this.getTenantId(req);
      const cashierId = (req as any).user.id;
      const id = req.params.id as string;

      const order = await this.service.checkoutToPos(tenantId, id, cashierId);
      return res.status(200).json({
        success: true,
        message: 'Appointment successfully checked out and converted to POS Order',
        data: order,
      });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      if (error.message.includes('already been checked out') || error.message.includes('Cannot checkout')) {
        return res.status(400).json({ success: false, message: error.message });
      }
      return res.status(500).json({ success: false, message: error.message });
    }
  };

  /**
   * DELETE /api/v1/appointments/:id
   */
  delete = async (req: Request, res: Response) => {
    try {
      const tenantId = this.getTenantId(req);
      const id = req.params.id as string;

      const result = await this.service.deleteAppointment(tenantId, id);
      return res.status(200).json(result);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      return res.status(500).json({ success: false, message: error.message });
    }
  };
}

export const appointmentController = new AppointmentController();
