import { EnquiriesRepository } from './enquiries.repository.js';
import {
  CreateEnquiryInput,
  CreateFollowUpInput,
  CreateReferralInput,
  EnquiryFilterQuery,
  ReferralFilterQuery,
  UpdateEnquiryInput,
  UpdateFollowUpInput,
  UpdateReferralInput,
} from './enquiries.types.js';

export class EnquiriesService {
  constructor(private repository: EnquiriesRepository = new EnquiriesRepository()) {}

  async getEnquiries(tenantId: string, filters: EnquiryFilterQuery) {
    return this.repository.findEnquiries(tenantId, filters);
  }

  async getEnquiryById(tenantId: string, id: string) {
    return this.repository.findEnquiryById(tenantId, id);
  }

  async createEnquiry(tenantId: string, input: CreateEnquiryInput, userId?: string) {
    return this.repository.createEnquiry(tenantId, input, userId);
  }

  async updateEnquiry(tenantId: string, id: string, input: UpdateEnquiryInput, userId?: string) {
    return this.repository.updateEnquiry(tenantId, id, input, userId);
  }

  async updateFollowUp(tenantId: string, id: string, followUpDate: string | Date, userId?: string) {
    return this.repository.updateEnquiry(tenantId, id, { followUpDate }, userId);
  }

  async createFollowUp(tenantId: string, enquiryId: string, input: CreateFollowUpInput, userId?: string) {
    return this.repository.createFollowUp(tenantId, enquiryId, input, userId);
  }

  async getFollowUps(tenantId: string, enquiryId: string) {
    return this.repository.getFollowUps(tenantId, enquiryId);
  }

  async updateFollowUpItem(tenantId: string, followUpId: string, input: UpdateFollowUpInput) {
    return this.repository.updateFollowUp(tenantId, followUpId, input);
  }

  async getEnquiryHistory(tenantId: string, enquiryId: string) {
    return this.repository.getEnquiryHistory(tenantId, enquiryId);
  }

  async deleteEnquiry(tenantId: string, id: string) {
    return this.repository.deleteEnquiry(tenantId, id);
  }

  async getReferrals(tenantId: string, filters: ReferralFilterQuery) {
    return this.repository.findReferrals(tenantId, filters);
  }

  async createReferral(tenantId: string, input: CreateReferralInput) {
    return this.repository.createReferral(tenantId, input);
  }

  async updateReferral(tenantId: string, id: string, input: UpdateReferralInput) {
    return this.repository.updateReferral(tenantId, id, input);
  }

  async deleteReferral(tenantId: string, id: string) {
    return this.repository.deleteReferral(tenantId, id);
  }

  async getReferralDashboard(tenantId: string, filters: ReferralFilterQuery) {
    return this.repository.getReferralDashboard(tenantId, filters);
  }
}

export const enquiriesService = new EnquiriesService();
