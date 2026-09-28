import { Router } from 'express';
import { guestController } from './guest.controller.js';
import { validateRequest, validateQuery } from '../../middleware/validate.middleware.js';
import {
  createGuestSchema,
  updateGuestSchema,
  updateGuestStatusSchema,
  guestQuerySchema,
  addGuestMembershipSchema,
  addGuestPackageSchema,
  guestWalletTxSchema,
  guestFollowUpSchema,
  guestNoteSchema,
  guestFamilyMemberSchema,
  guestFormSubmissionSchema,
  bulkDeleteGuestsSchema,
} from './guest.validation.js';
import { authenticateJwt } from '../../middleware/auth.middleware.js';
import { requirePermissions, requireModule } from '../../middleware/authorization.middleware.js';

const router = Router();

// All CRM Guest endpoints require authentication and CRM/GUESTS module
router.use(authenticateJwt);
router.use(requireModule('CRM'));

// 0. Export CRM Guests (XLSX / CSV) - Placed before :id routes
router.get(
  '/export',
  requirePermissions('GUEST:READ'),
  guestController.exportCrm
);
router.get(
  '/crm/export',
  requirePermissions('GUEST:READ'),
  guestController.exportCrm
);

// 1. CRM Enhanced List / Filter (From CRM.mp4 UI table)
router.get(
  '/crm',
  requirePermissions('GUEST:READ'),
  validateQuery(guestQuerySchema),
  guestController.crmList
);

// 2. List / Search / Filter Guests
router.get(
  '/',
  requirePermissions('GUEST:READ'),
  validateQuery(guestQuerySchema),
  (req, res, next) => {
    // If request contains CRM specific query params or view=crm, use crmList
    if (req.query.view === 'crm') {
      return guestController.crmList(req, res, next);
    }
    return guestController.list(req, res, next);
  }
);

// 3. Create Guest (Admin, Receptionist, Cashier for POS quick sale)
router.post(
  '/',
  requirePermissions('GUEST:CREATE'),
  validateRequest(createGuestSchema),
  guestController.create
);

// 4. Quick Lookup by Mobile (POS convenience)
router.get(
  '/lookup/:mobile',
  requirePermissions('GUEST:READ'),
  guestController.getByMobile
);

// 5. Guest 360 Full Profile (All 15 Tabs: Orders, Memberships, Packages, Wallet, Followups, Notes, etc.)
router.get(
  '/:id/360',
  requirePermissions('GUEST:READ'),
  guestController.get360
);

// 6. Get Guest Details by ID
router.get(
  '/:id',
  requirePermissions('GUEST:READ'),
  guestController.getById
);

// 7. Get Referrals by Guest ID
router.get(
  '/:id/referrals',
  requirePermissions('GUEST:READ'),
  guestController.getReferrals
);

// 8. Add Membership (From Guest 360 Membership Tab)
router.post(
  '/:id/memberships',
  requirePermissions('GUEST:UPDATE'),
  validateRequest(addGuestMembershipSchema),
  guestController.addMembership
);

// 9. Add Package (From Guest 360 Packages Tab)
router.post(
  '/:id/packages',
  requirePermissions('GUEST:UPDATE'),
  validateRequest(addGuestPackageSchema),
  guestController.addPackage
);
router.post(
  '/:id/packages/:packageId/redeem',
  requirePermissions('GUEST:UPDATE'),
  guestController.redeemPackageSession
);

// 10. Record Wallet Transaction (Advance Deposit / Due Balance Settlement / Loyalty Credit & Debit)
router.post(
  '/:id/wallet',
  requirePermissions('GUEST:UPDATE'),
  validateRequest(guestWalletTxSchema),
  guestController.recordWallet
);
router.post(
  '/:id/wallet/transactions',
  requirePermissions('GUEST:UPDATE'),
  validateRequest(guestWalletTxSchema),
  guestController.recordWallet
);

// 11. Follow-up Tasks (From Guest 360 Follow-up Tab)
router.post(
  '/:id/follow-ups',
  requirePermissions('GUEST:UPDATE'),
  validateRequest(guestFollowUpSchema),
  guestController.createFollowUp
);
router.put(
  '/:id/follow-ups/:followUpId',
  requirePermissions('GUEST:UPDATE'),
  guestController.updateFollowUp
);

// 12. Notes (From Guest 360 Notes Tab)
router.post(
  '/:id/notes',
  requirePermissions('GUEST:UPDATE'),
  validateRequest(guestNoteSchema),
  guestController.addNote
);
router.delete(
  '/:id/notes/:noteId',
  requirePermissions('GUEST:UPDATE'),
  guestController.deleteNote
);

// 13. Family Members (From Guest 360 Family Members Tab)
router.post(
  '/:id/family',
  requirePermissions('GUEST:UPDATE'),
  validateRequest(guestFamilyMemberSchema),
  guestController.addFamilyMember
);
router.delete(
  '/:id/family/:memberId',
  requirePermissions('GUEST:UPDATE'),
  guestController.deleteFamilyMember
);

// 14. Custom Form Submissions (From Guest 360 Forms Tab)
router.post(
  '/:id/forms',
  requirePermissions('GUEST:UPDATE'),
  validateRequest(guestFormSubmissionSchema),
  guestController.submitForm
);

// 15. Update Guest Details (Admin, Cashier, Receptionist)
router.put(
  '/:id',
  requirePermissions('GUEST:UPDATE'),
  validateRequest(updateGuestSchema),
  guestController.update
);

// 16. Update Guest Status / Block / Unblock (Admin Only)
router.patch(
  '/:id/status',
  requirePermissions('GUEST:STATUS'),
  validateRequest(updateGuestStatusSchema),
  guestController.updateStatus
);

// 17. Delete / Deactivate Guest (Single or Bulk Multi-Select)
router.delete(
  '/bulk',
  requirePermissions('GUEST:DELETE'),
  guestController.bulkDelete
);
router.post(
  '/bulk-delete',
  requirePermissions('GUEST:DELETE'),
  guestController.bulkDelete
);
router.delete(
  '/',
  requirePermissions('GUEST:DELETE'),
  guestController.delete
);
router.delete(
  '/:id',
  requirePermissions('GUEST:DELETE'),
  guestController.delete
);

export default router;
