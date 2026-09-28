import { Router } from 'express';
import { payrollController } from './payroll.controller.js';
import { authenticateJwt } from '../../middleware/auth.middleware.js';
import { requireModule } from '../../middleware/authorization.middleware.js';

export const payrollRouter = Router();
payrollRouter.use(authenticateJwt);
payrollRouter.use(requireModule('PAYROLL'));

// 1. Configuration Endpoints
payrollRouter.get('/config', payrollController.getConfig);
payrollRouter.get('/configs', payrollController.getAllConfigs);
payrollRouter.post('/config', payrollController.saveConfig);
payrollRouter.put('/config', payrollController.saveConfig);
payrollRouter.delete('/config/:id', payrollController.deleteConfig);

// 2. Salary Generation & Management Endpoints
payrollRouter.get('/salary', payrollController.getSalaries);
payrollRouter.post('/generate', payrollController.generateSalaries);
payrollRouter.post('/salary/generate', payrollController.generateSalaries);
payrollRouter.get('/salary/:id', payrollController.getSalaryById);
payrollRouter.patch('/salary/:id', payrollController.updateSalary);
payrollRouter.patch('/salary/:id/status', payrollController.updateSalaryStatus);
payrollRouter.post('/salary/:id/pay', payrollController.paySalary);
payrollRouter.delete('/salary/:id', payrollController.deleteSalary);

// 3. Payslip & Print Endpoints
payrollRouter.get('/payslip', payrollController.getPayslip);
payrollRouter.get('/payslip/print', payrollController.printPayslip);
payrollRouter.get('/payslip/html', payrollController.printPayslip);

