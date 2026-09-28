import { Router } from 'express';
import { appointmentController } from './appointment.controller.js';
import { authenticateJwt } from '../../middleware/auth.middleware.js';
import { requireModule } from '../../middleware/authorization.middleware.js';

const router = Router();

// All appointment endpoints require authentication and APPOINTMENTS/POS module enabled
router.use(authenticateJwt);
router.use(requireModule('APPOINTMENTS'));

// 1. Calendar View & Grid (Time slots, columns for staff/resources, status counts)
router.get('/calendar', appointmentController.getCalendar);

// 2. List Appointments with filters & pagination
router.get('/', appointmentController.list);

// 3. Single Appointment with guest profile & history
router.get('/:id', appointmentController.getById);

// 4. Create Appointment (supports new or existing guests, service line items, staff, resources)
router.post('/', appointmentController.create);

// 5. Update Appointment
router.put('/:id', appointmentController.update);

// 6. Update Status (Check In, In Progress, Complete, Cancel, No Show)
router.patch('/:id/status', appointmentController.updateStatus);

// 7. Reschedule Appointment (Drag & Drop or Time Update)
router.patch('/:id/reschedule', appointmentController.reschedule);

// 8. Checkout to POS (Seamlessly convert appointment to a POS Order)
router.post('/:id/checkout', appointmentController.checkout);

// 9. Delete Appointment
router.delete('/:id', appointmentController.delete);

export default router;
